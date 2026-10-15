"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
	Activity,
	AlertOctagon,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	Clock,
	Cpu,
	Database,
	Download,
	Eye,
	HardDrive,
	Key,
	Lock,
	Mail,
	Play,
	Power,
	RefreshCw,
	Search,
	Server,
	Shield,
	Terminal,
	ToggleLeft,
	ToggleRight,
	Trash2,
	Users,
	Wrench,
	XCircle,
} from "lucide-react";
import type { LicenseStatusResult } from "@/lib/license";
import type { FeatureKey, FeatureScope, MaintenanceConfig } from "@/lib/maintenance";
import type { RuntimeConfig } from "@/lib/runtime-config";
import {
	type ServiceHealthReport,
	type UnifiedLogRecord,
	executeProcedureSandbox,
	flushAllRateLimits,
	flushMasterDataCaches,
	saveLicenseConfigAction,
	suspendPlatformUsageAction,
	forceExpireSubscriptionAction,
	restorePlatformUsageAction,
	triggerSubscriptionReminderEmails,
	saveFeatureToggleAction,
	saveMaintenanceConfigAction,
	saveRuntimeConfigAction,
} from "@/server/actions/devDiagnostics";
import { startMrImpersonation } from "@/server/actions/impersonation";

interface DevControlCenterProps {
	healthReport: ServiceHealthReport;
	licenseStatus: LicenseStatusResult;
	featureToggles: Record<FeatureKey, FeatureScope>;
	maintenanceConfig: MaintenanceConfig;
	runtimeConfig: RuntimeConfig;
	maskedEnv: Record<string, any>;
	initialLogs: UnifiedLogRecord[];
	mrList: Array<{
		id: string;
		name: string;
		email: string;
		division?: string | null;
		company?: string | null;
		rank?: number;
	}>;
}

