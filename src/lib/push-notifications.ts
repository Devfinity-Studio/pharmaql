import webpush from "web-push";
import { readServerJson, writeServerJson } from "./server-storage";

export interface VapidKeys {
	publicKey: string;
	privateKey: string;
}

export interface StoredPushSubscription {
	id: string;
	userId: string;
	role: "MR" | "ADMIN" | "DEVELOPER";
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
	userAgent?: string;
	createdAt: string;
	lastActiveAt: string;
}

export interface InAppNotification {
	id: string;
	recipientUserId?: string; // Specific user ID; if undefined, broadcast to recipientRole
	recipientRole?: "MR" | "ADMIN" | "ALL";
	title: string;
	body: string;
	category: "OVERDUE" | "NOTICE" | "SUBSCRIPTION" | "SYSTEM";
	urgency: "HIGH" | "MEDIUM" | "LOW";
	url?: string;
	createdAt: string;
	readBy: string[];
}

export interface PushNotificationPayload {
	title: string;
	body: string;
	url?: string;
	category?: "OVERDUE" | "NOTICE" | "SUBSCRIPTION" | "SYSTEM";
	urgency?: "HIGH" | "MEDIUM" | "LOW";
	tag?: string;
	icon?: string;
	badge?: string;
}

let vapidConfigured = false;
let cachedVapidKeys: VapidKeys | null = null;

/**
 * 1. Initialize or load VAPID key pairs.
 * Loads from environment if defined, otherwise persists to data/vapid_keys.json.
 */
export async function getVapidKeys(): Promise<VapidKeys> {
	if (cachedVapidKeys) {
		return cachedVapidKeys;
	}

	const envPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const envPrivate = process.env.VAPID_PRIVATE_KEY;

	if (envPublic && envPrivate) {
		cachedVapidKeys = { publicKey: envPublic, privateKey: envPrivate };
		ensureVapidConfigured(cachedVapidKeys);
		return cachedVapidKeys;
	}

	const stored = await readServerJson<VapidKeys | null>("vapid_keys.json", null);
	if (stored && stored.publicKey && stored.privateKey) {
		cachedVapidKeys = stored;
		ensureVapidConfigured(cachedVapidKeys);
		return cachedVapidKeys;
	}

	const generated = webpush.generateVAPIDKeys();
	cachedVapidKeys = {
		publicKey: generated.publicKey,
		privateKey: generated.privateKey,
	};

	await writeServerJson("vapid_keys.json", cachedVapidKeys);
	ensureVapidConfigured(cachedVapidKeys);
	return cachedVapidKeys;
}

function ensureVapidConfigured(keys: VapidKeys) {
	if (!vapidConfigured) {
		try {
			webpush.setVapidDetails(
				"mailto:support@devfinity.net",
				keys.publicKey,
				keys.privateKey,
			);
			vapidConfigured = true;
		} catch (err) {
			console.error("[WebPush] setVapidDetails error:", err);
		}
	}
}

/**
 * 2. Get Public VAPID Key for client-side subscription
 */
export async function getVapidPublicKey(): Promise<string> {
	const keys = await getVapidKeys();
	return keys.publicKey;
}

/**
 * 3. Subscription Persistence Helpers
 */
export async function getStoredSubscriptions(): Promise<StoredPushSubscription[]> {
	const subs = await readServerJson<StoredPushSubscription[]>("push_subscriptions.json", []);
	return Array.isArray(subs) ? subs : [];
}

export async function savePushSubscription(
	userId: string,
	role: "MR" | "ADMIN" | "DEVELOPER",
	subscription: {
		endpoint: string;
		keys: { p256dh: string; auth: string };
	},
	userAgent?: string,
): Promise<StoredPushSubscription> {
	if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
		throw new Error("Invalid push subscription structure.");
	}

	const subscriptions = await getStoredSubscriptions();
	const existingIdx = subscriptions.findIndex((s) => s.endpoint === subscription.endpoint);

	const now = new Date().toISOString();
	let record: StoredPushSubscription;

	const existing = existingIdx >= 0 ? subscriptions[existingIdx] : undefined;

	if (existing) {
		// Update existing endpoint (e.g. user re-subscribed or changed role/session)
		record = {
			...existing,
			userId,
			role,
			keys: subscription.keys,
			userAgent: userAgent || existing.userAgent,
			lastActiveAt: now,
		};
		subscriptions[existingIdx] = record;
	} else {
		// Register new device endpoint
		record = {
			id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			userId,
			role,
			endpoint: subscription.endpoint,
			keys: subscription.keys,
			userAgent,
			createdAt: now,
			lastActiveAt: now,
		};
		subscriptions.push(record);
	}

	await writeServerJson("push_subscriptions.json", subscriptions);
	return record;
}

