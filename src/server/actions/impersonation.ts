"use server";

import { cookies, headers } from "next/headers";
import { auth } from "@/server/auth";
import { recordAuditEvent } from "@/lib/audit-logger";
import { getClientIp, getClientUserAgent } from "@/lib/security";

const IMPERSONATE_COOKIE_NAME = "pharmaql_impersonate";

/**
 * Start simulating / viewing-as an MR.
 * Restricted strictly to active DEVELOPER accounts.
 */
export async function startMrImpersonation(mrId: string, tenantId?: string) {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({ headers: reqHeaders });
	const isDev =
		session?.user?.role === "DEVELOPER" ||
		Boolean((session?.user as any)?.originalDeveloper);

	if (!isDev) {
		return { success: false, error: "Unauthorized: Developer session required." };
	}

	const cookieStore = await cookies();
	cookieStore.set(IMPERSONATE_COOKIE_NAME, mrId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 3600,
	});
	if (tenantId) {
		cookieStore.set("pharmaql_impersonate_tenant", tenantId, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 3600,
		});
	}

	// Audit logging for developer impersonation
	try {
		const reqHeaders = await headers();
		const clientIp = getClientIp(reqHeaders);
		const userAgent = getClientUserAgent(reqHeaders);

		await recordAuditEvent({
			event: "DEVELOPER_IMPERSONATION_START",
			userId: session?.user?.id || "dev",
			userEmail: session?.user?.email || "dev@pharmaql.local",
			role: "DEVELOPER",
			ip: clientIp,
			userAgent,
			details: {
				action: "startMrImpersonation",
				targetMrId: mrId,
			},
		});
	} catch (auditErr) {
		console.warn("[Impersonation] Audit recording warning:", auditErr);
	}

	return { success: true };
}

/**
 * Stop MR simulation and return back to developer identity.
 */
export async function stopMrImpersonation() {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({ headers: reqHeaders });
	const cookieStore = await cookies();
	cookieStore.delete(IMPERSONATE_COOKIE_NAME);
	cookieStore.delete("pharmaql_impersonate_tenant");

	try {
		const reqHeaders = await headers();
		const clientIp = getClientIp(reqHeaders);
		const userAgent = getClientUserAgent(reqHeaders);

		await recordAuditEvent({
			event: "DEVELOPER_IMPERSONATION_STOP",
			userId: session?.user?.id || "dev",
			userEmail: session?.user?.email || "dev@pharmaql.local",
			role: "DEVELOPER",
			ip: clientIp,
			userAgent,
			details: {
				action: "stopMrImpersonation",
			},
		});
	} catch (auditErr) {
		console.warn("[Impersonation] Audit recording warning:", auditErr);
	}

	return { success: true };
}