export function DevControlCenter({
	healthReport: initialHealth,
	licenseStatus: initialLicense,
	featureToggles: initialToggles,
	maintenanceConfig: initialMaintenance,
	runtimeConfig: initialRuntime,
	maskedEnv,
	initialLogs,
	mrList,
}: DevControlCenterProps) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<
		"status" | "license" | "toggles" | "impersonate" | "logs" | "query" | "runtime"
	>("status");

	const [isPending, startTransition] = useTransition();
	const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

	// License state
	const [license, setLicense] = useState(initialLicense);
	const [extensionDays, setExtensionDays] = useState<number>(365);
	const [customExpiry, setCustomExpiry] = useState<string>(initialLicense.expiresAt.slice(0, 10));
	const [adminEmailsStr, setAdminEmailsStr] = useState<string>(initialLicense.adminEmails.join(", "));
	const [customRenewalNote, setCustomRenewalNote] = useState<string>("");

	// Maintenance state
	const [maintenance, setMaintenance] = useState(initialMaintenance);
	const [toggles, setToggles] = useState(initialToggles);

	// Runtime config state
	const [runtime, setRuntime] = useState(initialRuntime);

	// Query sandbox state
	const [selectedProcedure, setSelectedProcedure] = useState("rptStockMovementStatement");
	const [sandboxFromDate, setSandboxFromDate] = useState("2026-04-01");
	const [sandboxToDate, setSandboxToDate] = useState("2026-09-30");
	const [sandboxCompanyCode, setSandboxCompanyCode] = useState("");
	const [sandboxResult, setSandboxResult] = useState<any>(null);

	// Impersonation state
	const [mrSearch, setMrSearch] = useState("");

	// Logs state
	const [logs, setLogs] = useState(initialLogs);
	const [logQuery, setLogQuery] = useState("");
	const [logLevel, setLogLevel] = useState("ALL");

	const showFeedback = (type: "success" | "error", text: string) => {
		setFeedbackMsg({ type, text });
		setTimeout(() => setFeedbackMsg(null), 5000);
	};

	// 1. License Handlers
	const handleExtendLicense = (days: number) => {
		startTransition(async () => {
			const currentExpiry = new Date(license.expiresAt).getTime();
			const newExpiry = new Date(Math.max(Date.now(), currentExpiry) + days * 24 * 60 * 60 * 1000).toISOString();
			const updated = await saveLicenseConfigAction({ expiresAt: newExpiry });
			setLicense((prev) => ({
				...prev,
				expiresAt: updated.expiresAt,
				daysRemaining: Math.ceil((new Date(updated.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
				isBlocked: false,
				status: "ACTIVE",
			}));
			showFeedback("success", `Subscription extended by ${days} days until ${newExpiry.slice(0, 10)}.`);
			router.refresh();
		});
	};

	const handleSaveCustomExpiry = () => {
		startTransition(async () => {
			const newExpiry = new Date(`${customExpiry}T23:59:59.000Z`).toISOString();
			const updated = await saveLicenseConfigAction({ expiresAt: newExpiry });
			setLicense((prev) => ({
				...prev,
				expiresAt: updated.expiresAt,
				daysRemaining: Math.ceil((new Date(updated.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
				isBlocked: false,
				status: "ACTIVE",
			}));
			showFeedback("success", `Subscription expiration updated to ${customExpiry}.`);
			router.refresh();
		});
	};

	const handleToggleKillswitch = () => {
		const nextState = !license.killswitchActive;
		if (nextState && !confirm("WARNING: Activating the emergency killswitch will immediately block access for ALL MRs and standard Admins. Continue?")) {
			return;
		}
		startTransition(async () => {
			await saveLicenseConfigAction({ killswitchActive: nextState });
			setLicense((prev) => ({ ...prev, killswitchActive: nextState, isBlocked: nextState }));
			showFeedback(nextState ? "error" : "success", nextState ? "Emergency killswitch ACTIVATED. Platform access frozen." : "Emergency killswitch deactivated. Platform access restored.");
			router.refresh();
		});
	};

	const handleSuspendUsageImmediately = () => {
		if (
			!confirm(
				"SUSPEND PLATFORM USAGE NOW?\n\nThis will immediately place software usage on hold due to subscription renewal requirement.\nStandard Admins and MRs will be blocked instantly platform-wide.\n\nContinue?",
			)
		) {
			return;
		}
		startTransition(async () => {
			const updated = await suspendPlatformUsageAction();
			setLicense((prev) => ({
				...prev,
				status: "SUSPENDED",
				killswitchActive: true,
				isBlocked: true,
				reason: "Software access has been suspended due to subscription renewal requirement.",
			}));
			showFeedback(
				"error",
				"Platform usage has been SUSPENDED immediately due to subscription. MRs and standard Admins are blocked.",
			);
			router.refresh();
		});
	};

	const handleForceExpireSubscription = () => {
		if (
			!confirm(
				"FORCE SUBSCRIPTION EXPIRED?\n\nThis will set the subscription date into the past and mark it EXPIRED, testing lockout enforcement for all standard users.\n\nContinue?",
			)
		) {
			return;
		}
		startTransition(async () => {
			const updated = await forceExpireSubscriptionAction();
			setLicense((prev) => ({
				...prev,
				status: "EXPIRED",
				killswitchActive: false,
				expiresAt: updated.expiresAt,
				daysRemaining: -30,
				isBlocked: true,
				reason: "Software subscription expired. Grace period elapsed.",
			}));
			showFeedback(
				"error",
				"Subscription status set to EXPIRED. Platform lock screen activated.",
			);
			router.refresh();
		});
	};

	const handleRestoreActiveAccess = () => {
		startTransition(async () => {
			const updated = await restorePlatformUsageAction();
			const daysRemaining = Math.ceil(
				(new Date(updated.expiresAt).getTime() - Date.now()) /
					(1000 * 60 * 60 * 24),
			);
			setLicense((prev) => ({
				...prev,
				status: "ACTIVE",
				killswitchActive: false,
				expiresAt: updated.expiresAt,
				daysRemaining,
				isBlocked: false,
				reason: undefined,
			}));
			showFeedback(
				"success",
				"Platform access RESTORED! Subscription is now ACTIVE and all users are unblocked.",
			);
			router.refresh();
		});
	};

	const handleSaveAdminEmails = () => {
		startTransition(async () => {
			const emails = adminEmailsStr.split(",").map((e) => e.trim()).filter(Boolean);
			await saveLicenseConfigAction({ adminEmails: emails });
			setLicense((prev) => ({ ...prev, adminEmails: emails }));
			showFeedback("success", "Admin notification recipients saved.");
		});
	};

	const handleSendRenewalEmails = () => {
		startTransition(async () => {
			const res = await triggerSubscriptionReminderEmails(customRenewalNote);
			if (res.success) {
				showFeedback("success", res.message);
				setCustomRenewalNote("");
			} else {
				showFeedback("error", res.message);
			}
		});
	};

	// 2. Maintenance & Feature Switchboard Handlers
	const handleSaveMaintenance = () => {
		startTransition(async () => {
			const updated = await saveMaintenanceConfigAction(maintenance);
			setMaintenance(updated);
			showFeedback("success", "Global maintenance settings updated.");
			router.refresh();
		});
	};

	const handleToggleFeature = (key: FeatureKey, scope: FeatureScope) => {
		startTransition(async () => {
			const next = await saveFeatureToggleAction(key, scope);
			setToggles(next);
			showFeedback("success", `Feature ${key.toUpperCase()} set to ${scope}.`);
		});
	};

	// 3. Runtime Config Handler
	const handleSaveRuntime = () => {
		startTransition(async () => {
			const updated = await saveRuntimeConfigAction(runtime);
			setRuntime(updated);
			showFeedback("success", "Runtime configuration saved successfully.");
		});
	};

	// 4. Cache & Rate Limits
	const handleFlushRateLimits = () => {
		startTransition(async () => {
			const res = await flushAllRateLimits();
			showFeedback("success", res.message);
		});
	};

	const handleFlushCache = () => {
		startTransition(async () => {
			const res = await flushMasterDataCaches();
			showFeedback("success", res.message);
		});
	};

	// 5. Impersonation
	const handleStartImpersonate = (mrId: string) => {
		startTransition(async () => {
			const res = await startMrImpersonation(mrId);
			if (res.success) {
				router.push("/dashboard");
				router.refresh();
			} else {
				showFeedback("error", res.error || "Failed to start simulation");
			}
		});
	};

	// 6. Query Sandbox
	const handleRunSandbox = () => {
		startTransition(async () => {
			const res = await executeProcedureSandbox({
				procedureName: selectedProcedure,
				params: {
					fromDate: sandboxFromDate,
					toDate: sandboxToDate,
					companyCode: sandboxCompanyCode,
					locNo: "11",
				},
			});
			setSandboxResult(res);
		});
	};

	// Filter MRs
	const filteredMRs = mrList.filter((m) => {
		if (!mrSearch.trim()) return true;
		const q = mrSearch.toLowerCase();
		return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q));
	});

	// Filter logs
	const filteredLogs = logs.filter((l) => {
		if (logLevel !== "ALL" && l.level !== logLevel) return false;
		if (logQuery.trim()) {
			const q = logQuery.toLowerCase();
			return (
				l.event.toLowerCase().includes(q) ||
				l.ip.toLowerCase().includes(q) ||
				(l.user && l.user.toLowerCase().includes(q)) ||
				JSON.stringify(l.details || {}).toLowerCase().includes(q)
			);
		}
		return true;
	});

	return (
		<div className="space-y-6 text-gray-900">
			{/* Top Bar Banner */}
			<div className="flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-center md:justify-between">
				<div>
					<div className="flex items-center gap-2.5">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600">
							<Terminal className="h-6 w-6" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="font-black text-2xl tracking-tight text-gray-900 md:text-3xl">
									Developer Control Center
								</h1>
								<span className="rounded-md border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 font-mono text-xs font-bold text-purple-700">
									DEVELOPER ONLY
								</span>
							</div>
							<p className="mt-0.5 text-xs font-medium text-gray-500">
								Software subscription management, service switchboard, diagnostics, and simulation engine.
							</p>
						</div>
					</div>
				</div>

				{/* Quick Action Badges */}
				<div className="flex flex-wrap items-center gap-2">
					<button
						className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
						disabled={isPending}
						onClick={handleFlushRateLimits}
						type="button"
					>
						<RefreshCw className={`h-3.5 w-3.5 text-amber-600 ${isPending ? "animate-spin" : ""}`} />
						Flush Rate Limits
					</button>

					<button
						className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
						disabled={isPending}
						onClick={handleFlushCache}
						type="button"
					>
						<Database className="h-3.5 w-3.5 text-blue-600" />
						Flush Caches
					</button>

					<button
						className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-xs transition ${
							license.killswitchActive
								? "bg-rose-600 text-white hover:bg-rose-700"
								: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
						}`}
						disabled={isPending}
						onClick={handleToggleKillswitch}
						type="button"
					>
						<Power className="h-3.5 w-3.5" />
						{license.killswitchActive ? "Killswitch ACTIVE (Unlock)" : "Emergency Killswitch"}
					</button>
				</div>
			</div>

			{/* Feedback Notification */}
			{feedbackMsg && (
				<div
					className={`flex items-center gap-2 rounded-xl p-3.5 font-semibold text-sm shadow-xs ${
						feedbackMsg.type === "success"
							? "border border-emerald-200 bg-emerald-50 text-emerald-800"
							: "border border-rose-200 bg-rose-50 text-rose-800"
					}`}
				>
					{feedbackMsg.type === "success" ? (
						<CheckCircle2 className="h-5 w-5 text-emerald-600" />
					) : (
						<AlertOctagon className="h-5 w-5 text-rose-600" />
					)}
					<span>{feedbackMsg.text}</span>
				</div>
			)}

			{/* Tab Navigation Navigation */}
			<div className="flex overflow-x-auto border-b border-gray-200 pb-px">
				{[
					{ id: "status", label: "Services Status", icon: Activity },
					{ id: "license", label: "Subscription & License", icon: Key },
					{ id: "toggles", label: "Feature Switchboard", icon: Wrench },
					{ id: "impersonate", label: "MR Impersonation", icon: Users },
					{ id: "logs", label: "Unified Logs", icon: HardDrive },
					{ id: "query", label: "Procedure Sandbox", icon: Play },
					{ id: "runtime", label: "Runtime Config", icon: Server },
				].map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-bold text-sm transition-all ${
								isActive
									? "border-purple-600 text-purple-600"
									: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
							}`}
							key={tab.id}
							onClick={() => setActiveTab(tab.id as any)}
							type="button"
						>
							<Icon className="h-4 w-4" />
							<span>{tab.label}</span>
						</button>
					);
				})}
			</div>

			{/* TAB 1: SERVICES STATUS & TELEMETRY */}
			{activeTab === "status" && (
				<div className="space-y-6">
					{/* Status Overview Card */}
					<div
						className={`flex items-center justify-between rounded-2xl border p-5 shadow-xs ${
							initialHealth.overallStatus === "HEALTHY"
								? "border-emerald-200 bg-emerald-50/60"
								: initialHealth.overallStatus === "DEGRADED"
									? "border-amber-200 bg-amber-50/60"
									: "border-rose-200 bg-rose-50/60"
						}`}
					>
						<div className="flex items-center gap-3">
							<div
								className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold ${
									initialHealth.overallStatus === "HEALTHY"
										? "bg-emerald-600 text-white"
										: "bg-rose-600 text-white"
								}`}
							>
								<Activity className="h-6 w-6" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h2 className="font-extrabold text-lg text-gray-900">
										Overall System Health: {initialHealth.overallStatus}
									</h2>
								</div>
								<p className="text-xs text-gray-600">
									All background services, connection pools, and database latencies evaluated at{" "}
									{new Date(initialHealth.timestamp).toLocaleTimeString()}.
								</p>
							</div>
						</div>
						<button
							className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 font-bold text-xs text-gray-700 shadow-xs hover:bg-gray-50"
							onClick={() => router.refresh()}
							type="button"
						>
							Refresh Telemetry
						</button>
					</div>

					{/* Subscription Status & Immediate Suspension Control Banner */}
					<div
						className={`rounded-2xl border p-5 shadow-xs transition-all ${
							license.isBlocked
								? "border-rose-300 bg-rose-50/70"
								: "border-purple-200 bg-white"
						}`}
					>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-start gap-3">
								<div
									className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
										license.isBlocked
											? "bg-rose-600 text-white shadow-rose-200"
											: "bg-purple-600 text-white shadow-purple-200"
									}`}
								>
									{license.isBlocked ? (
										<AlertOctagon className="h-6 w-6 animate-pulse" />
									) : (
										<Shield className="h-6 w-6" />
									)}
								</div>
								<div>
									<div className="flex items-center gap-2">
										<h3 className="font-extrabold text-base text-gray-900">
											Subscription & Platform Access:{" "}
											<span
												className={
													license.isBlocked
														? "text-rose-600 font-black"
														: "text-emerald-700 font-black"
												}
											>
												{license.status}
											</span>
										</h3>
										<span
											className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
												license.isBlocked
													? "bg-rose-100 text-rose-800"
													: "bg-emerald-100 text-emerald-800"
											}`}
										>
											{license.isBlocked
												? "LOCKOUT ACTIVE (MRs & Admins Blocked)"
												: `${license.daysRemaining} days remaining`}
										</span>
									</div>
									<p className="mt-1 text-xs text-gray-600">
										{license.isBlocked
											? license.reason ||
												"Platform usage is currently suspended due to subscription renewal requirement. Standard Admins and MRs are locked out."
											: `Software license for ${license.organization} is valid and operational. Expiration date: ${new Date(
													license.expiresAt,
												).toLocaleDateString("en-IN", {
													day: "numeric",
													month: "short",
													year: "numeric",
												})}.`}
									</p>
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-2 sm:self-center">
								{license.isBlocked ? (
									<button
										className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-xs text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-emerald-200"
										disabled={isPending}
										onClick={handleRestoreActiveAccess}
										type="button"
									>
										<CheckCircle2 className="h-4 w-4" />
										Restore Platform Access (Unblock All)
									</button>
								) : (
									<button
										className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 font-bold text-xs text-white shadow-sm transition hover:bg-rose-700 hover:shadow-rose-200"
										disabled={isPending}
										onClick={handleSuspendUsageImmediately}
										type="button"
									>
										<AlertOctagon className="h-4 w-4" />
										Suspend Usage Due to Subscription Right Now
									</button>
								)}

								<a
									className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 font-bold text-xs text-gray-700 shadow-xs hover:bg-gray-50"
									href="/license-expired"
									rel="noreferrer"
									target="_blank"
								>
									<Eye className="h-3.5 w-3.5 text-gray-500" />
									Preview Lock Screen
								</a>
							</div>
						</div>
					</div>

					{/* 5 Component Health Cards */}
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{/* Frontend Card */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 font-bold text-sm text-gray-800">
									<Cpu className="h-4 w-4 text-purple-600" />
									<span>Next.js Frontend</span>
								</div>
								<span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
									{initialHealth.frontend.status}
								</span>
							</div>
							<div className="mt-4 space-y-2 font-mono text-xs text-gray-600">
								<div className="flex justify-between">
									<span>Node Version:</span>
									<span className="font-bold text-gray-900">{initialHealth.frontend.nodeVersion}</span>
								</div>
								<div className="flex justify-between">
									<span>Uptime:</span>
									<span className="font-bold text-gray-900">{Math.floor(initialHealth.frontend.uptimeSeconds / 60)} mins</span>
								</div>
								<div className="flex justify-between">
									<span>Memory RSS:</span>
									<span className="font-bold text-gray-900">{initialHealth.frontend.memoryRssMb} MB</span>
								</div>
								<div className="flex justify-between">
									<span>Heap Used:</span>
									<span className="font-bold text-gray-900">{initialHealth.frontend.heapUsedMb} / {initialHealth.frontend.heapTotalMb} MB</span>
								</div>
							</div>
						</div>

						{/* API Server Card */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 font-bold text-sm text-gray-800">
									<Server className="h-4 w-4 text-blue-600" />
									<span>Express API Server</span>
								</div>
								<span
									className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
										initialHealth.apiServer.status === "HEALTHY"
											? "bg-emerald-100 text-emerald-800"
											: "bg-rose-100 text-rose-800"
									}`}
								>
									{initialHealth.apiServer.status}
								</span>
							</div>
							<div className="mt-4 space-y-2 font-mono text-xs text-gray-600">
								<div className="flex justify-between">
									<span>Latency:</span>
									<span className="font-bold text-gray-900">{initialHealth.apiServer.latencyMs} ms</span>
								</div>
								<div className="flex justify-between truncate">
									<span>URL:</span>
									<span className="font-bold text-gray-900 truncate">{initialHealth.apiServer.endpoint}</span>
								</div>
								{initialHealth.apiServer.error && (
									<div className="text-rose-600 text-[11px] font-semibold">{initialHealth.apiServer.error}</div>
								)}
							</div>
						</div>

						{/* Database Card */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 font-bold text-sm text-gray-800">
									<Database className="h-4 w-4 text-amber-600" />
									<span>MySQL ERP Database</span>
								</div>
								<span
									className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
										initialHealth.database.status === "HEALTHY"
											? "bg-emerald-100 text-emerald-800"
											: "bg-rose-100 text-rose-800"
									}`}
								>
									{initialHealth.database.status}
								</span>
							</div>
							<div className="mt-4 space-y-2 font-mono text-xs text-gray-600">
								<div className="flex justify-between">
									<span>Query Round-Trip:</span>
									<span className="font-bold text-gray-900">{initialHealth.database.latencyMs} ms</span>
								</div>
								<div className="flex justify-between">
									<span>Mode:</span>
									<span className="font-bold text-emerald-700">100% READ-ONLY</span>
								</div>
							</div>
						</div>

						{/* Mailer Card */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 font-bold text-sm text-gray-800">
									<Mail className="h-4 w-4 text-emerald-600" />
									<span>Gmail SMTP Mailer</span>
								</div>
								<span
									className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
										initialHealth.mailer.status === "HEALTHY"
											? "bg-emerald-100 text-emerald-800"
											: "bg-amber-100 text-amber-800"
									}`}
								>
									{initialHealth.mailer.status}
								</span>
							</div>
							<div className="mt-4 space-y-2 font-mono text-xs text-gray-600">
								<div className="flex justify-between truncate">
									<span>Sender:</span>
									<span className="font-bold text-gray-900 truncate">{initialHealth.mailer.user}</span>
								</div>
								<div className="flex justify-between">
									<span>Transport:</span>
									<span className="font-bold text-gray-900">TLS Authenticated</span>
								</div>
							</div>
						</div>

						{/* Storage Card */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 font-bold text-sm text-gray-800">
									<HardDrive className="h-4 w-4 text-cyan-600" />
									<span>Local Storage I/O</span>
								</div>
								<span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
									{initialHealth.storage.status}
								</span>
							</div>
							<div className="mt-4 space-y-2 font-mono text-xs text-gray-600">
								<div className="flex justify-between">
									<span>Write/Read Check:</span>
									<span className="font-bold text-gray-900">{initialHealth.storage.writeLatencyMs} ms</span>
								</div>
								<div className="flex justify-between">
									<span>Path:</span>
									<span className="font-bold text-gray-900">data/</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* TAB 2: SUBSCRIPTION & LICENSE */}
			{activeTab === "license" && (
				<div className="space-y-6">
					{/* Status Card */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<div className="flex items-center gap-2">
									<h2 className="font-black text-xl text-gray-900">{license.organization}</h2>
									<span
										className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
											license.isBlocked
												? "bg-rose-100 text-rose-800"
												: license.daysRemaining < 30
													? "bg-amber-100 text-amber-800"
													: "bg-emerald-100 text-emerald-800"
										}`}
									>
										{license.status} {license.isBlocked ? "(BLOCKED)" : `(${license.daysRemaining} days left)`}
									</span>
								</div>
								<p className="mt-1 text-xs text-gray-500 font-mono" suppressHydrationWarning>
									Expiration Date: {new Date(license.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} &bull; Grace Period: {license.gracePeriodDays} days
								</p>
								{license.reason && (
									<p className="mt-1.5 font-mono text-xs font-semibold text-rose-600">
										Reason: {license.reason}
									</p>
								)}
							</div>

							<div className="flex flex-wrap items-center gap-2">
								{license.isBlocked ? (
									<button
										className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-xs text-white shadow-xs transition hover:bg-emerald-700"
										disabled={isPending}
										onClick={handleRestoreActiveAccess}
										type="button"
									>
										<CheckCircle2 className="h-4 w-4" />
										Restore Platform Access (Unblock All)
									</button>
								) : (
									<>
										<button
											className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 font-bold text-xs text-white shadow-xs transition hover:bg-rose-700"
											disabled={isPending}
											onClick={handleSuspendUsageImmediately}
											type="button"
										>
											<AlertOctagon className="h-4 w-4" />
											Suspend Usage Right Now
										</button>

										<button
											className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 font-bold text-xs text-amber-900 transition hover:bg-amber-100"
											disabled={isPending}
											onClick={handleForceExpireSubscription}
											type="button"
										>
											<Clock className="h-4 w-4 text-amber-600" />
											Force Expire
										</button>
									</>
								)}

								<button
									className={`rounded-xl px-3.5 py-2 font-bold text-xs text-white shadow-xs transition ${
										license.killswitchActive ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-800 hover:bg-gray-900"
									}`}
									disabled={isPending}
									onClick={handleToggleKillswitch}
									type="button"
								>
									{license.killswitchActive ? "Clear Killswitch" : "Killswitch"}
								</button>

								<a
									className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-bold text-xs text-gray-700 shadow-xs hover:bg-gray-50"
									href="/license-expired"
									rel="noreferrer"
									target="_blank"
								>
									Preview Lock
								</a>
							</div>
						</div>

						{/* Quick Extend Buttons */}
						<div className="mt-6 border-t border-gray-100 pt-5">
							<div className="font-bold text-xs uppercase tracking-wider text-gray-500">Quick Subscription Extension</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<button
									className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 font-bold text-xs text-gray-800 transition hover:bg-purple-50 hover:border-purple-300"
									disabled={isPending}
									onClick={() => handleExtendLicense(30)}
									type="button"
								>
									+ 30 Days
								</button>
								<button
									className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 font-bold text-xs text-gray-800 transition hover:bg-purple-50 hover:border-purple-300"
									disabled={isPending}
									onClick={() => handleExtendLicense(90)}
									type="button"
								>
									+ 90 Days (Quarter)
								</button>
								<button
									className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 font-bold text-xs text-gray-800 transition hover:bg-purple-50 hover:border-purple-300"
									disabled={isPending}
									onClick={() => handleExtendLicense(365)}
									type="button"
								>
									+ 1 Year (365 Days)
								</button>

								<div className="flex items-center gap-2 ml-auto">
									<input
										className="rounded-xl border border-gray-300 px-3 py-1.5 font-mono text-xs text-gray-900"
										onChange={(e) => setCustomExpiry(e.target.value)}
										type="date"
										value={customExpiry}
									/>
									<button
										className="rounded-xl bg-[#0071BC] px-3.5 py-1.5 font-bold text-xs text-white transition hover:bg-[#005a96]"
										disabled={isPending}
										onClick={handleSaveCustomExpiry}
										type="button"
									>
										Set Expiry
									</button>
								</div>
							</div>
						</div>
					</div>

					{/* Admin Renewal Email Notification Sender */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
						<div className="flex items-center gap-2 font-black text-lg text-gray-900">
							<Mail className="h-5 w-5 text-purple-600" />
							<span>Dispatch Subscription Reminder Email to Admins</span>
						</div>
						<p className="text-xs text-gray-500">
							Send an official license status notice from developer email directly to the configured Administrator inbox.
						</p>

						<div>
							<label className="block text-xs font-bold text-gray-700">Admin Notification Email(s)</label>
							<div className="mt-1 flex gap-2">
								<input
									className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900"
									onChange={(e) => setAdminEmailsStr(e.target.value)}
									placeholder="admin1@asmeepharma.com, admin2@asmeepharma.com"
									type="text"
									value={adminEmailsStr}
								/>
								<button
									className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
									disabled={isPending}
									onClick={handleSaveAdminEmails}
									type="button"
								>
									Save Emails
								</button>
							</div>
						</div>

						<div>
							<label className="block text-xs font-bold text-gray-700">Optional Custom Note in Email</label>
							<textarea
								className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 placeholder:text-gray-400"
								onChange={(e) => setCustomRenewalNote(e.target.value)}
								placeholder="e.g. Please find the renewal invoice attached. Contact Devfinity support for PO processing."
								rows={2}
								value={customRenewalNote}
							/>
						</div>

						<button
							className="rounded-xl bg-purple-600 px-5 py-2.5 font-bold text-xs text-white shadow-xs transition hover:bg-purple-700"
							disabled={isPending}
							onClick={handleSendRenewalEmails}
							type="button"
						>
							{isPending ? "Sending Notice..." : "Send Subscription Notice Email Now"}
						</button>
					</div>
				</div>
			)}

			{/* TAB 3: FEATURE SWITCHBOARD & MAINTENANCE */}
			{activeTab === "toggles" && (
				<div className="space-y-6">
					{/* Global Maintenance Mode Box */}
					<div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-xs space-y-4">
						<div className="flex items-center gap-2 font-black text-lg text-amber-900">
							<AlertTriangle className="h-5 w-5 text-amber-600" />
							<span>Global Maintenance Mode</span>
						</div>
						<p className="text-xs text-amber-800">
							When active, non-developer users will be blocked with a customized maintenance message. Developers always bypass.
						</p>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div>
								<label className="block text-xs font-bold text-gray-700">Maintenance Audience</label>
								<select
									className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-bold text-gray-800"
									onChange={(e) => setMaintenance({ ...maintenance, mode: e.target.value as any })}
									value={maintenance.mode}
								>
									<option value="DISABLED">DISABLED (Normal Operations)</option>
									<option value="MRS_ONLY">MRS_ONLY (Block Medical Reps Only)</option>
									<option value="ALL_USERS">ALL_USERS (Block MRs and Admins)</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-700">Estimated Completion Time</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2 text-xs text-gray-900"
									onChange={(e) => setMaintenance({ ...maintenance, estimatedEndTime: e.target.value })}
									placeholder="e.g. 10:30 PM IST"
									type="text"
									value={maintenance.estimatedEndTime || ""}
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-700">Reason</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2 text-xs text-gray-900"
									onChange={(e) => setMaintenance({ ...maintenance, reason: e.target.value })}
									placeholder="e.g. Server migration"
									type="text"
									value={maintenance.reason || ""}
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-bold text-gray-700">Public Maintenance Banner Message</label>
							<input
								className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs text-gray-900"
								onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })}
								type="text"
								value={maintenance.message}
							/>
						</div>

						<button
							className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-xs text-white shadow-xs hover:bg-amber-700"
							disabled={isPending}
							onClick={handleSaveMaintenance}
							type="button"
						>
							Save Maintenance Settings
						</button>
					</div>

					{/* Granular Service Switchboard */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
						<div className="font-black text-lg text-gray-900">Granular Feature Switchboard</div>
						<p className="mt-1 text-xs text-gray-500">
							Selectively disable specific report tabs and tools for MRs, for Admins, or take them down completely.
						</p>

						<div className="mt-5 divide-y divide-gray-100">
							{[
								{ key: "stock" as FeatureKey, label: "Stock Movement Statement" },
								{ key: "sales" as FeatureKey, label: "Sales & Invoicing Details" },
								{ key: "party" as FeatureKey, label: "Party Wise Sales Statement" },
								{ key: "products" as FeatureKey, label: "Product Wise Sales Statement" },
								{ key: "claim" as FeatureKey, label: "Claim Quantity & Free Schemes" },
								{ key: "overdue" as FeatureKey, label: "Periodical Outstanding & Overdue" },
								{ key: "export" as FeatureKey, label: "Report Downloads (PDF & Excel)" },
								{ key: "notices" as FeatureKey, label: "Notice Board & Announcements" },
							].map((item) => {
								const currentScope = toggles[item.key] || "ACTIVE";
								return (
									<div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between" key={item.key}>
										<div className="font-bold text-sm text-gray-800">{item.label}</div>
										<div className="flex items-center gap-1.5">
											{(
												[
													{ id: "ACTIVE", label: "Active" },
													{ id: "DISABLED_FOR_MRS", label: "Down for MRs" },
													{ id: "DISABLED_FOR_ADMINS", label: "Down for Admins" },
													{ id: "DISABLED_FOR_ALL", label: "Disabled" },
												] as const
											).map((opt) => (
												<button
													className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
														currentScope === opt.id
															? opt.id === "ACTIVE"
																? "bg-emerald-600 text-white font-bold"
																: opt.id === "DISABLED_FOR_ALL"
																	? "bg-rose-600 text-white font-bold"
																	: "bg-amber-600 text-white font-bold"
															: "bg-gray-100 text-gray-600 hover:bg-gray-200"
													}`}
													disabled={isPending}
													key={opt.id}
													onClick={() => handleToggleFeature(item.key, opt.id)}
													type="button"
												>
													{opt.label}
												</button>
											))}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* TAB 4: MR IMPERSONATION */}
			{activeTab === "impersonate" && (
				<div className="space-y-6">
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<div className="font-black text-lg text-gray-900">MR Simulation & "View-As" Mode</div>
								<p className="text-xs text-gray-500">
									Instantly preview the dashboard as any registered MR to test ranking rules, overdue warnings, and report layouts.
								</p>
							</div>
							<div className="relative w-full sm:w-64">
								<Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
								<input
									className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-4 text-xs font-medium text-gray-900"
									onChange={(e) => setMrSearch(e.target.value)}
									placeholder="Search MR by name or ID..."
									type="text"
									value={mrSearch}
								/>
							</div>
						</div>

						<div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
							<div className="max-h-96 overflow-y-auto">
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 bg-gray-50 font-bold text-gray-600 uppercase">
										<tr>
											<th className="px-4 py-3">MR Name</th>
											<th className="px-4 py-3">MR Code</th>
											<th className="px-4 py-3">Division</th>
											<th className="px-4 py-3">Rank</th>
											<th className="px-4 py-3 text-right">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{filteredMRs.slice(0, 50).map((mr) => (
											<tr className="hover:bg-purple-50/40 transition-colors" key={mr.id}>
												<td className="px-4 py-3 font-bold text-gray-900">{mr.name}</td>
												<td className="px-4 py-3 font-mono text-gray-600">{mr.id}</td>
												<td className="px-4 py-3 text-gray-600">{mr.division || mr.company || "All"}</td>
												<td className="px-4 py-3">
													<span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800">
														Rank {mr.rank || 3}
													</span>
												</td>
												<td className="px-4 py-3 text-right">
													<button
														className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1 font-bold text-white shadow-xs hover:bg-purple-700"
														disabled={isPending}
														onClick={() => handleStartImpersonate(mr.id)}
														type="button"
													>
														<Eye className="h-3 w-3" />
														View As MR
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* TAB 5: UNIFIED LOGS */}
			{activeTab === "logs" && (
				<div className="space-y-6">
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<div className="font-black text-lg text-gray-900">Unified System & User Logs</div>
								<p className="text-xs text-gray-500">Live stream of authentication events, report exports, and system alerts.</p>
							</div>

							<div className="flex items-center gap-2">
								<input
									className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900 w-48 sm:w-64"
									onChange={(e) => setLogQuery(e.target.value)}
									placeholder="Filter by IP, event or details..."
									type="text"
									value={logQuery}
								/>
								<select
									className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700"
									onChange={(e) => setLogLevel(e.target.value)}
									value={logLevel}
								>
									<option value="ALL">All Levels</option>
									<option value="INFO">INFO</option>
									<option value="WARN">WARN</option>
									<option value="ERROR">ERROR</option>
								</select>
							</div>
						</div>

						<div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
							<div className="max-h-96 overflow-y-auto">
								<table className="w-full text-left text-xs font-mono">
									<thead className="sticky top-0 bg-gray-50 font-bold text-gray-600 uppercase">
										<tr>
											<th className="px-4 py-3">Timestamp</th>
											<th className="px-4 py-3">Level</th>
											<th className="px-4 py-3">Event</th>
											<th className="px-4 py-3">User / Target</th>
											<th className="px-4 py-3">IP Address</th>
											<th className="px-4 py-3">Details</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{filteredLogs.map((log) => (
											<tr className="hover:bg-gray-50" key={log.id}>
												<td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
													{new Date(log.timestamp).toLocaleTimeString()}
												</td>
												<td className="px-4 py-2.5">
													<span
														className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
															log.level === "ERROR"
																? "bg-rose-100 text-rose-800"
																: log.level === "WARN"
																	? "bg-amber-100 text-amber-800"
																	: "bg-emerald-100 text-emerald-800"
														}`}
													>
														{log.level}
													</span>
												</td>
												<td className="px-4 py-2.5 font-bold text-gray-900">{log.event}</td>
												<td className="px-4 py-2.5 text-gray-700">{log.user || "System"}</td>
												<td className="px-4 py-2.5 text-gray-500">{log.ip}</td>
												<td className="max-w-xs truncate px-4 py-2.5 text-gray-600">
													{JSON.stringify(log.details || {})}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* TAB 6: PROCEDURE PLAYGROUND */}
			{activeTab === "query" && (
				<div className="space-y-6">
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
						<div className="font-black text-lg text-gray-900">Stored Procedure Sandbox & Benchmarks</div>
						<p className="text-xs text-gray-500">
							Safely test and benchmark read-only stored procedures directly against the legacy ERP MySQL engine with execution timers.
						</p>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
							<div>
								<label className="block text-xs font-bold text-gray-700">Procedure</label>
								<select
									className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-xs font-bold text-gray-900"
									onChange={(e) => setSelectedProcedure(e.target.value)}
									value={selectedProcedure}
								>
									<option value="rptStockMovementStatement">rptStockMovementStatement</option>
									<option value="rptItemCustomerSale">rptItemCustomerSale</option>
									<option value="rptMRwisePeriodicalOutstanding">rptMRwisePeriodicalOutstanding</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-700">From Date</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-xs text-gray-900"
									onChange={(e) => setSandboxFromDate(e.target.value)}
									type="date"
									value={sandboxFromDate}
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-700">To Date</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-xs text-gray-900"
									onChange={(e) => setSandboxToDate(e.target.value)}
									type="date"
									value={sandboxToDate}
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-700">Company Code</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-xs text-gray-900"
									onChange={(e) => setSandboxCompanyCode(e.target.value)}
									placeholder="e.g. 11 or empty"
									type="text"
									value={sandboxCompanyCode}
								/>
							</div>
						</div>

						<button
							className="rounded-xl bg-[#0071BC] px-5 py-2 font-bold text-xs text-white shadow-xs hover:bg-[#005a96]"
							disabled={isPending}
							onClick={handleRunSandbox}
							type="button"
						>
							{isPending ? "Executing Query..." : "Execute & Benchmark Procedure"}
						</button>

						{/* Results */}
						{sandboxResult && (
							<div className="mt-4 border-t border-gray-100 pt-4 space-y-3 font-mono">
								<div className="flex flex-wrap gap-4 text-xs">
									<span className="rounded bg-emerald-100 px-2 py-1 font-bold text-emerald-800">
										Duration: {sandboxResult.data?.durationMs} ms
									</span>
									<span className="rounded bg-blue-100 px-2 py-1 font-bold text-blue-800">
										Rows Returned: {sandboxResult.data?.rowCount}
									</span>
								</div>

								{sandboxResult.data?.columns && (
									<div className="flex flex-wrap gap-1 text-[11px]">
										{sandboxResult.data.columns.map((c: string) => (
											<span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700" key={c}>
												{c}
											</span>
										))}
									</div>
								)}

								{sandboxResult.data?.sampleRows && (
									<div className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 text-[11px]">
										<pre className="p-3 text-gray-800">
											{JSON.stringify(sandboxResult.data.sampleRows.slice(0, 10), null, 2)}
										</pre>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* TAB 7: RUNTIME CONFIG & ENV */}
			{activeTab === "runtime" && (
				<div className="space-y-6">
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
						<div className="font-black text-lg text-gray-900">Dynamic Runtime Configuration</div>
						<p className="text-xs text-gray-500">
							Update live runtime settings without redeploying. Persisted in <code className="text-purple-600">data/runtime_config.json</code>.
						</p>

						<div className="space-y-3">
							<div>
								<label className="block text-xs font-bold text-gray-700">Admin Allowed IPs (comma-separated)</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 font-mono text-xs text-gray-900"
									onChange={(e) => setRuntime({ ...runtime, adminAllowedIps: e.target.value })}
									placeholder="e.g. 192.168.1.100, 10.0.0.* or empty for all"
									type="text"
									value={runtime.adminAllowedIps}
								/>
							</div>

							<div className="flex items-center gap-6">
								<label className="flex items-center gap-2 font-bold text-xs text-gray-700">
									<input
										checked={runtime.debugMode}
										onChange={(e) => setRuntime({ ...runtime, debugMode: e.target.checked })}
										type="checkbox"
									/>
									Enable Debug SQL & Telemetry Flags
								</label>

								<label className="flex items-center gap-2 font-bold text-xs text-gray-700">
									<input
										checked={runtime.rateLimitStrictMode}
										onChange={(e) => setRuntime({ ...runtime, rateLimitStrictMode: e.target.checked })}
										type="checkbox"
									/>
									Strict Rate Limiting Mode
								</label>
							</div>

							<button
								className="rounded-xl bg-[#0071BC] px-5 py-2 font-bold text-xs text-white shadow-xs hover:bg-[#005a96]"
								disabled={isPending}
								onClick={handleSaveRuntime}
								type="button"
							>
								Save Runtime Config
							</button>
						</div>
					</div>

					{/* Masked Secrets Table */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
						<div className="font-black text-lg text-gray-900">Environment Verification (Masked)</div>
						<p className="text-xs text-gray-500">Inspect server environment variables safely.</p>

						<div className="mt-4 divide-y divide-gray-100 font-mono text-xs">
							{Object.entries(maskedEnv).map(([k, v]) => (
								<div className="flex justify-between py-2" key={k}>
									<span className="text-gray-500">{k}:</span>
									<span className="font-bold text-gray-900">{typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v)}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