export async function removePushSubscription(endpoint: string): Promise<boolean> {
	const subscriptions = await getStoredSubscriptions();
	const filtered = subscriptions.filter((s) => s.endpoint !== endpoint);
	if (filtered.length !== subscriptions.length) {
		await writeServerJson("push_subscriptions.json", filtered);
		return true;
	}
	return false;
}

/**
 * Strictly purge all push endpoints registered to a specific user.
 * Vital for shared devices upon logout / account switch to prevent cross-MR alert leakage.
 */
export async function removeUserPushSubscriptions(userId: string): Promise<number> {
	const subscriptions = await getStoredSubscriptions();
	const filtered = subscriptions.filter((s) => s.userId !== userId);
	const removedCount = subscriptions.length - filtered.length;
	if (removedCount > 0) {
		await writeServerJson("push_subscriptions.json", filtered);
	}
	return removedCount;
}

/**
 * 4. In-App Notification Store Helpers
 */
export async function getInAppNotifications(): Promise<InAppNotification[]> {
	const notifs = await readServerJson<InAppNotification[]>("notifications.json", []);
	return Array.isArray(notifs) ? notifs : [];
}

export async function addInAppNotification(
	notification: Omit<InAppNotification, "id" | "createdAt" | "readBy">,
): Promise<InAppNotification> {
	const all = await getInAppNotifications();
	const item: InAppNotification = {
		id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
		...notification,
		createdAt: new Date().toISOString(),
		readBy: [],
	};

	// Keep last 150 notifications max to prevent file bloat
	const updated = [item, ...all].slice(0, 150);
	await writeServerJson("notifications.json", updated);
	return item;
}

export async function getUserInAppNotifications(
	userId: string,
	role: "MR" | "ADMIN" | "DEVELOPER",
): Promise<InAppNotification[]> {
	const all = await getInAppNotifications();
	return all.filter((n) => {
		// Specific recipient match
		if (n.recipientUserId) {
			return n.recipientUserId === userId;
		}
		// Role broadcast match
		if (n.recipientRole === "ALL" || !n.recipientRole) {
			return true;
		}
		if (n.recipientRole === "MR" && role === "MR") {
			return true;
		}
		if (
			n.recipientRole === "ADMIN" &&
			(role === "ADMIN" || role === "DEVELOPER")
		) {
			return true;
		}
		return false;
	});
}

export async function markInAppNotificationAsRead(
	userId: string,
	notificationId: string,
): Promise<boolean> {
	const all = await getInAppNotifications();
	let updated = false;

	for (const notif of all) {
		if (notif.id === notificationId && !notif.readBy.includes(userId)) {
			notif.readBy.push(userId);
			updated = true;
			break;
		}
	}

	if (updated) {
		await writeServerJson("notifications.json", all);
	}
	return updated;
}

export async function markAllInAppNotificationsAsRead(
	userId: string,
	role: "MR" | "ADMIN" | "DEVELOPER",
): Promise<number> {
	const all = await getInAppNotifications();
	let count = 0;

	for (const notif of all) {
		const isRelevant =
			notif.recipientUserId === userId ||
			notif.recipientRole === "ALL" ||
			(notif.recipientRole === "MR" && role === "MR") ||
			(notif.recipientRole === "ADMIN" && (role === "ADMIN" || role === "DEVELOPER"));

		if (isRelevant && !notif.readBy.includes(userId)) {
			notif.readBy.push(userId);
			count += 1;
		}
	}

	if (count > 0) {
		await writeServerJson("notifications.json", all);
	}
	return count;
}

/**
 * 5. Push Dispatchers
 */
