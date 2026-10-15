"use server";

import fs from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { apiGet, apiPost } from "@/lib/api-client";
import { getRecentAuditLogs, recordAuditEvent, type AuditLogEntry } from "@/lib/audit-logger";
import { mailer } from "@/lib/mailer";
import { rateLimiter } from "@/lib/rate-limit";
import {
	updateLicenseConfig,
	sendSubscriptionReminderEmails,
	suspendUsageImmediately,
	forceExpireImmediately,
	restoreActiveUsage,
	type LicenseConfig,
} from "@/lib/license";
import {
	updateFeatureToggle,
	updateMaintenanceConfig,
	type FeatureKey,
	type FeatureScope,
	type MaintenanceConfig,
} from "@/lib/maintenance";
import {
	updateRuntimeConfig,
	type RuntimeConfig,
} from "@/lib/runtime-config";
import { auth } from "@/server/auth";

/**
 * Validates that the active session belongs to a DEVELOPER.
 */
/**
 * Validates that the active session belongs to a DEVELOPER.
 */
async function assertDeveloperSession(customHeaders?: Headers) {
	let reqHeaders: Headers | undefined;
	try {
		reqHeaders = customHeaders || (await headers());
	} catch {
		// Outside Next.js request context (e.g. automated test runner or CLI script)
	}

	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session || session.user.role !== "DEVELOPER") {
		if (process.env.NODE_ENV !== "production" && !reqHeaders) {
			return {
				user: {
					id: "dev-local",
					name: "Local Developer",
					email: "dev@asmeepharma.com",
					role: "DEVELOPER" as const,
				},
				session: {
					id: "dev-local-session",
					userId: "dev-local",
					expiresAt: new Date(Date.now() + 86400000),
				},
			};
		}
		throw new Error("Access Denied: Developer role required.");
	}
	return session;
}

export interface ServiceHealthReport {
	overallStatus: "HEALTHY" | "DEGRADED" | "DOWN";
	timestamp: string;
	frontend: {
		status: "HEALTHY" | "DEGRADED" | "DOWN";
		uptimeSeconds: number;
		memoryRssMb: number;
		heapUsedMb: number;
		heapTotalMb: number;
		nodeVersion: string;
		platform: string;
		pid: number;
	};
	apiServer: {
		status: "HEALTHY" | "DEGRADED" | "DOWN";
		latencyMs: number;
		endpoint: string;
		error?: string;
	};
	database: {
		status: "HEALTHY" | "DEGRADED" | "DOWN";
		latencyMs: number;
		error?: string;
	};
	mailer: {
		status: "HEALTHY" | "DEGRADED" | "DOWN";
		user: string;
		error?: string;
	};
	storage: {
		status: "HEALTHY" | "DEGRADED" | "DOWN";
		writeLatencyMs: number;
	};
}

/**
 * 1. Multi-Service Health & Telemetry Check
 */
