"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef } from "react";
import {
	Radio,
	Users,
	Laptop,
	Smartphone,
	Tablet,
	Globe,
	Clock,
	LogOut,
	Ban,
	CheckCircle2,
	AlertTriangle,
	Search,
	RefreshCw,
	SlidersHorizontal,
	Eye,
	Copy,
	ExternalLink,
	Shield,
	ShieldAlert,
	Check,
	X,
	Activity,
	MonitorSmartphone,
	Navigation,
} from "lucide-react";
import {
	getLivePresenceDataAction,
	forceLogoutUserSessionAction,
	toggleBlockFromPresenceAction,
	type SessionDisplayItem,
	type PresenceSummaryMetrics,
} from "@/server/actions/presenceActions";

interface DevLivePresenceProps {
	mrList?: Array<{
		id: string;
		name: string;
		email: string;
		division?: string | null;
		company?: string | null;
		rank?: number;
		isBlocked?: boolean;
	}>;
}

export function DevLivePresence({ mrList = [] }: DevLivePresenceProps) {
	const [sessions, setSessions] = useState<SessionDisplayItem[]>([]);
	const [metrics, setMetrics] = useState<PresenceSummaryMetrics>({
		totalActiveNow: 0,
		totalIdle: 0,
		totalOnlineToday: 0,
		mobileCount: 0,
		desktopCount: 0,
		tabletCount: 0,
		roleBreakdown: { mr: 0, admin: 0, developer: 0 },
		topPages: [],
	});

	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [copiedKey, setCopiedKey] = useState<string | null>(null);
	const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

	// Filters & Search
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState<"ALL" | "MR" | "ADMIN" | "DEVELOPER">("ALL");
	const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "idle" | "offline">("ALL");
	const [deviceFilter, setDeviceFilter] = useState<"ALL" | "desktop" | "mobile" | "tablet">("ALL");

	// Auto-Refresh state
	const [refreshInterval, setRefreshInterval] = useState<number>(10000); // 10s by default
	const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

	// Telemetry Inspection Drawer Modal
	const [inspectingSession, setInspectingSession] = useState<SessionDisplayItem | null>(null);

	// Fetch presence data
	const fetchPresence = async (isManual = false) => {
		if (isManual) setIsLoading(true);
		try {
			const res = await getLivePresenceDataAction();
			if (res.success) {
				setSessions(res.sessions);
				setMetrics(res.metrics);
				setLastRefreshedAt(new Date());
			} else if (res.error) {
				console.error("Presence fetch error:", res.error);
			}
		} catch (err) {
			console.error("Failed to load presence:", err);
		} finally {
			setIsLoading(false);
		}
	};

	// Initial fetch
	useEffect(() => {
		fetchPresence();
	}, []);

	// Auto-refresh interval
	useEffect(() => {
		if (refreshInterval <= 0) return;
		const timer = setInterval(() => {
			fetchPresence();
		}, refreshInterval);
		return () => clearInterval(timer);
	}, [refreshInterval]);

	const copyToClipboard = (text: string, key: string) => {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			navigator.clipboard.writeText(text);
			setCopiedKey(key);
			setTimeout(() => setCopiedKey(null), 2000);
		}
	};

	const showFeedback = (type: "success" | "error", text: string) => {
		setActionFeedback({ type, text });
		setTimeout(() => setActionFeedback(null), 4000);
	};

	// Force Logout action
	const handleForceLogout = (session: SessionDisplayItem) => {
		if (
			!confirm(
				`FORCE LOGOUT SESSION?\n\nUser: ${session.userName} (${session.userEmail})\nIP: ${session.clientIp}\nCurrent Page: ${session.currentPage}\n\nTheir active session will be immediately revoked. Continue?`,
			)
		) {
			return;
		}

		startTransition(async () => {
			const res = await forceLogoutUserSessionAction(session.sessionId);
			if (res.success) {
				showFeedback("success", `Session revoked for ${session.userName}. User has been logged out.`);
				if (inspectingSession?.sessionId === session.sessionId) {
					setInspectingSession(null);
				}
				fetchPresence();
			} else {
				showFeedback("error", res.error || "Failed to force logout session");
			}
		});
	};

	// Toggle block status
	const handleToggleBlock = (userId: string, currentBlockState: boolean, userName: string) => {
		const targetState = !currentBlockState;
		const actionWord = targetState ? "BLOCK" : "UNBLOCK";
		if (
			!confirm(
				`${actionWord} MR ACCOUNT?\n\nUser: ${userName}\nTarget state: ${targetState ? "BLOCKED" : "ACTIVE"}\n\n${
					targetState ? "The MR will be immediately logged out and blocked from logging in." : "The MR will be restored."
				}\n\nContinue?`,
			)
		) {
			return;
		}

		startTransition(async () => {
			const res = await toggleBlockFromPresenceAction(userId, targetState);
			if (res.success) {
				showFeedback("success", `MR ${userName} ${targetState ? "blocked and sessions revoked" : "unblocked"}.`);
				fetchPresence();
			} else {
				showFeedback("error", res.error || "Failed to toggle block status");
			}
		});
	};

	// Look up if user is currently blocked in MR master list
	const isUserBlocked = (userId: string) => {
		const mr = mrList.find((m) => m.id === userId);
		return Boolean(mr?.isBlocked);
	};

	// Filtered sessions
	const filteredSessions = useMemo(() => {
		return sessions.filter((s) => {
			// Role filter
			if (roleFilter !== "ALL" && s.role !== roleFilter) return false;

			// Status filter
			if (statusFilter !== "ALL" && s.status !== statusFilter) return false;

			// Device filter
			if (deviceFilter !== "ALL" && s.deviceType !== deviceFilter) return false;

			// Search query
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const matchName = s.userName?.toLowerCase().includes(q);
				const matchEmail = s.userEmail?.toLowerCase().includes(q);
				const matchIp = s.clientIp?.toLowerCase().includes(q);
				const matchPage = s.currentPage?.toLowerCase().includes(q);
				const matchTitle = s.currentTitle?.toLowerCase().includes(q);
				const matchBrowser = s.browser?.toLowerCase().includes(q);
				const matchOs = s.os?.toLowerCase().includes(q);
				const matchDiv = s.division?.toLowerCase().includes(q);
				const matchComp = s.company?.toLowerCase().includes(q);

				if (
					!matchName &&
					!matchEmail &&
					!matchIp &&
					!matchPage &&
					!matchTitle &&
					!matchBrowser &&
					!matchOs &&
					!matchDiv &&
					!matchComp
				) {
					return false;
				}
			}

			return true;
		});
	}, [sessions, roleFilter, statusFilter, deviceFilter, searchQuery]);

	const formatElapsed = (seconds: number) => {
		if (seconds < 15) return "Just now";
		if (seconds < 60) return `${seconds}s ago`;
		const mins = Math.floor(seconds / 60);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		return `${hours}h ${mins % 60}m ago`;
	};

	const getDeviceIcon = (type: string) => {
		switch (type) {
			case "mobile":
				return <Smartphone className="h-4 w-4 text-emerald-600" />;
			case "tablet":
				return <Tablet className="h-4 w-4 text-purple-600" />;
			default:
				return <Laptop className="h-4 w-4 text-blue-600" />;
		}
	};

	return (
		<div className="space-y-6">
			{/* Action Feedback Banner */}
			{actionFeedback && (
				<div
					className={`flex items-center gap-2 rounded-xl p-3.5 font-semibold text-sm shadow-xs ${
						actionFeedback.type === "success"
							? "border border-emerald-200 bg-emerald-50 text-emerald-800"
							: "border border-rose-200 bg-rose-50 text-rose-800"
					}`}
				>
					{actionFeedback.type === "success" ? (
						<CheckCircle2 className="h-5 w-5 text-emerald-600" />
					) : (
						<AlertTriangle className="h-5 w-5 text-rose-600" />
					)}
					<span>{actionFeedback.text}</span>
				</div>
			)}

			{/* KPI Summary Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{/* 1. Active Users Right Now */}
				<div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs transition hover:shadow-md">
					<div className="flex items-center justify-between">
						<div>
							<div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-700">
								<span className="relative flex h-2 w-2">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
									<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
								</span>
								Active Now (&lt; 2m)
							</div>
							<div className="mt-2 font-black text-3xl text-gray-900">{metrics.totalActiveNow}</div>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
							<Radio className="h-6 w-6" />
						</div>
					</div>
					<div className="mt-3 flex items-center gap-2 font-medium text-xs text-gray-500">
						<span className="rounded bg-emerald-100/80 px-1.5 py-0.5 font-semibold text-emerald-800">
							{metrics.roleBreakdown.mr} MRs
						</span>
						<span className="rounded bg-blue-100/80 px-1.5 py-0.5 font-semibold text-blue-800">
							{metrics.roleBreakdown.admin} Admins
						</span>
						<span className="rounded bg-purple-100/80 px-1.5 py-0.5 font-semibold text-purple-800">
							{metrics.roleBreakdown.developer} Devs
						</span>
					</div>
				</div>

				{/* 2. Idle Sessions */}
				<div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white p-5 shadow-xs transition hover:shadow-md">
					<div className="flex items-center justify-between">
						<div>
							<div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-amber-700">
								<span className="h-2 w-2 rounded-full bg-amber-500"></span>
								Idle Sessions (2–15m)
							</div>
							<div className="mt-2 font-black text-3xl text-gray-900">{metrics.totalIdle}</div>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
							<Clock className="h-6 w-6" />
						</div>
					</div>
					<div className="mt-3 text-xs text-gray-500">
						Connected tabs awaiting user interaction
					</div>
				</div>

				{/* 3. Device Form Factors */}
				<div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-white p-5 shadow-xs transition hover:shadow-md">
					<div className="flex items-center justify-between">
						<div>
							<div className="font-bold text-xs uppercase tracking-wider text-blue-700">
								Device Distribution
							</div>
							<div className="mt-2 font-black text-3xl text-gray-900">
								{metrics.desktopCount + metrics.mobileCount + metrics.tabletCount}
							</div>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
							<MonitorSmartphone className="h-6 w-6" />
						</div>
					</div>
					<div className="mt-3 flex items-center gap-3 font-medium text-xs text-gray-600">
						<span className="inline-flex items-center gap-1">
							<Laptop className="h-3.5 w-3.5 text-blue-500" /> {metrics.desktopCount} Desk
						</span>
						<span className="inline-flex items-center gap-1">
							<Smartphone className="h-3.5 w-3.5 text-emerald-500" /> {metrics.mobileCount} Mob
						</span>
						<span className="inline-flex items-center gap-1">
							<Tablet className="h-3.5 w-3.5 text-purple-500" /> {metrics.tabletCount} Tab
						</span>
					</div>
				</div>

				{/* 4. Active Logins Today */}
				<div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-white p-5 shadow-xs transition hover:shadow-md">
					<div className="flex items-center justify-between">
						<div>
							<div className="font-bold text-xs uppercase tracking-wider text-purple-700">
								Recorded In 24h
							</div>
							<div className="mt-2 font-black text-3xl text-gray-900">{metrics.totalOnlineToday}</div>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
							<Users className="h-6 w-6" />
						</div>
					</div>
					<div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
						Auto-pruned after 48h idle
					</div>
				</div>
			</div>

			{/* Top Active Pages Banner */}
			{metrics.topPages.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
					<div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-gray-500">
						<Navigation className="h-3.5 w-3.5 text-purple-600" /> Top Active Pages:
					</div>
					{metrics.topPages.map((tp) => (
						<span
							className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/60 px-2.5 py-1 font-mono text-xs font-semibold text-purple-800"
							key={tp.page}
						>
							<span className="max-w-[200px] truncate">{tp.page}</span>
							<span className="rounded-full bg-purple-200 px-1.5 py-0.2 text-[10px] font-bold text-purple-900">
								{tp.count}
							</span>
						</span>
					))}
				</div>
			)}

			{/* Presence Management Console */}
			<div className="rounded-2xl border border-gray-200 bg-white shadow-xs">
				{/* Header & Controls Toolbar */}
				<div className="flex flex-col gap-4 border-b border-gray-200 p-5 md:flex-row md:items-center md:justify-between">
					<div>
						<h2 className="font-extrabold text-lg text-gray-900">Live Active Sessions</h2>
						<p className="text-xs text-gray-500">
							Real-time telemetry, location, active pages, and immediate session revocation.
						</p>
					</div>

					{/* Auto-Refresh & Manual Controls */}
					<div className="flex flex-wrap items-center gap-2.5">
						<div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs font-medium text-gray-700">
							<span className="px-2 text-gray-500">Refresh:</span>
							<button
								className={`rounded-lg px-2.5 py-1 font-bold transition ${
									refreshInterval === 10000 ? "bg-white text-purple-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
								}`}
								onClick={() => setRefreshInterval(10000)}
								type="button"
							>
								10s
							</button>
							<button
								className={`rounded-lg px-2.5 py-1 font-bold transition ${
									refreshInterval === 30000 ? "bg-white text-purple-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
								}`}
								onClick={() => setRefreshInterval(30000)}
								type="button"
							>
								30s
							</button>
							<button
								className={`rounded-lg px-2.5 py-1 font-bold transition ${
									refreshInterval === 0 ? "bg-white text-rose-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
								}`}
								onClick={() => setRefreshInterval(0)}
								type="button"
							>
								Pause
							</button>
						</div>

						<button
							className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
							disabled={isLoading || isPending}
							onClick={() => fetchPresence(true)}
							type="button"
						>
							<RefreshCw className={`h-3.5 w-3.5 text-purple-600 ${isLoading || isPending ? "animate-spin" : ""}`} />
							Refresh Now
						</button>
					</div>
				</div>

				{/* Filters Bar */}
				<div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50/80 p-4 md:flex-row md:items-center">
					{/* Search Bar */}
					<div className="relative flex-1">
						<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
						<input
							className="w-full rounded-xl border border-gray-200 bg-white py-2 pr-4 pl-9 text-xs text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search by name, email, IP, active page, browser..."
							type="text"
							value={searchQuery}
						/>
						{searchQuery && (
							<button
								className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
								onClick={() => setSearchQuery("")}
								type="button"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						)}
					</div>

					{/* Role Filter */}
					<div className="flex items-center gap-1.5">
						<span className="text-[11px] font-bold uppercase text-gray-500">Role:</span>
						<select
							className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 focus:border-purple-500 focus:outline-none"
							onChange={(e) => setRoleFilter(e.target.value as any)}
							value={roleFilter}
						>
							<option value="ALL">All Roles</option>
							<option value="MR">Medical Rep (MR)</option>
							<option value="ADMIN">Admin</option>
							<option value="DEVELOPER">Developer</option>
						</select>
					</div>

					{/* Status Filter */}
					<div className="flex items-center gap-1.5">
						<span className="text-[11px] font-bold uppercase text-gray-500">Status:</span>
						<select
							className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 focus:border-purple-500 focus:outline-none"
							onChange={(e) => setStatusFilter(e.target.value as any)}
							value={statusFilter}
						>
							<option value="ALL">All Statuses</option>
							<option value="active">🟢 Active Now</option>
							<option value="idle">🟡 Idle (2–15m)</option>
							<option value="offline">⚪ Offline / Inactive</option>
						</select>
					</div>

					{/* Device Filter */}
					<div className="flex items-center gap-1.5">
						<span className="text-[11px] font-bold uppercase text-gray-500">Device:</span>
						<select
							className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 focus:border-purple-500 focus:outline-none"
							onChange={(e) => setDeviceFilter(e.target.value as any)}
							value={deviceFilter}
						>
							<option value="ALL">All Devices</option>
							<option value="desktop">Desktop</option>
							<option value="mobile">Mobile</option>
							<option value="tablet">Tablet</option>
						</select>
					</div>
				</div>

				{/* Table of Live Sessions */}
				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead className="border-b border-gray-200 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-500">
							<tr>
								<th className="px-4 py-3">User & Identity</th>
								<th className="px-4 py-3">Status & Heartbeat</th>
								<th className="px-4 py-3">Active Page & Tab</th>
								<th className="px-4 py-3">Device & Browser</th>
								<th className="px-4 py-3">Client IP</th>
								<th className="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{filteredSessions.length === 0 ? (
								<tr>
									<td className="px-4 py-12 text-center text-gray-600" colSpan={6}>
										<Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
										<p className="font-semibold text-sm text-gray-600">No active sessions match your filters</p>
										<p className="mt-1 text-xs text-gray-400">
											As authenticated users browse the MR and Admin portals, live heartbeats will stream here.
										</p>
									</td>
								</tr>
							) : (
								filteredSessions.map((session) => {
									const blocked = isUserBlocked(session.userId);
									return (
										<tr
											className={`transition hover:bg-purple-50/30 ${
												session.isRevoked ? "bg-rose-50/40 opacity-70" : ""
											}`}
											key={session.sessionId}
										>
											{/* User & Identity */}
											<td className="px-4 py-3.5">
												<div className="flex items-start gap-2.5">
													<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 font-bold text-xs text-gray-700">
														{session.userName?.charAt(0)?.toUpperCase() || "U"}
													</div>
													<div>
														<div className="flex items-center gap-1.5">
															<span className="font-bold text-gray-900">{session.userName}</span>
															{blocked && (
																<span className="rounded bg-rose-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-rose-700">
																	BLOCKED
																</span>
															)}
															{session.isRevoked && (
																<span className="rounded bg-rose-200 px-1.5 py-0.2 font-mono text-[10px] font-bold text-rose-900">
																	REVOKED
																</span>
															)}
														</div>
														<div className="text-[11px] text-gray-500">{session.userEmail}</div>
														<div className="mt-1 flex items-center gap-1.5">
															<span
																className={`rounded px-1.5 py-0.2 font-mono text-[10px] font-bold ${
																	session.role === "DEVELOPER"
																		? "bg-purple-100 text-purple-800"
																		: session.role === "ADMIN"
																			? "bg-blue-100 text-blue-800"
																			: "bg-emerald-100 text-emerald-800"
																}`}
															>
																{session.role}
															</span>
															{session.rank ? (
																<span className="rounded bg-gray-100 px-1 py-0.2 font-mono text-[10px] font-bold text-gray-600">
																	R{session.rank}
																</span>
															) : null}
															{session.division ? (
																<span className="rounded bg-purple-50 px-1 py-0.2 font-semibold text-[10px] text-purple-700">
																	{session.division}
																</span>
															) : null}
														</div>
													</div>
												</div>
											</td>

											{/* Status & Heartbeat */}
											<td className="px-4 py-3.5">
												<div className="space-y-1">
													{session.status === "active" ? (
														<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700">
															<span className="relative flex h-2 w-2">
																<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
																<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
															</span>
															Active Now
														</span>
													) : session.status === "idle" ? (
														<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700">
															<span className="h-2 w-2 rounded-full bg-amber-500"></span>
															Idle
														</span>
													) : (
														<span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600">
															<span className="h-2 w-2 rounded-full bg-gray-400"></span>
															Offline
														</span>
													)}
													<div className="text-[11px] text-gray-500">
														{formatElapsed(session.idleSeconds)}
													</div>
												</div>
											</td>

											{/* Active Page & Tab */}
											<td className="px-4 py-3.5">
												<div className="max-w-[240px] space-y-0.5">
													{session.currentTitle ? (
														<div className="truncate font-semibold text-gray-800" title={session.currentTitle}>
															{session.currentTitle}
														</div>
													) : null}
													<div
														className="truncate font-mono text-[11px] text-purple-700 hover:underline cursor-pointer"
														onClick={() => copyToClipboard(session.currentPage, `url_${session.sessionId}`)}
														title={`Click to copy: ${session.currentPage}`}
													>
														{session.currentPage}
													</div>
													{copiedKey === `url_${session.sessionId}` && (
														<span className="text-[10px] font-bold text-emerald-600">Copied!</span>
													)}
												</div>
											</td>

											{/* Device & Browser */}
											<td className="px-4 py-3.5">
												<div className="flex items-center gap-2">
													<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100">
														{getDeviceIcon(session.deviceType)}
													</div>
													<div>
														<div className="font-semibold text-gray-800">{session.browser}</div>
														<div className="text-[11px] text-gray-500">
															{session.os}
															{session.screenResolution ? ` • ${session.screenResolution}` : ""}
														</div>
													</div>
												</div>
											</td>

											{/* Client IP */}
											<td className="px-4 py-3.5">
												<div className="flex items-center gap-1 font-mono text-[11px] text-gray-700">
													<span>{session.clientIp}</span>
													<button
														className="text-gray-400 hover:text-gray-700"
														onClick={() => copyToClipboard(session.clientIp, `ip_${session.sessionId}`)}
														title="Copy IP"
														type="button"
													>
														{copiedKey === `ip_${session.sessionId}` ? (
															<Check className="h-3 w-3 text-emerald-600" />
														) : (
															<Copy className="h-3 w-3" />
														)}
													</button>
												</div>
											</td>

											{/* Action Buttons */}
											<td className="px-4 py-3.5 text-right">
												<div className="flex items-center justify-end gap-1.5">
													{/* Inspect Drawer Button */}
													<button
														className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 shadow-xs hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
														onClick={() => setInspectingSession(session)}
														title="Inspect Full Telemetry"
														type="button"
													>
														<Eye className="h-3.5 w-3.5" />
													</button>

													{/* Block/Unblock Button (For MRs) */}
													{session.role === "MR" && (
														<button
															className={`rounded-lg border p-1.5 shadow-xs transition ${
																blocked
																	? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
																	: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
															}`}
															disabled={isPending}
															onClick={() => handleToggleBlock(session.userId, blocked, session.userName)}
															title={blocked ? "Unblock MR Account" : "Block MR Account"}
															type="button"
														>
															<Ban className="h-3.5 w-3.5" />
														</button>
													)}

													{/* Force Logout Button */}
													<button
														className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 font-bold text-[11px] text-rose-700 shadow-xs transition hover:bg-rose-100 hover:border-rose-300"
														disabled={isPending || session.isRevoked}
														onClick={() => handleForceLogout(session)}
														title="Immediately terminate this session"
														type="button"
													>
														<LogOut className="h-3 w-3" />
														<span>Force Logout</span>
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Table Footer */}
				<div className="flex flex-col gap-2 border-t border-gray-200 p-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
					<div>
						Showing <span className="font-bold text-gray-800">{filteredSessions.length}</span> of{" "}
						<span className="font-bold text-gray-800">{sessions.length}</span> total sessions
					</div>
					<div className="font-mono text-[11px]">
						Last synchronized: {lastRefreshedAt.toLocaleTimeString()}
					</div>
				</div>
			</div>

			{/* Telemetry Inspection Drawer Modal */}
			{inspectingSession && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
					<div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
						{/* Modal Header */}
						<div className="flex items-start justify-between border-b border-gray-200 pb-4">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
									<Activity className="h-5 w-5" />
								</div>
								<div>
									<h3 className="font-black text-lg text-gray-900">Session Telemetry Inspection</h3>
									<p className="text-xs text-gray-500 font-mono">{inspectingSession.sessionId}</p>
								</div>
							</div>
							<button
								className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
								onClick={() => setInspectingSession(null)}
								type="button"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						{/* Modal Content */}
						<div className="mt-5 space-y-4 text-xs">
							{/* User Identity Section */}
							<div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4">
								<div className="font-bold uppercase tracking-wider text-[10px] text-gray-400 mb-2">
									User Identity & Access
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<span className="text-gray-500">Name:</span>{" "}
										<span className="font-bold text-gray-900">{inspectingSession.userName}</span>
									</div>
									<div>
										<span className="text-gray-500">Email:</span>{" "}
										<span className="font-bold text-gray-900">{inspectingSession.userEmail}</span>
									</div>
									<div>
										<span className="text-gray-500">User ID:</span>{" "}
										<span className="font-mono text-gray-700">{inspectingSession.userId}</span>
									</div>
									<div>
										<span className="text-gray-500">Role:</span>{" "}
										<span className="font-bold text-purple-700">{inspectingSession.role}</span>
										{inspectingSession.rank ? ` (Rank ${inspectingSession.rank})` : ""}
									</div>
									{inspectingSession.division && (
										<div>
											<span className="text-gray-500">Division:</span>{" "}
											<span className="font-semibold text-gray-800">{inspectingSession.division}</span>
										</div>
									)}
									{inspectingSession.company && (
										<div>
											<span className="text-gray-500">Company:</span>{" "}
											<span className="font-semibold text-gray-800">{inspectingSession.company}</span>
										</div>
									)}
								</div>
							</div>

							{/* Client Environment Section */}
							<div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4">
								<div className="font-bold uppercase tracking-wider text-[10px] text-gray-400 mb-2">
									Client Device & Network
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<span className="text-gray-500">Browser:</span>{" "}
										<span className="font-bold text-gray-900">{inspectingSession.browser}</span>
									</div>
									<div>
										<span className="text-gray-500">Operating System:</span>{" "}
										<span className="font-bold text-gray-900">{inspectingSession.os}</span>
									</div>
									<div>
										<span className="text-gray-500">Device Type:</span>{" "}
										<span className="font-bold uppercase text-blue-700">{inspectingSession.deviceType}</span>
									</div>
									<div>
										<span className="text-gray-500">Screen Resolution:</span>{" "}
										<span className="font-mono text-gray-700">{inspectingSession.screenResolution || "N/A"}</span>
									</div>
									<div>
										<span className="text-gray-500">Resolved Client IP:</span>{" "}
										<span className="font-mono font-bold text-gray-900">{inspectingSession.clientIp}</span>
									</div>
									<div>
										<span className="text-gray-500">Real-Time Status:</span>{" "}
										<span
											className={`font-bold ${
												inspectingSession.status === "active"
													? "text-emerald-700"
													: inspectingSession.status === "idle"
														? "text-amber-700"
														: "text-gray-600"
											}`}
										>
											{inspectingSession.status.toUpperCase()} ({formatElapsed(inspectingSession.idleSeconds)})
										</span>
									</div>
								</div>
							</div>

							{/* Navigation & Presence Section */}
							<div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4">
								<div className="font-bold uppercase tracking-wider text-[10px] text-gray-400 mb-2">
									Active Navigation & Timestamps
								</div>
								<div className="space-y-2">
									<div>
										<span className="text-gray-500">Current URL Path:</span>
										<div className="mt-1 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2 font-mono text-[11px] text-purple-800">
											<span className="break-all">{inspectingSession.currentPage}</span>
											<button
												className="ml-2 shrink-0 text-gray-400 hover:text-gray-700"
												onClick={() => copyToClipboard(inspectingSession.currentPage, "inspect_url")}
												type="button"
											>
												{copiedKey === "inspect_url" ? (
													<Check className="h-3.5 w-3.5 text-emerald-600" />
												) : (
													<Copy className="h-3.5 w-3.5" />
												)}
											</button>
										</div>
									</div>
									{inspectingSession.currentTitle && (
										<div>
											<span className="text-gray-500">Page Document Title:</span>{" "}
											<span className="font-medium text-gray-900">{inspectingSession.currentTitle}</span>
										</div>
									)}
									<div className="grid grid-cols-2 gap-3 pt-1">
										<div>
											<span className="text-gray-500">First Seen:</span>{" "}
											<span className="font-mono text-gray-700">
												{new Date(inspectingSession.firstSeen).toLocaleString()}
											</span>
										</div>
										<div>
											<span className="text-gray-500">Last Heartbeat:</span>{" "}
											<span className="font-mono text-gray-700">
												{new Date(inspectingSession.lastHeartbeat).toLocaleString()}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Modal Footer Actions */}
						<div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
							<button
								className="rounded-xl border border-gray-200 bg-white px-4 py-2 font-bold text-xs text-gray-600 hover:bg-gray-50"
								onClick={() => setInspectingSession(null)}
								type="button"
							>
								Close
							</button>

							<div className="flex items-center gap-2">
								{inspectingSession.role === "MR" && (
									<button
										className={`rounded-xl px-3.5 py-2 font-bold text-xs shadow-xs transition ${
											isUserBlocked(inspectingSession.userId)
												? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
												: "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
										}`}
										disabled={isPending}
										onClick={() =>
											handleToggleBlock(
												inspectingSession.userId,
												isUserBlocked(inspectingSession.userId),
												inspectingSession.userName,
											)
										}
										type="button"
									>
										{isUserBlocked(inspectingSession.userId) ? "Unblock Account" : "Block MR Account"}
									</button>
								)}

								<button
									className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-600 px-4 py-2 font-bold text-xs text-white shadow-xs transition hover:bg-rose-700"
									disabled={isPending || inspectingSession.isRevoked}
									onClick={() => handleForceLogout(inspectingSession)}
									type="button"
								>
									<LogOut className="h-4 w-4" />
									Force Logout Session
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
