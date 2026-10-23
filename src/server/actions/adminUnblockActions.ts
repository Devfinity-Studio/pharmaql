"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordAuditEvent } from "@/lib/audit-logger";
import {
	checkAdminUnblockAllowed,
	recordAdminUnblockFailure,
	recordAdminUnblockSuccess,
} from "@/lib/rate-limit";
import { getClientIp, getClientUserAgent, isIpAllowedForAdmin } from "@/lib/security";
import { auth } from "@/server/auth";
import { readServerJson, writeServerJson } from "@/lib/server-storage";

interface UnblockHistoryEntry {
	unblockedAt: string;
	adminEmail: string;
	reason: string;
	exemptionDays?: number;
	exemptionUntil?: string;
}

/**
 * Unblock an MR or grant an exemption, protected strictly by the Admin Password.
 * Hardened with IP allowlisting, sliding rate limiting, and structured audit logs.
 */
export async function secureAdminUnblockMR({
	mrId,
	adminPassword,
	reason,
	exemptionDays = 7,
}: {
	mrId: string;
	adminPassword: string;
	reason: string;
	exemptionDays?: number;
}) {
	const reqHeaders = await headers();
	const clientIp = getClientIp(reqHeaders);
	const userAgent = getClientUserAgent(reqHeaders);

	// 1. IP Allowlist verification
	if (!isIpAllowedForAdmin(clientIp)) {
		await recordAuditEvent({
			event: "SECURITY_WARNING",
			ip: clientIp,
			userAgent,
			details: {
				action: "secureAdminUnblockMR",
				targetMrId: mrId,
				reason: "Unauthorized IP address attempting unblock action",
			},
		});

		return {
			success: false,
			error: "Forbidden: Your IP address is not authorized for administrative operations.",
		};
	}

	// 2. Sliding-window rate limit / lockout check
	const rateCheck = checkAdminUnblockAllowed(clientIp);
	if (!rateCheck.allowed) {
		await recordAuditEvent({
			event: "RATE_LIMIT_EXCEEDED",
			ip: clientIp,
			userAgent,
			details: {
				action: "secureAdminUnblockMR",
				targetMrId: mrId,
				reason: rateCheck.message,
			},
		});

		return {
			success: false,
			error: rateCheck.message,
		};
	}

	// 3. Verify caller session
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		return {
			success: false,
			error: "Unauthorized: Admin privileges required.",
		};
	}

	// 4. Validate explicit Admin / Dev Password
	const expectedAdminPass = (process.env.ADMIN_PASSWORD || "").trim();
	const expectedDevPass = (process.env.DEV_PASSWORD || "").trim();
	const suppliedPass = (adminPassword || "").trim();

	const timingSafeMatch = (provided: string, expected: string): boolean => {
		if (!provided || !expected) return false;
		const bufA = Buffer.from(provided, "utf-8");
		const bufB = Buffer.from(expected, "utf-8");
		if (bufA.length !== bufB.length) {
			crypto.timingSafeEqual(bufA, bufA);
			return false;
		}
		return crypto.timingSafeEqual(bufA, bufB);
	};

	const isPassValid =
		(Boolean(expectedAdminPass) && timingSafeMatch(suppliedPass, expectedAdminPass)) ||
		(Boolean(expectedDevPass) && timingSafeMatch(suppliedPass, expectedDevPass));

	if (!isPassValid) {
		const fail = recordAdminUnblockFailure(clientIp);

		await recordAuditEvent({
			event: "SECURITY_WARNING",
			userId: session.user.id,
			userEmail: session.user.email,
			role: session.user.role,
			ip: clientIp,
			userAgent,
			details: {
				action: "secureAdminUnblockMR",
				targetMrId: mrId,
				reason: "Incorrect admin password supplied",
				remainingAttempts: fail.remainingAttempts,
			},
		});

		const suffix = fail.locked
			? " Account locked for 15 minutes."
			: ` ${fail.remainingAttempts} attempts remaining.`;

		return {
			success: false,
			error: `Invalid Admin Password.${suffix}`,
		};
	}

	// Success: Reset rate limiter for unblock
	recordAdminUnblockSuccess(clientIp);

	try {
		const allOverrides = await readServerJson<Record<string, any>>("mr_overrides.json", {});

		const current = allOverrides[mrId] || {};
		const unblockedUntil = new Date(
			Date.now() + exemptionDays * 24 * 60 * 60 * 1000,
		).toISOString();

		const history: UnblockHistoryEntry[] = current.unblockHistory || [];
		const entry: UnblockHistoryEntry = {
			unblockedAt: new Date().toISOString(),
			adminEmail: session.user.email,
			reason: reason.trim() || "Administrative override granted",
			exemptionDays,
			exemptionUntil: unblockedUntil,
		};
		history.unshift(entry);

		allOverrides[mrId] = {
			...current,
			isBlocked: false,
			unblockedUntil,
			exemptionUntil: unblockedUntil,
			unblockHistory: history,
		};

		await writeServerJson("mr_overrides.json", allOverrides);

		// Record persistent audit log event
		await recordAuditEvent({
			event: "ADMIN_UNBLOCK",
			userId: session.user.id,
			userEmail: session.user.email,
			role: session.user.role,
			ip: clientIp,
			userAgent,
			details: {
				targetMrId: mrId,
				reason: entry.reason,
				exemptionDays,
				unblockedUntil,
			},
		});

		revalidatePath("/admin/mrs");
		revalidatePath(`/admin/mrs/${mrId}`);
		revalidatePath("/dashboard");

		return {
			success: true,
			message: `MR successfully unblocked with a ${exemptionDays}-day grace exemption until ${unblockedUntil.split("T")[0]}.`,
		};
	} catch (error: any) {
		console.error("[Unblock] Error unblocking MR:", error);
		return { success: false, error: error.message || "Failed to unblock MR." };
	}
}