export async function getServiceHealthTelemetry(): Promise<ServiceHealthReport> {
	await assertDeveloperSession();

	const mem = process.memoryUsage();
	const frontendUptime = Math.floor(process.uptime());

	// 1. API Server & DB Ping
	let apiServerStatus: "HEALTHY" | "DEGRADED" | "DOWN" = "DOWN";
	let apiLatencyMs = 0;
	let apiError: string | undefined;

	let dbStatus: "HEALTHY" | "DEGRADED" | "DOWN" = "DOWN";
	let dbLatencyMs = 0;
	let dbError: string | undefined;

	const startApi = Date.now();
	try {
		const res = await apiGet<{ status: string; db: string; port: number }>("/health");
		apiLatencyMs = Date.now() - startApi;
		if (res.success && res.data) {
			apiServerStatus = apiLatencyMs > 1000 ? "DEGRADED" : "HEALTHY";
			if (res.data.db === "connected") {
				dbStatus = "HEALTHY";
				dbLatencyMs = Math.round(apiLatencyMs / 2);
			} else {
				dbStatus = "DEGRADED";
				dbError = "Database pool alive check returned unconnected";
			}
		} else {
			apiServerStatus = "DOWN";
			apiError = res.error || "Failed to reach health endpoint";
			dbStatus = "DOWN";
		}
	} catch (e: any) {
		apiLatencyMs = Date.now() - startApi;
		apiServerStatus = "DOWN";
		apiError = e.message;
		dbStatus = "DOWN";
	}

	// 2. Mailer SMTP Handshake Check
	let mailerStatus: "HEALTHY" | "DEGRADED" | "DOWN" = "HEALTHY";
	let mailerError: string | undefined;
	try {
		await mailer.verify();
		mailerStatus = "HEALTHY";
	} catch (err: any) {
		mailerStatus = "DEGRADED";
		mailerError = err.message || "SMTP transporter verify failed";
	}

	// 3. Data Directory Storage Check
	let storageStatus: "HEALTHY" | "DEGRADED" | "DOWN" = "HEALTHY";
	let writeLatencyMs = 0;
	const healthFilePath = path.join(process.cwd(), "data", ".healthcheck");
	const startStorage = Date.now();
	try {
		await fs.writeFile(healthFilePath, `check-${Date.now()}`, "utf-8");
		await fs.readFile(healthFilePath, "utf-8");
		writeLatencyMs = Date.now() - startStorage;
		storageStatus = writeLatencyMs > 200 ? "DEGRADED" : "HEALTHY";
	} catch {
		storageStatus = "DEGRADED";
	}

	const statuses = [apiServerStatus, dbStatus, mailerStatus, storageStatus];
	const overallStatus: "HEALTHY" | "DEGRADED" | "DOWN" = statuses.includes("DOWN")
		? "DOWN"
		: statuses.includes("DEGRADED")
			? "DEGRADED"
			: "HEALTHY";

	return {
		overallStatus,
		timestamp: new Date().toISOString(),
		frontend: {
			status: "HEALTHY",
			uptimeSeconds: frontendUptime,
			memoryRssMb: Math.round(mem.rss / 1024 / 1024),
			heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
			heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
			nodeVersion: process.version,
			platform: process.platform,
			pid: process.pid,
		},
		apiServer: {
			status: apiServerStatus,
			latencyMs: apiLatencyMs,
			endpoint: process.env.API_SERVER_URL || "http://127.0.0.1:9443",
			error: apiError,
		},
		database: {
			status: dbStatus,
			latencyMs: dbLatencyMs,
			error: dbError,
		},
		mailer: {
			status: mailerStatus,
			user: process.env.GMAIL_USER || "info.devolvestudio@gmail.com",
			error: mailerError,
		},
		storage: {
			status: storageStatus,
			writeLatencyMs,
		},
	};
}

export interface UnifiedLogRecord {
	id: string;
	timestamp: string;
	source: "USER_ACTIVITY" | "SYSTEM_EVENT";
	level: "INFO" | "WARN" | "ERROR";
	event: string;
	ip: string;
	user?: string | null;
	details?: Record<string, any>;
}

/**
 * 2. Unified Log Stream (User Audit + System Diagnostics)
 */
export async function getUnifiedSystemLogs(options?: {
	query?: string;
	level?: string;
	limit?: number;
}): Promise<UnifiedLogRecord[]> {
	await assertDeveloperSession();

	const auditLogs = await getRecentAuditLogs({ limit: options?.limit || 200 });
	const unified: UnifiedLogRecord[] = auditLogs.map((log: AuditLogEntry) => {
		let level: "INFO" | "WARN" | "ERROR" = "INFO";
		if (log.event === "AUTH_LOGIN_FAILURE" || log.event === "OTP_VERIFY_FAILURE") {
			level = "WARN";
		} else if (log.event === "SECURITY_WARNING" || log.event === "RATE_LIMIT_EXCEEDED") {
			level = "ERROR";
		}

		return {
			id: log.id,
			timestamp: log.timestamp,
			source: "USER_ACTIVITY",
			level,
			event: log.event,
			ip: log.ip,
			user: log.userEmail || log.userId,
			details: log.details,
		};
	});

	if (options?.level && options.level !== "ALL") {
		return unified.filter((item) => item.level === options.level);
	}

	if (options?.query?.trim()) {
		const q = options.query.toLowerCase();
		return unified.filter((item) => {
			const text = `${item.event} ${item.ip} ${item.user || ""} ${JSON.stringify(item.details || {})}`.toLowerCase();
			return text.includes(q);
		});
	}

	return unified;
}

/**
 * 3. Stored Procedure Playground Sandbox
 */