async function sendSinglePush(
	sub: StoredPushSubscription,
	payload: PushNotificationPayload,
): Promise<{ success: boolean; pruned?: boolean; error?: string }> {
	await getVapidKeys();

	const pushPayload = JSON.stringify({
		title: payload.title,
		body: payload.body,
		icon: payload.icon || "/favicons/android-chrome-192x192.png",
		badge: payload.badge || "/favicons/android-chrome-192x192.png",
		tag: payload.tag || `pharmaql-${payload.category || "general"}`,
		data: {
			url: payload.url || "/dashboard",
			category: payload.category || "SYSTEM",
			urgency: payload.urgency || "MEDIUM",
			timestamp: Date.now(),
		},
	});

	try {
		await webpush.sendNotification(
			{
				endpoint: sub.endpoint,
				keys: sub.keys,
			},
			pushPayload,
			{
				TTL: 60 * 60 * 24, // 24 hours
				urgency: payload.urgency === "HIGH" ? "high" : "normal",
			},
		);
		return { success: true };
	} catch (err: any) {
		const statusCode = err?.statusCode;
		// 410 Gone or 404 Not Found indicates uninstalled or expired client subscription
		if (statusCode === 410 || statusCode === 404) {
			console.log(`[WebPush] Pruning expired subscription endpoint: ${sub.endpoint}`);
			await removePushSubscription(sub.endpoint);
			return { success: false, pruned: true, error: "Subscription expired (410/404)" };
		}
		console.warn(`[WebPush] Send notification error for endpoint ${sub.endpoint}:`, err?.message || err);
		return { success: false, error: err?.message || "Send failed" };
	}
}

/**
 * Send Web Push directly to a specific user's active device subscriptions.
 * Also archives an in-app alert for that user.
 */
export async function sendPushToUser(
	userId: string,
	payload: PushNotificationPayload,
): Promise<{ sentCount: number; prunedCount: number; inAppCreated: boolean }> {
	// Archive in-app notification
	await addInAppNotification({
		recipientUserId: userId,
		title: payload.title,
		body: payload.body,
		category: payload.category || "SYSTEM",
		urgency: payload.urgency || "MEDIUM",
		url: payload.url,
	});

	const subscriptions = await getStoredSubscriptions();
	const userSubs = subscriptions.filter((s) => s.userId === userId);

	let sentCount = 0;
	let prunedCount = 0;

	for (const sub of userSubs) {
		const res = await sendSinglePush(sub, payload);
		if (res.success) {
			sentCount += 1;
		} else if (res.pruned) {
			prunedCount += 1;
		}
	}

	return { sentCount, prunedCount, inAppCreated: true };
}

/**
 * Send Web Push to all registered devices matching a specific role (e.g. "MR" or "ADMIN").
 * Also archives in-app notification.
 */
export async function sendPushToRole(
	role: "MR" | "ADMIN",
	payload: PushNotificationPayload,
): Promise<{ sentCount: number; prunedCount: number; inAppCreated: boolean }> {
	await addInAppNotification({
		recipientRole: role,
		title: payload.title,
		body: payload.body,
		category: payload.category || "NOTICE",
		urgency: payload.urgency || "MEDIUM",
		url: payload.url,
	});

	const subscriptions = await getStoredSubscriptions();
	const roleSubs = subscriptions.filter((s) => {
		if (role === "ADMIN") {
			return s.role === "ADMIN" || s.role === "DEVELOPER";
		}
		return s.role === role;
	});

	let sentCount = 0;
	let prunedCount = 0;

	for (const sub of roleSubs) {
		const res = await sendSinglePush(sub, payload);
		if (res.success) {
			sentCount += 1;
		} else if (res.pruned) {
			prunedCount += 1;
		}
	}

	return { sentCount, prunedCount, inAppCreated: true };
}

/**
 * Broadcast Web Push to ALL registered devices on the platform.
 */
export async function sendBroadcastPush(
	payload: PushNotificationPayload,
): Promise<{ sentCount: number; prunedCount: number; inAppCreated: boolean }> {
	await addInAppNotification({
		recipientRole: "ALL",
		title: payload.title,
		body: payload.body,
		category: payload.category || "NOTICE",
		urgency: payload.urgency || "MEDIUM",
		url: payload.url,
	});

	const subscriptions = await getStoredSubscriptions();
	let sentCount = 0;
	let prunedCount = 0;

	for (const sub of subscriptions) {
		const res = await sendSinglePush(sub, payload);
		if (res.success) {
			sentCount += 1;
		} else if (res.pruned) {
			prunedCount += 1;
		}
	}

	return { sentCount, prunedCount, inAppCreated: true };
}

/**
 * Diagnostic summary for developer control panel
 */
export async function getPushDiagnosticSummary() {
	const subs = await getStoredSubscriptions();
	const notifs = await getInAppNotifications();

	const mrCount = subs.filter((s) => s.role === "MR").length;
	const adminCount = subs.filter((s) => s.role === "ADMIN").length;
	const devCount = subs.filter((s) => s.role === "DEVELOPER").length;

	return {
		totalSubscriptions: subs.length,
		mrCount,
		adminCount,
		devCount,
		totalInAppNotifications: notifs.length,
		vapidConfigured: Boolean(cachedVapidKeys || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
	};
}
