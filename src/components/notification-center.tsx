"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
	Bell,
	CheckCheck,
	AlertTriangle,
	Megaphone,
	ShieldAlert,
	Info,
	ExternalLink,
	RefreshCw,
	Sparkles,
	X,
	Check,
} from "lucide-react";
import {
	getVapidPublicKeyAction,
	savePushSubscriptionAction,
	getUserNotificationsAction,
	markNotificationReadAction,
	markAllNotificationsReadAction,
	sendTestPushAction,
} from "@/server/actions/pushActions";
import type { InAppNotification } from "@/lib/push-notifications";

interface NotificationCenterProps {
	userRole?: string;
	className?: string;
	buttonClassName?: string;
	isDark?: boolean;
	align?: "left" | "right" | "auto";
}

function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding)
		.replace(/\-/g, "+")
		.replace(/_/g, "/");

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

export function NotificationCenter({
	userRole,
	className = "",
	buttonClassName = "",
	isDark = false,
	align = "auto",
}: NotificationCenterProps) {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState<InAppNotification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
	const [isSubscribed, setIsSubscribed] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	// 1. Initial Load & Permission Detection
	useEffect(() => {
		if (typeof window !== "undefined" && "Notification" in window) {
			setPushPermission(Notification.permission);
			checkExistingSubscription();
		} else {
			setPushPermission("unsupported");
		}
		loadNotifications();

		// Refresh alerts periodically (every 60s) and when window gains focus
		const interval = setInterval(loadNotifications, 60000);
		const onFocus = () => loadNotifications();
		window.addEventListener("focus", onFocus);

		return () => {
			clearInterval(interval);
			window.removeEventListener("focus", onFocus);
		};
	}, []);

	// Click outside to close drawer
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	async function checkExistingSubscription() {
		try {
			if ("serviceWorker" in navigator) {
				const reg = await navigator.serviceWorker.ready;
				const sub = await reg.pushManager.getSubscription();
				setIsSubscribed(Boolean(sub));
			}
		} catch {
			setIsSubscribed(false);
		}
	}

	async function loadNotifications() {
		try {
			const res = await getUserNotificationsAction();
			setNotifications(res.notifications);
			setUnreadCount(res.unreadCount);
		} catch (err) {
			// Non-fatal if offline or unauthenticated
		}
	}

	// 2. Enable Web Push Subscription
	const handleEnablePush = () => {
		startTransition(async () => {
			try {
				if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
					setStatusFeedback("Push notifications are not supported on this browser.");
					return;
				}

				const permission = await Notification.requestPermission();
				setPushPermission(permission);

				if (permission !== "granted") {
					setStatusFeedback("Push permission denied. You can re-enable it in browser settings.");
					return;
				}

				const publicKey = await getVapidPublicKeyAction();
				if (!publicKey) {
					setStatusFeedback("VAPID server key not initialized.");
					return;
				}

				const reg = await navigator.serviceWorker.ready;
				let sub = await reg.pushManager.getSubscription();

				if (!sub) {
					const convertedVapidKey = urlBase64ToUint8Array(publicKey);
					sub = await reg.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: convertedVapidKey,
					});
				}

				const subJson = sub.toJSON();
				if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
					await savePushSubscriptionAction(
						{
							endpoint: subJson.endpoint,
							keys: {
								p256dh: subJson.keys.p256dh,
								auth: subJson.keys.auth,
							},
						},
						navigator.userAgent,
					);
					setIsSubscribed(true);
					setStatusFeedback("Push notifications successfully activated on this device!");
					setTimeout(() => setStatusFeedback(null), 4000);
				}
			} catch (err: any) {
				console.error("[Push] Subscription error:", err);
				setStatusFeedback(`Subscription failed: ${err.message || "Unknown error"}`);
			}
		});
	};

	// 3. Send Self Test Push
	const handleSendTestPush = () => {
		startTransition(async () => {
			try {
				const res = await sendTestPushAction({
					title: "PharmaQL Test Push",
					body: "Real-time Web Push notification working smoothly on your device!",
					url: "/dashboard",
				});
				setStatusFeedback(res.message);
				setTimeout(() => setStatusFeedback(null), 4000);
				await loadNotifications();
			} catch (err: any) {
				setStatusFeedback(`Test failed: ${err.message}`);
			}
		});
	};

	// 4. Mark Single as Read & Navigate
	const handleNotificationClick = (item: InAppNotification) => {
		startTransition(async () => {
			await markNotificationReadAction(item.id);
			setNotifications((prev) =>
				prev.map((n) => (n.id === item.id ? { ...n, readBy: [...n.readBy, "self"] } : n)),
			);
			setUnreadCount((c) => Math.max(0, c - 1));
			if (item.url) {
				setIsOpen(false);
				router.push(item.url);
			}
		});
	};

	// 5. Mark All as Read
	const handleMarkAllRead = () => {
		startTransition(async () => {
			await markAllNotificationsReadAction();
			setNotifications((prev) =>
				prev.map((n) => ({ ...n, readBy: [...n.readBy, "self"] })),
			);
			setUnreadCount(0);
			setStatusFeedback("All notifications marked as read.");
			setTimeout(() => setStatusFeedback(null), 3000);
		});
	};

	const formatRelativeTime = (isoString: string) => {
		try {
			const diff = Date.now() - new Date(isoString).getTime();
			const mins = Math.floor(diff / 60000);
			if (mins < 1) return "Just now";
			if (mins < 60) return `${mins}m ago`;
			const hours = Math.floor(mins / 60);
			if (hours < 24) return `${hours}h ago`;
			const days = Math.floor(hours / 24);
			return `${days}d ago`;
		} catch {
			return "";
		}
	};

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "OVERDUE":
				return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
			case "NOTICE":
				return <Megaphone className="h-4 w-4 text-blue-500 shrink-0" />;
			case "SUBSCRIPTION":
				return <ShieldAlert className="h-4 w-4 text-purple-500 shrink-0" />;
			default:
				return <Info className="h-4 w-4 text-sky-500 shrink-0" />;
		}
	};

	return (
		<div className={`relative ${className}`} ref={popoverRef}>
			{/* Bell Button with Unread Badge */}
			<button
				aria-label="View notifications and alerts"
				className={
					buttonClassName ||
					`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
						isDark
							? "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
							: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-[#0B2545]"
					}`
				}
				onClick={() => {
					setIsOpen(!isOpen);
					if (!isOpen) loadNotifications();
				}}
				title="Notifications & Field Alerts"
				type="button"
			>
				<Bell className="h-4 w-4" />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 font-mono text-[9px] font-black text-white shadow-xs animate-pulse">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{/* Dropdown Popover Drawer */}
			{isOpen && (
				<div
					className={`absolute ${
						align === "left"
							? "left-0"
							: align === "auto"
								? "right-0 md:left-0 md:right-auto"
								: "right-0"
					} mt-2 z-[100] w-80 sm:w-96 max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-md transition-all ${
						isDark
							? "border-gray-800 bg-gray-900/98 text-white"
							: "border-gray-200 bg-white/98 text-gray-900"
					}`}
				>
					{/* Popover Header */}
					<div
						className={`flex items-center justify-between border-b p-4 ${
							isDark ? "border-gray-800" : "border-gray-100"
						}`}
					>
						<div className="flex items-center gap-2">
							<h3 className="font-extrabold text-sm tracking-tight">Alerts & Notices</h3>
							{unreadCount > 0 && (
								<span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-bold text-[10px] text-rose-500 border border-rose-500/20">
									{unreadCount} unread
								</span>
							)}
						</div>
						<div className="flex items-center gap-1.5">
							{unreadCount > 0 && (
								<button
									className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
									disabled={isPending}
									onClick={handleMarkAllRead}
									title="Mark all as read"
									type="button"
								>
									<CheckCheck className="h-3.5 w-3.5" />
									<span>Read All</span>
								</button>
							)}
							<button
								aria-label="Close notification panel"
								className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
								onClick={() => setIsOpen(false)}
								type="button"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>

					{/* Feedback Banner */}
					{statusFeedback && (
						<div className="border-b border-blue-100 bg-blue-50/80 px-4 py-2 text-xs font-semibold text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/50 dark:text-blue-300">
							{statusFeedback}
						</div>
					)}

					{/* Push Notification Permission Card */}
					<div
						className={`border-b p-3.5 ${
							isDark ? "border-gray-800 bg-gray-950/40" : "border-gray-100 bg-gray-50/70"
						}`}
					>
						{pushPermission === "granted" && isSubscribed ? (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
									<span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
										Push Active on Device
									</span>
								</div>
								<button
									className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
									disabled={isPending}
									onClick={handleSendTestPush}
									type="button"
								>
									Send Test Alert
								</button>
							</div>
						) : pushPermission === "denied" ? (
							<div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-semibold">
								<AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
								<span>Push blocked in browser settings. Enable permissions to receive instant alerts.</span>
							</div>
						) : pushPermission === "unsupported" ? (
							<div className="text-xs text-gray-500">
								Web push notifications are not supported on this browser.
							</div>
						) : (
							<div className="flex flex-col gap-2">
								<div className="flex items-start gap-2">
									<Sparkles className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
									<p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
										Enable instant push alerts for 80-90d overdue warnings and official notices.
									</p>
								</div>
								<button
									className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0071BC] px-3 py-1.5 font-bold text-xs text-white shadow-xs hover:bg-[#005a96] transition"
									disabled={isPending}
									onClick={handleEnablePush}
									type="button"
								>
									<Bell className="h-3.5 w-3.5" />
									<span>Enable Device Push Notifications</span>
								</button>
							</div>
						)}
					</div>

					{/* Notification Scrollable List */}
					<div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
						{notifications.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-10 px-4 text-center">
								<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-gray-800 text-blue-600 mb-3">
									<Bell className="h-6 w-6 opacity-60" />
								</div>
								<p className="font-bold text-sm text-gray-800 dark:text-gray-200">You're all caught up!</p>
								<p className="text-xs text-gray-400 mt-1">No unread notifications or field alerts.</p>
							</div>
						) : (
							notifications.map((item) => {
								const isRead = item.readBy.length > 0;
								return (
									<div
										className={`group flex items-start gap-3 p-3.5 transition cursor-pointer ${
											isRead
												? isDark
													? "bg-transparent hover:bg-gray-800/40 opacity-75"
													: "bg-transparent hover:bg-gray-50/80 opacity-75"
												: isDark
													? "bg-blue-950/20 hover:bg-blue-950/40"
													: "bg-blue-50/50 hover:bg-blue-50/90"
										}`}
										key={item.id}
										onClick={() => handleNotificationClick(item)}
									>
										<div className="mt-0.5">{getCategoryIcon(item.category)}</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<h4
													className={`text-xs truncate ${
														isRead
															? "font-semibold text-gray-800 dark:text-gray-300"
															: "font-black text-gray-900 dark:text-white"
													}`}
												>
													{item.title}
												</h4>
												<span className="text-[10px] text-gray-400 shrink-0 font-mono">
													{formatRelativeTime(item.createdAt)}
												</span>
											</div>
											<p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5 leading-snug">
												{item.body}
											</p>
											{item.url && (
												<div className="mt-1 flex items-center gap-1 font-bold text-[10px] text-blue-600 dark:text-blue-400">
													<span>View details</span>
													<ExternalLink className="h-2.5 w-2.5" />
												</div>
											)}
										</div>
										{!isRead && (
											<span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" title="Unread"></span>
										)}
									</div>
								);
							})
						)}
					</div>

					{/* Popover Footer */}
					<div
						className={`flex items-center justify-between border-t p-3 text-[11px] text-gray-500 ${
							isDark ? "border-gray-800 bg-gray-950/40" : "border-gray-100 bg-gray-50/60"
						}`}
					>
						<span>PharmaQL Instant Field Alerts</span>
						<button
							className="flex items-center gap-1 font-bold text-blue-600 hover:underline"
							disabled={isPending}
							onClick={loadNotifications}
							type="button"
						>
							<RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
							<span>Refresh</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
