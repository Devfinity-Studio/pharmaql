"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { recordAuditEvent } from "@/lib/audit-logger";
import {
	getAllActiveSessions,
	recordPresenceHeartbeat,
	revokeSession,
	getSessionPresenceStatus,
	type ActiveUserSession,
	type PresenceStatus,
} from "@/lib/presence-store";
import { getClientIpFromHeaders } from "@/lib/user-agent-parser";
import { toggleMRBlockStatus } from "./mrs";

export interface SessionDisplayItem extends ActiveUserSession {
	status: PresenceStatus;
	idleSeconds: number;
}

export interface PresenceSummaryMetrics {
	totalActiveNow: number;
	totalIdle: number;
	totalOnlineToday: number;
	mobileCount: number;
	desktopCount: number;
	tabletCount: number;
	roleBreakdown: {
		mr: number;
		admin: number;
		developer: number;
	};
	topPages: Array<{ page: string; count: number }>;
}

/**
 * Public client heartbeat dispatcher.
 * Called automatically by authenticated client presence beacons.
 */
export async function sendPresenceHeartbeatAction(params: {
	sessionId?: string;
	currentPage: string;
	currentTitle?: string;
	screenResolution?: string;
}) {
	try {
		const reqHeaders = await headers();
		const session = await auth.api.getSession({ headers: reqHeaders });

		if (!session || !session.user) {
			return { success: false, error: "Unauthenticated" };
		}

		const clientIp = getClientIpFromHeaders(reqHeaders);
		const userAgent = reqHeaders.get("user-agent") || "";

		const result = await recordPresenceHeartbeat({
			sessionId: params.sessionId,
			userId: session.user.id,
			userEmail: session.user.email,
			userName: session.user.name || "User",
			role: session.user.role as any,
			rank: (session.user as any).rank,
			division: (session.user as any).division,
			company: (session.user as any).company,
			clientIp,
			userAgent,
			screenResolution: params.screenResolution,
			currentPage: params.currentPage || "/",
			currentTitle: params.currentTitle,
		});

		return {
			success: true,
			sessionId: result.sessionId,
			isRevoked: result.isRevoked,
		};
	} catch (error: any) {
		return { success: false, error: error?.message || "Failed to record presence" };
	}
}

/**
 * Fetch all active sessions & computed telemetry metrics.
 * Restricted strictly to DEVELOPER and ADMIN accounts.
 */
export async function getLivePresenceDataAction(): Promise<{
	success: boolean;
	sessions: SessionDisplayItem[];
	metrics: PresenceSummaryMetrics;
	error?: string;
}> {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		const isAuthorized =
			session?.user?.role === "DEVELOPER" ||
			session?.user?.role === "ADMIN" ||
			Boolean((session?.user as any)?.originalDeveloper);

		if (!isAuthorized) {
			return {
				success: false,
				sessions: [],
				metrics: {
					totalActiveNow: 0,
					totalIdle: 0,
					totalOnlineToday: 0,
					mobileCount: 0,
					desktopCount: 0,
					tabletCount: 0,
					roleBreakdown: { mr: 0, admin: 0, developer: 0 },
					topPages: [],
				},
				error: "Unauthorized",
			};
		}

		const rawSessions = await getAllActiveSessions();
		const now = Date.now();

		let totalActiveNow = 0;
		let totalIdle = 0;
		let mobileCount = 0;
		let desktopCount = 0;
		let tabletCount = 0;
		const roleBreakdown = { mr: 0, admin: 0, developer: 0 };
		const pageCounts: Record<string, number> = {};

		const sessions: SessionDisplayItem[] = rawSessions.map((s) => {
			const status = getSessionPresenceStatus(s);
			const elapsedSec = Math.max(0, Math.floor((now - new Date(s.lastHeartbeat).getTime()) / 1000));

			if (status === "active") totalActiveNow++;
			else if (status === "idle") totalIdle++;

			if (status !== "offline") {
				if (s.deviceType === "mobile") mobileCount++;
				else if (s.deviceType === "tablet") tabletCount++;
				else desktopCount++;

				const r = (s.role || "").toLowerCase();
				if (r === "mr") roleBreakdown.mr++;
				else if (r === "admin") roleBreakdown.admin++;
				else if (r === "developer") roleBreakdown.developer++;

				if (s.currentPage) {
					const cleanPath = s.currentPage.split("?")[0] || s.currentPage;
					pageCounts[cleanPath] = (pageCounts[cleanPath] || 0) + 1;
				}
			}

			return {
				...s,
				status,
				idleSeconds: elapsedSec,
			};
		});

		const topPages = Object.entries(pageCounts)
			.map(([page, count]) => ({ page, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		return {
			success: true,
			sessions,
			metrics: {
				totalActiveNow,
				totalIdle,
				totalOnlineToday: sessions.length,
				mobileCount,
				desktopCount,
				tabletCount,
				roleBreakdown,
				topPages,
			},
		};
	} catch (error: any) {
		console.error("[PresenceActions] Error fetching live presence:", error);
		return {
			success: false,
			sessions: [],
			metrics: {
				totalActiveNow: 0,
				totalIdle: 0,
				totalOnlineToday: 0,
				mobileCount: 0,
				desktopCount: 0,
				tabletCount: 0,
				roleBreakdown: { mr: 0, admin: 0, developer: 0 },
				topPages: [],
			},
			error: error?.message || "Failed to load presence telemetry",
		};
	}
}

/**
 * Remotely terminates/revokes a user session.
 * Restricted strictly to DEVELOPER and ADMIN accounts.
 */
export async function forceLogoutUserSessionAction(identifier: string) {
	try {
		const reqHeaders = await headers();
		const session = await auth.api.getSession({ headers: reqHeaders });
		const isAuthorized =
			session?.user?.role === "DEVELOPER" ||
			session?.user?.role === "ADMIN" ||
			Boolean((session?.user as any)?.originalDeveloper);

		if (!isAuthorized) {
			return { success: false, error: "Unauthorized" };
		}

		const success = await revokeSession(identifier);

		// Record audit event
		await recordAuditEvent({
			event: "SECURITY_WARNING",
			userId: session?.user?.id,
			userEmail: session?.user?.email,
			role: session?.user?.role,
			ip: getClientIpFromHeaders(reqHeaders),
			details: {
				action: "forceLogoutUserSession",
				targetSessionOrUser: identifier,
				revokedBy: session?.user?.email,
			},
		});

		revalidatePath("/admin/dev");
		return { success };
	} catch (error: any) {
		console.error("[PresenceActions] Error forcing logout:", error);
		return { success: false, error: error?.message || "Failed to revoke session" };
	}
}

/**
 * Shortcut action to block/unblock an MR directly from the presence row.
 */
export async function toggleBlockFromPresenceAction(userId: string, isBlocked: boolean) {
	try {
		const res = await toggleMRBlockStatus(userId, isBlocked);
		if (res.success && isBlocked) {
			// If blocked, also revoke their active sessions immediately
			await revokeSession(userId);
		}
		revalidatePath("/admin/dev");
		return res;
	} catch (error: any) {
		return { success: false, error: error?.message || "Failed to toggle block status" };
	}
}
