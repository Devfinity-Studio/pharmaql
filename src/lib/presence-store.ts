import crypto from "crypto";
import { readServerJson, writeServerJson } from "./server-storage";
import { parseUserAgent, type DeviceType } from "./user-agent-parser";

export type PresenceStatus = "active" | "idle" | "offline";

export interface ActiveUserSession {
	sessionId: string;
	userId: string;
	userEmail: string;
	userName: string;
	role: "MR" | "ADMIN" | "DEVELOPER";
	rank?: number;
	division?: string | null;
	company?: string | null;
	clientIp: string;
	deviceType: DeviceType;
	browser: string;
	os: string;
	screenResolution?: string;
	currentPage: string;
	currentTitle?: string;
	firstSeen: string;
	lastHeartbeat: string;
	isRevoked?: boolean;
	revokedAt?: string;
}

export interface PresenceStoreData {
	sessions: Record<string, ActiveUserSession>;
	revokedUserIds: Record<string, string>; // userId -> timestamp of revocation
}

const SESSIONS_FILE = "active_sessions.json";
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const MAX_SESSION_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

// Queue to serialize atomic writes
let presenceWriteQueue = Promise.resolve();

/**
 * Calculates current real-time status of a session based on heartbeat elapsed time.
 */
export function getSessionPresenceStatus(session: ActiveUserSession): PresenceStatus {
	if (session.isRevoked) return "offline";
	const elapsed = Date.now() - new Date(session.lastHeartbeat).getTime();
	if (isNaN(elapsed)) return "offline";
	if (elapsed <= ACTIVE_THRESHOLD_MS) return "active";
	if (elapsed <= IDLE_THRESHOLD_MS) return "idle";
	return "offline";
}

/**
 * Reads presence registry from storage safely.
 */
async function readPresenceData(): Promise<PresenceStoreData> {
	const fallback: PresenceStoreData = { sessions: {}, revokedUserIds: {} };
	const data = await readServerJson<PresenceStoreData>(SESSIONS_FILE, fallback);
	if (!data || typeof data !== "object") return fallback;
	return {
		sessions: data.sessions && typeof data.sessions === "object" ? data.sessions : {},
		revokedUserIds: data.revokedUserIds && typeof data.revokedUserIds === "object" ? data.revokedUserIds : {},
	};
}

/**
 * Writes presence registry atomically to storage.
 */
async function writePresenceData(data: PresenceStoreData): Promise<void> {
	await writeServerJson(SESSIONS_FILE, data);
}

/**
 * Updates or records an active heartbeat from an authenticated client.
 */
export async function recordPresenceHeartbeat(params: {
	sessionId?: string;
	userId: string;
	userEmail: string;
	userName: string;
	role: "MR" | "ADMIN" | "DEVELOPER";
	rank?: number;
	division?: string | null;
	company?: string | null;
	clientIp: string;
	userAgent?: string | null;
	screenResolution?: string;
	currentPage: string;
	currentTitle?: string;
}): Promise<{ sessionId: string; isRevoked: boolean }> {
	const now = new Date().toISOString();
	let result = { sessionId: "", isRevoked: false };

	presenceWriteQueue = presenceWriteQueue.then(async () => {
		try {
			const store = await readPresenceData();

			// Check if this user was explicitly revoked
			const revocationTimestamp = store.revokedUserIds[params.userId];
			if (revocationTimestamp) {
				const revokedAt = new Date(revocationTimestamp).getTime();
				// If revoked within last 24 hours, enforce revocation
				if (Date.now() - revokedAt < 24 * 60 * 60 * 1000) {
					result = { sessionId: params.sessionId || "", isRevoked: true };
					return;
				}
			}

			// Resolve or generate unique session/device ID
			const uaInfo = parseUserAgent(params.userAgent);
			const deviceKey = `${params.userId}_${params.clientIp}_${uaInfo.os}_${uaInfo.browser}`.replace(/[^a-zA-Z0-9_-]/g, "_");
			const sessionId = params.sessionId || deviceKey || crypto.randomUUID();

			const existing = store.sessions[sessionId];
			if (existing?.isRevoked) {
				result = { sessionId, isRevoked: true };
				return;
			}

			const sessionRecord: ActiveUserSession = {
				sessionId,
				userId: params.userId,
				userEmail: params.userEmail,
				userName: params.userName,
				role: params.role,
				rank: params.rank,
				division: params.division ?? existing?.division ?? null,
				company: params.company ?? existing?.company ?? null,
				clientIp: params.clientIp,
				deviceType: uaInfo.deviceType,
				browser: uaInfo.browser,
				os: uaInfo.os,
				screenResolution: params.screenResolution || existing?.screenResolution,
				currentPage: params.currentPage,
				currentTitle: params.currentTitle || existing?.currentTitle,
				firstSeen: existing?.firstSeen || now,
				lastHeartbeat: now,
				isRevoked: false,
			};

			store.sessions[sessionId] = sessionRecord;

			// Prune sessions older than MAX_SESSION_AGE_MS
			const cutoff = Date.now() - MAX_SESSION_AGE_MS;
			for (const [id, s] of Object.entries(store.sessions)) {
				const sTime = new Date(s.lastHeartbeat).getTime();
				if (!isNaN(sTime) && sTime < cutoff) {
					delete store.sessions[id];
				}
			}

			await writePresenceData(store);
			result = { sessionId, isRevoked: false };
		} catch (err) {
			console.error("[PresenceStore] Error recording heartbeat:", err);
		}
	});

	await presenceWriteQueue;
	return result;
}

