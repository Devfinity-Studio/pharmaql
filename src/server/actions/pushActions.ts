"use server";

import { headers } from "next/headers";
import {
	getVapidPublicKey,
	savePushSubscription,
	removePushSubscription,
	removeUserPushSubscriptions,
	getUserInAppNotifications,
	markInAppNotificationAsRead,
	markAllInAppNotificationsAsRead,
	sendPushToUser,
	sendPushToRole,
	sendBroadcastPush,
	getPushDiagnosticSummary,
	type PushNotificationPayload,
} from "@/lib/push-notifications";
import { auth } from "@/server/auth";

async function getAuthenticatedSession() {
	let reqHeaders: Headers | undefined;
	try {
		reqHeaders = await headers();
	} catch {
		// outside request context
	}

	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session?.user) {
		throw new Error("Unauthorized: Active session required.");
	}

	return session;
}

/**
 * 1. Retrieve Public VAPID Key for client-side service worker subscription
 */
export async function getVapidPublicKeyAction(): Promise<string> {
	await getAuthenticatedSession();
	return await getVapidPublicKey();
}

/**
 * 2. Save device push subscription scoped to current authenticated user
 */
export async function savePushSubscriptionAction(
	sub: {
		endpoint: string;
		keys: { p256dh: string; auth: string };
	},
	userAgent?: string,
) {
	const session = await getAuthenticatedSession();
	const userRole = session.user.role as "MR" | "ADMIN" | "DEVELOPER";

	const record = await savePushSubscription(
		session.user.id,
		userRole,
		sub,
		userAgent,
	);

	return { success: true, subscriptionId: record.id };
}

/**
 * 3. Remove a specific device push endpoint
 */
export async function removePushSubscriptionAction(endpoint: string) {
	await getAuthenticatedSession();
	const removed = await removePushSubscription(endpoint);
	return { success: removed };
}

/**
 * 4. Revoke all push subscriptions for the current user (e.g. during logout)
 */
export async function logoutPushCleanupAction() {
	try {
		const session = await getAuthenticatedSession();
		const count = await removeUserPushSubscriptions(session.user.id);
		return { success: true, removedCount: count };
	} catch {
		return { success: false, removedCount: 0 };
	}
}

/**
 * 5. Fetch in-app notifications for active user
 */
export async function getUserNotificationsAction() {
	const session = await getAuthenticatedSession();
	const userRole = session.user.role as "MR" | "ADMIN" | "DEVELOPER";
	const notifications = await getUserInAppNotifications(session.user.id, userRole);
	const unreadCount = notifications.filter((n) => !n.readBy.includes(session.user.id)).length;

	return { notifications, unreadCount };
}

/**
 * 6. Mark a single notification as read
 */
export async function markNotificationReadAction(notificationId: string) {
	const session = await getAuthenticatedSession();
	const success = await markInAppNotificationAsRead(session.user.id, notificationId);
	return { success };
}

/**
 * 7. Mark all notifications as read
 */
export async function markAllNotificationsReadAction() {
	const session = await getAuthenticatedSession();
	const userRole = session.user.role as "MR" | "ADMIN" | "DEVELOPER";
	const markedCount = await markAllInAppNotificationsAsRead(session.user.id, userRole);
	return { success: true, markedCount };
}

/**
 * 8. Send Test Push Alert (Self-test or Developer Dispatcher)
 */
export async function sendTestPushAction(options?: {
	targetUserId?: string;
	targetRole?: "MR" | "ADMIN" | "ALL";
	title?: string;
	body?: string;
	url?: string;
}) {
	const session = await getAuthenticatedSession();
	const isDeveloper = session.user.role === "DEVELOPER";

	const payload: PushNotificationPayload = {
		title: options?.title || "PharmaQL Test Alert",
		body:
			options?.body ||
			`Test notification triggered at ${new Date().toLocaleTimeString()} by ${session.user.name || session.user.email}.`,
		url: options?.url || "/dashboard",
		category: "SYSTEM",
		urgency: "HIGH",
	};

	// Standard users can only trigger self-test to their own user ID
	if (!isDeveloper || (!options?.targetRole && !options?.targetUserId)) {
		const res = await sendPushToUser(session.user.id, payload);
		return {
			success: res.sentCount > 0,
			sentCount: res.sentCount,
			prunedCount: res.prunedCount,
			message: `Dispatched self-test alert to your active device(s) (${res.sentCount} delivered).`,
		};
	}

	// Developers can dispatch to specific target or broadcast
	if (options?.targetUserId) {
		const res = await sendPushToUser(options.targetUserId, payload);
		return {
			success: res.sentCount > 0,
			sentCount: res.sentCount,
			prunedCount: res.prunedCount,
			message: `Dispatched push notification to user ${options.targetUserId} (${res.sentCount} delivered).`,
		};
	}

	if (options?.targetRole === "MR" || options?.targetRole === "ADMIN") {
		const res = await sendPushToRole(options.targetRole, payload);
		return {
			success: res.sentCount > 0,
			sentCount: res.sentCount,
			prunedCount: res.prunedCount,
			message: `Dispatched push notification to all ${options.targetRole}s (${res.sentCount} delivered).`,
		};
	}

	const res = await sendBroadcastPush(payload);
	return {
		success: res.sentCount > 0,
		sentCount: res.sentCount,
		prunedCount: res.prunedCount,
		message: `Broadcast push notification dispatched platform-wide (${res.sentCount} delivered).`,
	};
}

/**
 * 9. Developer push diagnostic summary
 */
export async function getPushDiagnosticsAction() {
	const session = await getAuthenticatedSession();
	if (session.user.role !== "DEVELOPER") {
		throw new Error("Access Denied: Developer role required.");
	}
	return await getPushDiagnosticSummary();
}
