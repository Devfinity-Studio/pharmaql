import crypto from "crypto";
import { readServerJson, writeServerJson } from "./server-storage";

export type AuditEventType =
	| "AUTH_LOGIN_SUCCESS"
	| "AUTH_LOGIN_FAILURE"
	| "AUTH_LOGOUT"
	| "OTP_REQUEST"
	| "OTP_VERIFY_SUCCESS"
	| "OTP_VERIFY_FAILURE"
	| "ADMIN_UNBLOCK"
	| "RATE_LIMIT_EXCEEDED"
	| "SECURITY_WARNING"
	| "EXPORT_DOWNLOAD";

export interface AuditLogEntry {
	id: string;
	timestamp: string;
	event: AuditEventType;
	userId?: string | null;
	userEmail?: string | null;
	role?: string | null;
	ip: string;
	userAgent?: string | null;
	details?: Record<string, any>;
}

const MAX_AUDIT_ENTRIES = 1000;

// Internal queue to prevent concurrent read/write race conditions
let writeQueue = Promise.resolve();

/**
 * Record a structured audit trail event.
 * Safe from unhandled rejections and maintains a sliding rolling window of latest 1,000 entries.
 */
export async function recordAuditEvent(
	entry: Omit<AuditLogEntry, "id" | "timestamp">,
): Promise<void> {
	const logItem: AuditLogEntry = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		...entry,
	};

	writeQueue = writeQueue
		.then(async () => {
			try {
				let logs = await readServerJson<AuditLogEntry[]>("audit_logs.json", []);
				if (!Array.isArray(logs)) logs = [];

				logs.unshift(logItem);

				if (logs.length > MAX_AUDIT_ENTRIES) {
					logs = logs.slice(0, MAX_AUDIT_ENTRIES);
				}

				await writeServerJson("audit_logs.json", logs);
			} catch (err) {
				console.error("[AuditLogger] Failed to write audit event:", err);
			}
		})
		.catch((err) => {
			console.error("[AuditLogger] Queue execution error:", err);
		});

	// Wait for entry to finish writing
	await writeQueue;
}

/**
 * Retrieve recent audit logs with optional filtering.
 */
export async function getRecentAuditLogs(options?: {
	limit?: number;
	event?: string;
}): Promise<AuditLogEntry[]> {
	try {
		let logs = await readServerJson<AuditLogEntry[]>("audit_logs.json", []);
		if (!Array.isArray(logs)) return [];

		if (options?.event) {
			logs = logs.filter((log) => log.event === options.event);
		}

		const limit = options?.limit || 100;
		return logs.slice(0, limit);
	} catch {
		return [];
	}
}