/**
 * Returns all recorded sessions sorted with most recent active sessions first.
 */
export async function getAllActiveSessions(): Promise<ActiveUserSession[]> {
	try {
		const store = await readPresenceData();
		const list = Object.values(store.sessions);
		list.sort((a, b) => new Date(b.lastHeartbeat).getTime() - new Date(a.lastHeartbeat).getTime());
		return list;
	} catch (err) {
		console.error("[PresenceStore] Error reading active sessions:", err);
		return [];
	}
}

/**
 * Revokes an active session by session ID or all sessions for a user ID.
 */
export async function revokeSession(identifier: string): Promise<boolean> {
	let success = false;
	presenceWriteQueue = presenceWriteQueue.then(async () => {
		try {
			const store = await readPresenceData();
			const now = new Date().toISOString();

			// 1. Check if identifier is a sessionId
			if (store.sessions[identifier]) {
				store.sessions[identifier].isRevoked = true;
				store.sessions[identifier].revokedAt = now;
				store.revokedUserIds[store.sessions[identifier].userId] = now;
				success = true;
			} else {
				// 2. Check if identifier matches a userId
				store.revokedUserIds[identifier] = now;
				for (const s of Object.values(store.sessions)) {
					if (s.userId === identifier || s.userEmail.toLowerCase() === identifier.toLowerCase()) {
						s.isRevoked = true;
						s.revokedAt = now;
						success = true;
					}
				}
			}

			await writePresenceData(store);
		} catch (err) {
			console.error("[PresenceStore] Error revoking session:", err);
		}
	});

	await presenceWriteQueue;
	return success;
}

/**
 * Unrevokes / clears revocation for a user so they can log back in.
 */
export async function unrevokeUser(userId: string): Promise<void> {
	presenceWriteQueue = presenceWriteQueue.then(async () => {
		try {
			const store = await readPresenceData();
			delete store.revokedUserIds[userId];
			for (const s of Object.values(store.sessions)) {
				if (s.userId === userId) {
					s.isRevoked = false;
				}
			}
			await writePresenceData(store);
		} catch (err) {
			console.error("[PresenceStore] Error unrevoking user:", err);
		}
	});
	await presenceWriteQueue;
}

/**
 * Fast in-memory / storage check whether a user ID or session ID has been revoked.
 */
export async function checkIsSessionRevoked(userId: string, sessionId?: string): Promise<boolean> {
	try {
		const store = await readPresenceData();
		if (store.revokedUserIds[userId]) return true;
		if (sessionId && store.sessions[sessionId]?.isRevoked) return true;
		return false;
	} catch {
		return false;
	}
}
