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
				return (
					<span
						className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${
							isDark
								? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
								: "bg-rose-100 text-rose-700 border border-rose-200"
						}`}
					>
						<AlertTriangle className="h-3.5 w-3.5" />
					</span>
				);
			case "NOTICE":
				return (
					<span
						className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${
							isDark
								? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
								: "bg-blue-100 text-blue-700 border border-blue-200"
						}`}
					>
						<Megaphone className="h-3.5 w-3.5" />
					</span>
				);
			case "SUBSCRIPTION":
				return (
					<span
						className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${
							isDark
								? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
								: "bg-purple-100 text-purple-700 border border-purple-200"
						}`}
					>
						<ShieldAlert className="h-3.5 w-3.5" />
					</span>
				);
			default:
				return (
					<span
						className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${
							isDark
								? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
								: "bg-sky-100 text-sky-700 border border-sky-200"
						}`}
					>
						<Info className="h-3.5 w-3.5" />
					</span>
				);
		}
	};

	return (
		<div className={`relative ${className}`} ref={popoverRef}>
			{/* Bell Button with Unread Badge */}
			<button
				aria-label="View notifications and alerts"
				className={
					buttonClassName ||
					`relative flex h-8.5 w-8.5 items-center justify-center rounded-lg border transition ${
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
					<span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 font-mono text-[9px] font-black text-white shadow-xs animate-pulse ring-2 ring-white dark:ring-gray-900">
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
					} mt-2 z-[100] w-[calc(100vw-2rem)] sm:w-96 max-w-sm sm:max-w-md max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl transition-all ${
						isDark
							? "border-gray-700 bg-gray-900 text-white shadow-black/60"
							: "border-gray-200 bg-white text-gray-900 shadow-slate-900/10"
					}`}
				>
					{/* Popover Header */}
					<div
						className={`flex items-center justify-between border-b px-4 py-3.5 ${
							isDark ? "border-gray-800 bg-gray-950/60" : "border-gray-100 bg-gray-50/70"
						}`}
					>
						<div className="flex items-center gap-2">
							<h3
								className={`font-black text-sm tracking-tight ${
									isDark ? "text-white" : "text-[#0B2545]"
								}`}
							>
								Alerts &amp; Notices
							</h3>
							{unreadCount > 0 && (
								<span
									className={`rounded-full px-2 py-0.5 font-bold text-[10px] ${
										isDark
											? "border border-blue-500/40 bg-blue-500/20 text-blue-300"
											: "border border-rose-500/20 bg-rose-50 text-rose-600"
									}`}
								>
									{unreadCount} new
								</span>
							)}
						</div>
						<div className="flex items-center gap-1.5">
							{unreadCount > 0 && (
								<button
									className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
										isDark
											? "border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
											: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 hover:text-[#0B2545]"
									}`}
									disabled={isPending}
									onClick={handleMarkAllRead}
									title="Mark all as read"
									type="button"
								>
									<CheckCheck className="h-3.5 w-3.5 text-blue-400" />
									<span>Read All</span>
								</button>
							)}
							<button
								aria-label="Close notification panel"
								className={`rounded-lg p-1.5 transition ${
									isDark
										? "text-gray-400 hover:bg-gray-800 hover:text-white"
										: "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
								}`}
								onClick={() => setIsOpen(false)}
								type="button"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>

					{/* Feedback Banner */}
					{statusFeedback && (
						<div
							className={`border-b px-4 py-2 text-xs font-semibold ${
								isDark
									? "border-blue-900/50 bg-blue-950/70 text-blue-200"
									: "border-blue-200 bg-blue-50 text-blue-900"
							}`}
						>
							{statusFeedback}
						</div>
					)}

					{/* Push Notification Permission Card */}
					<div
						className={`border-b p-3.5 ${
							isDark ? "border-gray-800 bg-gray-950/40" : "border-gray-100 bg-gray-50/50"
						}`}
					>
						{pushPermission === "granted" && isSubscribed ? (
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<span className="relative flex h-2 w-2">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
										<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
									</span>
									<span
										className={`text-xs font-bold ${
											isDark ? "text-emerald-400" : "text-emerald-700"
										}`}
									>
										Device Push Active
									</span>
								</div>
								<button
									className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
										isDark
											? "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
											: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
									}`}
									disabled={isPending}
									onClick={handleSendTestPush}
									type="button"
								>
									Send Test Alert
								</button>
							</div>
						) : pushPermission === "denied" ? (
							<div
								className={`flex items-center gap-2 text-xs font-semibold ${
									isDark ? "text-amber-300" : "text-amber-800"
								}`}
							>
								<AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
								<span>Push notifications blocked in browser settings.</span>
							</div>
						) : pushPermission === "unsupported" ? (
							<div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
								Web push is not supported on this browser.
							</div>
						) : (
							<div className="flex flex-col gap-2">
								<div className="flex items-start gap-2">
									<Sparkles className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
									<p
										className={`text-xs font-medium leading-relaxed ${
											isDark ? "text-gray-200" : "text-gray-700"
										}`}
									>
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
					<div
						className={`max-h-80 overflow-y-auto divide-y ${
							isDark ? "divide-gray-800/80" : "divide-gray-100"
						}`}
					>
						{notifications.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-10 px-4 text-center">
								<div
									className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-3 ${
										isDark ? "bg-gray-800 text-blue-400" : "bg-blue-50 text-blue-600"
									}`}
								>
									<Bell className="h-6 w-6 opacity-70" />
								</div>
								<p
									className={`font-bold text-sm ${
										isDark ? "text-white" : "text-[#0B2545]"
									}`}
								>
									You're all caught up!
								</p>
								<p
									className={`text-xs mt-1 ${
										isDark ? "text-gray-400" : "text-gray-500"
									}`}
								>
									No unread notifications or field alerts.
								</p>
							</div>
						) : (
							notifications.map((item) => {
								const isRead = item.readBy.length > 0;
								return (
									<div
										className={`group flex items-start gap-3 p-3.5 transition cursor-pointer ${
											isRead
												? isDark
													? "bg-transparent hover:bg-gray-800/50"
													: "bg-transparent hover:bg-gray-50/80"
												: isDark
													? "bg-blue-950/40 hover:bg-blue-950/60 border-l-4 border-l-[#38BDF8]"
													: "bg-blue-50/60 hover:bg-blue-50/90 border-l-4 border-l-[#0071BC]"
										}`}
										key={item.id}
										onClick={() => handleNotificationClick(item)}
									>
										<div className="mt-0.5 shrink-0">{getCategoryIcon(item.category)}</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<h4
													className={`text-xs truncate ${
														isRead
															? isDark
																? "font-semibold text-gray-300"
																: "font-semibold text-gray-800"
															: isDark
																? "font-bold text-white"
																: "font-black text-[#0B2545]"
													}`}
												>
													{item.title}
												</h4>
												<span
													className={`text-[10px] shrink-0 font-mono ${
														isDark ? "text-gray-400" : "text-gray-500"
													}`}
												>
													{formatRelativeTime(item.createdAt)}
												</span>
											</div>
											<p
												className={`text-xs line-clamp-2 mt-0.5 leading-snug ${
													isRead
														? isDark
															? "text-gray-400"
															: "text-gray-500"
														: isDark
															? "text-gray-200"
															: "text-gray-700"
												}`}
											>
												{item.body}
											</p>
											{item.url && (
												<div
													className={`mt-1.5 flex items-center gap-1 font-bold text-[10px] ${
														isDark
															? "text-[#38BDF8] hover:text-white"
															: "text-[#0071BC] hover:text-[#005a96]"
													}`}
												>
													<span>View details</span>
													<ExternalLink className="h-2.5 w-2.5" />
												</div>
											)}
										</div>
										{!isRead && (
											<span
												className="h-2 w-2 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8] shrink-0 mt-1.5"
												title="Unread"
											></span>
										)}
									</div>
								);
							})
						)}
					</div>

					{/* Popover Footer */}
					<div
						className={`flex items-center justify-between border-t px-4 py-3 text-[11px] ${
							isDark
								? "border-gray-800 bg-gray-950/80 text-gray-400"
								: "border-gray-100 bg-gray-50/70 text-gray-600"
						}`}
					>
						<span className="font-medium">PharmaQL Field Telemetry</span>
						<button
							className={`flex items-center gap-1 font-bold transition ${
								isDark
									? "text-blue-400 hover:text-blue-300"
									: "text-[#0071BC] hover:text-[#005a96]"
							}`}
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