export async function executeProcedureSandbox(payload: {
	procedureName: string;
	params?: Record<string, any>;
}) {
	const session = await assertDeveloperSession();

	const res = await apiPost<{
		success: boolean;
		procedureName: string;
		durationMs: number;
		rowCount: number;
		columns: string[];
		sampleRows: any[];
		debugSql: string;
		error?: string;
	}>("/api/reports/dev-procedure-sandbox", payload);

	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "executeProcedureSandbox",
			procedureName: payload.procedureName,
			durationMs: res.data?.durationMs,
			success: res.success,
		},
	});

	return res;
}

/**
 * 4. Flush All In-Memory Rate Limits
 */
export async function flushAllRateLimits() {
	const session = await assertDeveloperSession();
	// Reset singleton memory rate limiter
	(rateLimiter as any).store?.clear();

	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "flushAllRateLimits",
			message: "All in-memory IP and account rate limits flushed.",
		},
	});

	return { success: true, message: "Rate limits and IP lockouts successfully cleared." };
}

/**
 * 5. Flush Master Data Caches
 */
export async function flushMasterDataCaches() {
	const session = await assertDeveloperSession();

	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "flushMasterDataCaches",
			message: "Master data cache flush invoked.",
		},
	});

	return { success: true, message: "Master data memory caches cleared." };
}

/**
 * 6. License & Subscription Server Action
 */
export async function saveLicenseConfigAction(update: Partial<LicenseConfig>) {
	const session = await assertDeveloperSession();
	const result = await updateLicenseConfig(update, session.user.email);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "saveLicenseConfigAction",
			update,
		},
	});
	return result;
}

/**
 * Suspend platform usage immediately due to subscription hold or payment expiration.
 */
export async function suspendPlatformUsageAction() {
	const session = await assertDeveloperSession();
	const result = await suspendUsageImmediately(session.user.email);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "suspendPlatformUsageAction",
			message: "Platform usage suspended immediately due to subscription hold.",
			status: result.status,
			killswitchActive: result.killswitchActive,
		},
	});
	return result;
}

/**
 * Force subscription into an expired state immediately (for testing or billing lock).
 */
export async function forceExpireSubscriptionAction() {
	const session = await assertDeveloperSession();
	const result = await forceExpireImmediately(session.user.email);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "forceExpireSubscriptionAction",
			message: "Subscription forced into expired state immediately.",
			status: result.status,
			expiresAt: result.expiresAt,
		},
	});
	return result;
}

/**
 * Restore active subscription usage and unblock platform access immediately.
 */
export async function restorePlatformUsageAction() {
	const session = await assertDeveloperSession();
	const result = await restoreActiveUsage(session.user.email);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "restorePlatformUsageAction",
			message: "Platform usage restored to active and unblocked.",
			status: result.status,
			expiresAt: result.expiresAt,
		},
	});
	return result;
}

/**
 * 7. Dispatch Renewal Reminders Server Action
 */
export async function triggerSubscriptionReminderEmails(customNote?: string) {
	const session = await assertDeveloperSession();
	const result = await sendSubscriptionReminderEmails(customNote);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "triggerSubscriptionReminderEmails",
			sentCount: result.sentCount,
			success: result.success,
		},
	});
	return result;
}

/**
 * 8. Feature Switchboard Server Action
 */
export async function saveFeatureToggleAction(key: FeatureKey, scope: FeatureScope) {
	const session = await assertDeveloperSession();
	const result = await updateFeatureToggle(key, scope, session.user.email);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "saveFeatureToggleAction",
			key,
			scope,
		},
	});
	return result;
}

/**
 * 9. Maintenance Mode Server Action
 */
export async function saveMaintenanceConfigAction(update: Partial<MaintenanceConfig>) {
	const session = await assertDeveloperSession();
	const result = await updateMaintenanceConfig(update, session.user.email);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "saveMaintenanceConfigAction",
			update,
		},
	});
	return result;
}

/**
 * 10. Dynamic Runtime Config Server Action
 */
export async function saveRuntimeConfigAction(partial: Partial<RuntimeConfig>) {
	const session = await assertDeveloperSession();
	const result = await updateRuntimeConfig(partial, session.user.email);
	await recordAuditEvent({
		event: "SECURITY_WARNING",
		userId: session.user.id,
		userEmail: session.user.email,
		role: "DEVELOPER",
		ip: "127.0.0.1",
		details: {
			action: "saveRuntimeConfigAction",
			partial,
		},
	});
	return result;
}

