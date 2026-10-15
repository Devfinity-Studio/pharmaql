"use server";

import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import path from "path";
import { recordAuditEvent } from "@/lib/audit-logger";
import {
	checkAdminUnblockAllowed,
	recordAdminUnblockFailure,
	recordAdminUnblockSuccess,
} from "@/lib/rate-limit";
import { getClientIp, getClientUserAgent, isIpAllowedForAdmin } from "@/lib/security";
import { auth } from "@/server/auth";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "mr_overrides.json");

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

	// 4. Validate explicit Admin Password
	const expectedAdminPass = process.env.ADMIN_PASSWORD || "Admin@PharmaQL2026";
	if (!adminPassword || adminPassword.trim() !== expectedAdminPass.trim()) {
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
		let allOverrides: Record<string, any> = {};
		try {
			const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
			allOverrides = JSON.parse(raw);
		} catch {
			allOverrides = {};
		}

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

		await fs.mkdir(path.dirname(OVERRIDES_FILE), { recursive: true });
		await fs.writeFile(
			OVERRIDES_FILE,
			JSON.stringify(allOverrides, null, 2),
			"utf-8",
		);

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
