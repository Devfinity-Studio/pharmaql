"use client";

import React, { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Activity,
	AlertOctagon,
	AlertTriangle,
	Bell,
	Building2,
	Calendar,
	Check,
	CheckCircle2,
	ChevronDown,
	Clock,
	Copy,
	Cpu,
	Database,
	Download,
	ExternalLink,
	Eye,
	HardDrive,
	Key,
	Lock,
	Mail,
	Megaphone,
	MessageSquare,
	Play,
	Power,
	Radio,
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
	X,
	XCircle,
} from "lucide-react";
import { DevFeedbackPanel } from "./dev-feedback-panel";
import { DevLivePresence } from "./dev-live-presence";
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
	sendTestEmailAction,
	verifyMailerCredentialsAction,
	probeStorageLatencyAction,
	probeDatabaseLatencyAction,
	getClientRateLimitStatusAction,
	resetClientIpRateLimitAction,
} from "@/server/actions/devDiagnostics";
import { startMrImpersonation } from "@/server/actions/impersonation";
import {
	getPushDiagnosticsAction,
	sendTestPushAction,
} from "@/server/actions/pushActions";

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
		companyCode?: string | null;
		rank?: number;
		isBlocked?: boolean;
		assignedCompanies?: string[];
		assignedDivisions?: string[];
	}>;
	companiesList?: Array<{
		companyCode: string;
		companyName: string;
		divisionName?: string;
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
	companiesList = [],
}: DevControlCenterProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const initialTabFromUrl = searchParams.get("tab");
	const [activeTab, setActiveTab] = useState<
		"status" | "presence" | "debug" | "feedback" | "license" | "push" | "toggles" | "impersonate" | "logs" | "query" | "runtime" | "notices"
	>((initialTabFromUrl as any) || "status");

	// Debug Console states
	const [debugEmailRecipient, setDebugEmailRecipient] = useState(initialLicense.developerEmail || "dev@asmeepharma.com");
	const [debugEmailTemplate, setDebugEmailTemplate] = useState<
		"CUSTOM" | "OTP_PREVIEW" | "SUBSCRIPTION_PREVIEW" | "SYSTEM_ALERT_PREVIEW"
	>("OTP_PREVIEW");
	const [debugEmailUseDevCredentials, setDebugEmailUseDevCredentials] = useState(
		Boolean(maskedEnv.devSmtpUserConfigured),
	);
	const [debugEmailCustomSubject, setDebugEmailCustomSubject] = useState("");
	const [debugEmailCustomMessage, setDebugEmailCustomMessage] = useState("");
	const [debugEmailResult, setDebugEmailResult] = useState<any>(null);

	const [adminVerifyResult, setAdminVerifyResult] = useState<any>(null);
	const [devVerifyResult, setDevVerifyResult] = useState<any>(null);

	const [storageBenchmarkResult, setStorageBenchmarkResult] = useState<any>(null);
	const [dbBenchmarkResult, setDbBenchmarkResult] = useState<any>(null);
	const [clientRateLimitResult, setClientRateLimitResult] = useState<any>(null);

	const [isPending, startTransition] = useTransition();
	const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

	// License state
	const [license, setLicense] = useState(initialLicense);
	const [extensionDays, setExtensionDays] = useState<number>(365);
	const [customExpiry, setCustomExpiry] = useState<string>(initialLicense.expiresAt.slice(0, 10));
	const defaultAdminEmail = (initialLicense.adminEmails && initialLicense.adminEmails[0]) || "asmeepharma2022@gmail.com";
	const initialRecipients = (initialLicense.adminEmails || [])
		.map((e) => e.trim())
		.filter((e) => Boolean(e) && e.toLowerCase() !== "admin@admin.com");
	const [adminEmailsStr, setAdminEmailsStr] = useState<string>(
		initialRecipients.length > 0 ? initialRecipients.join(", ") : defaultAdminEmail,
	);
	const [customRenewalNote, setCustomRenewalNote] = useState<string>("");
	const [renewalSenderGateway, setRenewalSenderGateway] = useState<"DEVELOPER" | "ADMIN">("DEVELOPER");

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
	const [sandboxCompanySearch, setSandboxCompanySearch] = useState("");
	const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
	const [copiedSql, setCopiedSql] = useState(false);
	const [sandboxResult, setSandboxResult] = useState<any>(null);
	const companyDropdownRef = useRef<HTMLDivElement>(null);

	// Impersonation state
	const [mrSearch, setMrSearch] = useState("");

	// Logs state
	const [logs, setLogs] = useState(initialLogs);
	const [logQuery, setLogQuery] = useState("");
	const [logLevel, setLogLevel] = useState("ALL");

	// Push dispatcher state
	const [pushSummary, setPushSummary] = useState<{
		totalSubscriptions: number;
		mrCount: number;
		adminCount: number;
		devCount: number;
		totalInAppNotifications: number;
		vapidConfigured: boolean;
	} | null>(null);
	const [pushTargetType, setPushTargetType] = useState<
		"CURRENT_USER" | "MR" | "ADMIN" | "ALL" | "SPECIFIC_MR"
	>("CURRENT_USER");
	const [pushTargetMrId, setPushTargetMrId] = useState("");
	const [pushTitle, setPushTitle] = useState("⚠️ Field Alert: Impending Block");
	const [pushBody, setPushBody] = useState(
		"Customer account has invoices nearing 90-day overdue threshold. Please follow up.",
	);
	const [pushDeepLink, setPushDeepLink] = useState("/dashboard?tab=overdue");
	const [pushResult, setPushResult] = useState<any>(null);

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
			const emails = adminEmailsStr
				.split(",")
				.map((e) => e.trim())
				.filter((e) => Boolean(e) && e.toLowerCase() !== "admin@admin.com");
			const targets = emails.length > 0 ? emails : [(license.adminEmails && license.adminEmails[0]) || "asmeepharma2022@gmail.com"];
			await saveLicenseConfigAction({ adminEmails: targets });
			setLicense((prev) => ({ ...prev, adminEmails: targets }));
			showFeedback("success", `Notification recipient(s) saved: ${targets.join(", ")}`);
		});
	};

	const handleSendRenewalEmails = () => {
		startTransition(async () => {
			const emails = adminEmailsStr
				.split(",")
				.map((e) => e.trim())
				.filter((e) => Boolean(e) && e.toLowerCase() !== "admin@admin.com");
			const targets = emails.length > 0 ? emails : [(license.adminEmails && license.adminEmails[0]) || "asmeepharma2022@gmail.com"];
			const res = await triggerSubscriptionReminderEmails(customRenewalNote, targets, renewalSenderGateway);
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
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				companyDropdownRef.current &&
				!companyDropdownRef.current.contains(e.target as Node)
			) {
				setIsCompanyDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const filteredCompanies = useMemo(() => {
		const list = companiesList || [];
		if (!sandboxCompanySearch.trim()) {
			return list;
		}
		const q = sandboxCompanySearch.toLowerCase().trim();
		return list.filter((c) =>
			c.companyName.toLowerCase().includes(q) ||
			c.companyCode.toLowerCase().includes(q) ||
			(c.divisionName && c.divisionName.toLowerCase().includes(q)),
		);
	}, [companiesList, sandboxCompanySearch]);

	const selectedCompanyInfo = useMemo(() => {
		if (!sandboxCompanyCode) return null;
		return (
			companiesList?.find(
				(c) => c.companyCode.toLowerCase() === sandboxCompanyCode.toLowerCase(),
			) || null
		);
	}, [companiesList, sandboxCompanyCode]);

	const liveDebugSql = useMemo(() => {
		const compCode = (sandboxCompanyCode || "").trim();
		let compCodeParam = "";
		if (compCode && compCode !== "All") {
			const parts = compCode
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean);
			if (parts.length > 0) {
				compCodeParam = parts.map((c) => `('${c?.replace(/'/g, "''")}')`).join(",");
			}
		}

		const odbcFrom = `{d '${sandboxFromDate || "2026-04-01"}'}`;
		const odbcTo = `{d '${sandboxToDate || new Date().toISOString().slice(0, 10)}'}`;
		const compParam = compCodeParam ? `'${compCodeParam.replace(/'/g, "''")}'` : "''";
		const locParam = "('11')";
		const escapedLoc = `'${locParam.replace(/'/g, "''")}'`;

		if (selectedProcedure === "rptStockMovementStatement") {
			return `SET sql_mode = '';\nCALL \`pdyasvtrans\`.\`rptStockMovementStatement\`(11, ${escapedLoc}, 202627, {d '2026-04-01'}, ${odbcFrom}, ${odbcTo}, ${compParam}, '', '', 'PRate');`;
		} else if (selectedProcedure === "rptStockandSalesStatementReport") {
			return `SET sql_mode = '';\nCALL \`rptStockandSalesStatementReport\`(11, ${escapedLoc}, ${odbcFrom}, ${odbcTo}, ${compParam}, '', '', 202627, 'N', '', 'Y');`;
		} else if (selectedProcedure === "rptItemCustomerSale") {
			return `SET sql_mode = '';\nCALL \`pdyasvtrans\`.\`rptItemCustomerSale\`(${odbcFrom}, ${odbcTo}, 11, ${escapedLoc}, 202627, '', '', '', ${compParam}, '', 'Y', '', '', ${escapedLoc}, 'SalesEntry', '');`;
		} else if (selectedProcedure === "rptMRwisePeriodicalOutstanding") {
			return `SET sql_mode = '';\nCALL \`pdyasvtrans\`.\`rptMRwisePeriodicalOutstanding\`(11, 11, 202627, {d '2026-04-01'}, ${odbcFrom}, ${odbcTo}, '', '', 'All', '', '', ${compParam}, '', '', '');`;
		} else if (selectedProcedure === "rptCompanyCustomerItemwiseSales") {
			return `SET sql_mode = '';\nCALL \`pdyasvtrans\`.\`rptCompanyCustomerItemwiseSales\`(11, ${escapedLoc}, 202627, ${odbcFrom}, ${odbcTo}, '', ${compParam}, '', '', 'Y', '');`;
		}
		return `SET sql_mode = '';\nCALL \`${selectedProcedure}\`(...);`;
	}, [selectedProcedure, sandboxFromDate, sandboxToDate, sandboxCompanyCode]);

	const handleCopySql = (sqlText: string) => {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			navigator.clipboard.writeText(sqlText);
			setCopiedSql(true);
			setTimeout(() => setCopiedSql(false), 2500);
		}
	};

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

	// 7. Push Dispatcher Handlers
	const loadPushDiagnostics = async () => {
		try {
			const data = await getPushDiagnosticsAction();
			setPushSummary(data);
		} catch (err: any) {
			console.warn("Push diagnostics error:", err);
		}
	};

	const handleDispatchPush = () => {
		startTransition(async () => {
			try {
				let targetUserId: string | undefined;
				let targetRole: "MR" | "ADMIN" | "ALL" | undefined;

				if (pushTargetType === "SPECIFIC_MR") {
					targetUserId = pushTargetMrId || (mrList[0]?.id || "2001");
				} else if (
					pushTargetType === "MR" ||
					pushTargetType === "ADMIN" ||
					pushTargetType === "ALL"
				) {
					targetRole = pushTargetType;
				}

				const res = await sendTestPushAction({
					targetUserId,
					targetRole,
					title: pushTitle,
					body: pushBody,
					url: pushDeepLink,
				});

				setPushResult(res);
				showFeedback(res.success ? "success" : "error", res.message);
				await loadPushDiagnostics();
			} catch (err: any) {
				showFeedback("error", `Push dispatch failed: ${err.message}`);
			}
		});
	};

	// 8. Debug Console Handlers
	const handleSendDebugEmail = () => {
		startTransition(async () => {
			try {
				const res = await sendTestEmailAction({
					recipient: debugEmailRecipient,
					template: debugEmailTemplate,
					useDeveloperCredentials: debugEmailUseDevCredentials,
					customSubject: debugEmailCustomSubject || undefined,
					customMessage: debugEmailCustomMessage || undefined,
				});
				setDebugEmailResult(res);
				showFeedback(res.success ? "success" : "error", res.message);
			} catch (err: any) {
				showFeedback("error", `Email dispatch failed: ${err.message}`);
			}
		});
	};

	const handleVerifyAdminMailer = () => {
		startTransition(async () => {
			const res = await verifyMailerCredentialsAction("ADMIN");
			setAdminVerifyResult(res);
			showFeedback(
				res.success ? "success" : "error",
				res.success
					? `Admin SMTP handshake verified (${res.latencyMs}ms)`
					: res.error || "Admin SMTP handshake failed",
			);
		});
	};

	const handleVerifyDevMailer = () => {
		startTransition(async () => {
			const res = await verifyMailerCredentialsAction("DEVELOPER");
			setDevVerifyResult(res);
			showFeedback(
				res.success ? "success" : "error",
				res.success
					? `Developer SMTP handshake verified (${res.latencyMs}ms)`
					: res.error || "Developer SMTP handshake failed",
			);
		});
	};

	const handleRunStorageBenchmark = () => {
		startTransition(async () => {
			const res = await probeStorageLatencyAction();
			setStorageBenchmarkResult(res);
			showFeedback(
				res.success ? "success" : "error",
				res.success
					? `Storage benchmark passed (Write: ${res.writeLatencyMs}ms, Read: ${res.readLatencyMs}ms)`
					: res.error || "Storage probe failed",
			);
		});
	};

	const handleRunDbBenchmark = () => {
		startTransition(async () => {
			const res = await probeDatabaseLatencyAction();
			setDbBenchmarkResult(res);
			showFeedback(
				res.success ? "success" : "error",
				res.success
					? `Database gateway responded in ${res.latencyMs}ms`
					: res.error || "Database ping failed",
			);
		});
	};

	const handleCheckClientRateLimit = () => {
		startTransition(async () => {
			const res = await getClientRateLimitStatusAction();
			setClientRateLimitResult(res);
			showFeedback("success", `Resolved client IP: ${res.ip}`);
		});
	};

	const handleResetClientRateLimit = () => {
		startTransition(async () => {
			const res = await resetClientIpRateLimitAction();
			setClientRateLimitResult((prev: any) => ({ ...prev, isLocked: false }));
			showFeedback("success", res.message);
		});
	};

	// Filter MRs by name, ID, email, company name, company code, division, or assigned companies
	const filteredMRs = useMemo(() => {
		if (!mrSearch.trim()) return mrList;
		const q = mrSearch.toLowerCase().trim();
		return mrList.filter((m) => {
			const nameMatch = m.name?.toLowerCase().includes(q);
			const idMatch = m.id?.toLowerCase().includes(q);
			const emailMatch = m.email?.toLowerCase().includes(q);
			const compMatch = m.company?.toLowerCase().includes(q);
			const compCodeMatch = m.companyCode?.toLowerCase().includes(q);
			const divMatch = m.division?.toLowerCase().includes(q);
			const assignedMatch = m.assignedCompanies?.some((c) =>
				c.toLowerCase().includes(q),
			);
			const divAssignedMatch = m.assignedDivisions?.some((d) =>
				d.toLowerCase().includes(q),
			);
			return Boolean(
				nameMatch ||
				idMatch ||
				emailMatch ||
				compMatch ||
				compCodeMatch ||
				divMatch ||
				assignedMatch ||
				divAssignedMatch,
			);
		});
	}, [mrList, mrSearch]);

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
					{ id: "presence", label: "Live Users & Presence", icon: Radio },
					{ id: "debug", label: "Debug Console", icon: Terminal },
					{ id: "feedback", label: "Feedback & Bug Reports", icon: MessageSquare },
					{ id: "license", label: "Subscription & License", icon: Key },
					{ id: "push", label: "Push & Field Alerts", icon: Bell },
					{ id: "toggles", label: "Feature Switchboard", icon: Wrench },
					{ id: "impersonate", label: "MR Impersonation", icon: Users },
					{ id: "logs", label: "Unified Logs", icon: HardDrive },
					{ id: "query", label: "Procedure Sandbox", icon: Play },
					{ id: "runtime", label: "Runtime Config", icon: Server },
					{ id: "notices", label: "Notice Board", icon: Megaphone },
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
								<p className="text-xs text-gray-600" suppressHydrationWarning>
									All background services, connection pools, and database latencies evaluated at{" "}
									<span suppressHydrationWarning>
										{new Date(initialHealth.timestamp).toLocaleTimeString()}
									</span>.
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
									<p className="mt-1 text-xs text-gray-600" suppressHydrationWarning>
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

			{/* TAB: LIVE USERS & PRESENCE */}
			{activeTab === "presence" && (
				<DevLivePresence mrList={mrList as any} />
			)}

			{/* TAB: DEBUG & DIAGNOSTICS CONSOLE */}
			{activeTab === "debug" && (
				<div className="space-y-6">
					{/* Developer SMTP Credentials Guidance Banner */}
					<div
						className={`rounded-2xl border p-5 shadow-xs ${
							maskedEnv.devSmtpUserConfigured
								? "border-emerald-200 bg-emerald-50/70"
								: "border-amber-200 bg-amber-50/80"
						}`}
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-start gap-3">
								<div
									className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
										maskedEnv.devSmtpUserConfigured
											? "bg-emerald-600/10 text-emerald-700"
											: "bg-amber-600/10 text-amber-700"
									}`}
								>
									<Mail className="h-5 w-5" />
								</div>
								<div>
									<div className="flex items-center gap-2">
										<h3 className="font-bold text-sm text-gray-900">
											Developer Email Sending Credentials
										</h3>
										<span
											className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
												maskedEnv.devSmtpUserConfigured
													? "bg-emerald-100 text-emerald-800"
													: "bg-amber-100 text-amber-800"
											}`}
										>
											{maskedEnv.devSmtpUserConfigured
												? "Configured & Active"
												: "Defaulting to Admin Mailer"}
										</span>
									</div>
									<p className="mt-1 text-xs text-gray-600 leading-relaxed">
										{maskedEnv.devSmtpUserConfigured
											? `Configured sender: ${maskedEnv.devSmtpUser} (Port: ${maskedEnv.devSmtpPort || "587"}). Automated renewal invoices and technical alerts to Admins originate directly from developer credentials.`
											: "Developer email credentials (DEV_SMTP_USER / DEV_SMTP_PASS) are not configured. Renewal reminder invoices and alerts sent from the developer portal will fall back to the standard admin mailer until set in environment variables."}
									</p>
								</div>
							</div>

							<div className="flex shrink-0 items-center gap-2">
								<button
									className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
									disabled={isPending}
									onClick={handleVerifyDevMailer}
									type="button"
								>
									<CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
									Verify Developer SMTP
								</button>
								<button
									className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
									disabled={isPending}
									onClick={handleVerifyAdminMailer}
									type="button"
								>
									<CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
									Verify Admin SMTP
								</button>
							</div>
						</div>

						{/* Handshake Result Banners */}
						{(adminVerifyResult || devVerifyResult) && (
							<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 pt-3 border-t border-gray-200/60 font-mono text-xs">
								{devVerifyResult && (
									<div
										className={`p-3 rounded-xl border ${
											devVerifyResult.success
												? "border-emerald-200 bg-white text-emerald-900"
												: "border-rose-200 bg-white text-rose-900"
										}`}
									>
										<div className="font-bold flex items-center justify-between">
											<span>Developer SMTP Handshake:</span>
											<span>{devVerifyResult.success ? `SUCCESS (${devVerifyResult.latencyMs}ms)` : "FAILED"}</span>
										</div>
										<div className="text-[11px] text-gray-500 mt-1 truncate">User: {devVerifyResult.user}</div>
										{devVerifyResult.error && (
											<div className="text-[11px] text-rose-600 mt-1">{devVerifyResult.error}</div>
										)}
									</div>
								)}
								{adminVerifyResult && (
									<div
										className={`p-3 rounded-xl border ${
											adminVerifyResult.success
												? "border-emerald-200 bg-white text-emerald-900"
												: "border-rose-200 bg-white text-rose-900"
										}`}
									>
										<div className="font-bold flex items-center justify-between">
											<span>Admin SMTP Handshake:</span>
											<span>{adminVerifyResult.success ? `SUCCESS (${adminVerifyResult.latencyMs}ms)` : "FAILED"}</span>
										</div>
										<div className="text-[11px] text-gray-500 mt-1 truncate">User: {adminVerifyResult.user}</div>
										{adminVerifyResult.error && (
											<div className="text-[11px] text-rose-600 mt-1">{adminVerifyResult.error}</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>

					{/* 2-Column Grid: Notification Dispatcher + Email Dispatcher */}
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						{/* 1. Test Notification Dispatcher */}
						<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
							<div className="flex items-center justify-between border-b border-gray-100 pb-4">
								<div className="flex items-center gap-2.5">
									<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600">
										<Bell className="h-5 w-5" />
									</div>
									<div>
										<h3 className="font-bold text-sm text-gray-900">Send Test Notification</h3>
										<p className="text-[11px] text-gray-500">Dispatch live Web Push & in-app alerts</p>
									</div>
								</div>
								<span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800">
									Web Push & In-App
								</span>
							</div>

							<div className="mt-4 space-y-4">
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<label className="block text-xs font-bold text-gray-700">Audience Target</label>
										<select
											className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-bold text-gray-900"
											onChange={(e) => setPushTargetType(e.target.value as any)}
											value={pushTargetType}
										>
											<option value="CURRENT_USER">My Active Browser (Self-Test)</option>
											<option value="MR">Broadcast to All Active MRs</option>
											<option value="ADMIN">Broadcast to All Administrators</option>
											<option value="ALL">Platform-Wide Broadcast (All Users)</option>
											<option value="SPECIFIC_MR">Target Specific MR by ID</option>
										</select>
									</div>

									{pushTargetType === "SPECIFIC_MR" ? (
										<div>
											<label className="block text-xs font-bold text-gray-700">Target MR</label>
											<select
												className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-mono text-gray-900"
												onChange={(e) => setPushTargetMrId(e.target.value)}
												value={pushTargetMrId}
											>
												{mrList.slice(0, 50).map((m) => (
													<option key={m.id} value={m.id}>
														{m.name} ({m.id})
													</option>
												))}
											</select>
										</div>
									) : (
										<div>
											<label className="block text-xs font-bold text-gray-700">Deep Link Action</label>
											<select
												className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-mono text-gray-900"
												onChange={(e) => setPushDeepLink(e.target.value)}
												value={pushDeepLink}
											>
												<option value="/dashboard?tab=overdue">/dashboard?tab=overdue</option>
												<option value="/dashboard?tab=notices">/dashboard?tab=notices</option>
												<option value="/dashboard?tab=stock">/dashboard?tab=stock</option>
												<option value="/dashboard?tab=sales">/dashboard?tab=sales</option>
												<option value="/admin/dev">/admin/dev</option>
											</select>
										</div>
									)}
								</div>

								<div>
									<label className="block text-xs font-bold text-gray-700">Notification Title</label>
									<input
										className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold text-gray-900"
										onChange={(e) => setPushTitle(e.target.value)}
										type="text"
										value={pushTitle}
									/>
								</div>

								<div>
									<label className="block text-xs font-bold text-gray-700">Message Body</label>
									<textarea
										className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900"
										onChange={(e) => setPushBody(e.target.value)}
										rows={2}
										value={pushBody}
									/>
								</div>

								<div className="flex items-center justify-between pt-2">
									<span className="text-[11px] text-gray-500">Service worker vibration & sound enabled</span>
									<button
										className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 font-bold text-xs text-white shadow-xs transition hover:bg-purple-700"
										disabled={isPending}
										onClick={handleDispatchPush}
										type="button"
									>
										<Bell className="h-3.5 w-3.5" />
										{isPending ? "Dispatching..." : "Send Test Notification"}
									</button>
								</div>

								{/* Push Result output */}
								{pushResult && (
									<div
										className={`rounded-xl border p-3.5 font-mono text-xs ${
											pushResult.success
												? "border-emerald-200 bg-emerald-50 text-emerald-900"
												: "border-amber-200 bg-amber-50 text-amber-900"
										}`}
									>
										<div className="flex items-center gap-1.5 font-bold">
											{pushResult.success ? (
												<CheckCircle2 className="h-4 w-4 text-emerald-600" />
											) : (
												<AlertTriangle className="h-4 w-4 text-amber-600" />
											)}
											<span>{pushResult.message}</span>
										</div>
										<div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
											<div>Delivered Endpoints: <span className="font-bold text-gray-900">{pushResult.sentCount ?? 0}</span></div>
											<div>Pruned Endpoints: <span className="font-bold text-gray-900">{pushResult.prunedCount ?? 0}</span></div>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* 2. Test Email Dispatcher */}
						<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
							<div className="flex items-center justify-between border-b border-gray-100 pb-4">
								<div className="flex items-center gap-2.5">
									<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
										<Mail className="h-5 w-5" />
									</div>
									<div>
										<h3 className="font-bold text-sm text-gray-900">Send Test Email</h3>
										<p className="text-[11px] text-gray-500">Verify SMTP gateway & templates</p>
									</div>
								</div>
								<span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
									SMTP Dispatcher
								</span>
							</div>

							<div className="mt-4 space-y-4">
								<div>
									<div className="flex items-center justify-between mb-1">
										<label className="block text-xs font-bold text-gray-700">Recipient Email Address</label>
										<div className="flex items-center gap-1.5">
											<button
												type="button"
												onClick={() => setDebugEmailRecipient((license.adminEmails && license.adminEmails[0]) || "asmeepharma2022@gmail.com")}
												className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-100 transition-colors"
											>
												Admin Email
											</button>
											<button
												type="button"
												onClick={() => setDebugEmailRecipient(license.developerEmail || "info@devfinity.net")}
												className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition-colors"
											>
												Dev Email
											</button>
										</div>
									</div>
									<input
										className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono text-gray-900"
										onChange={(e) => setDebugEmailRecipient(e.target.value)}
										placeholder="admin@asmeepharma.com"
										type="email"
										value={debugEmailRecipient}
									/>
								</div>

								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<label className="block text-xs font-bold text-gray-700">Email Template</label>
										<select
											className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-bold text-gray-900"
											onChange={(e) => setDebugEmailTemplate(e.target.value as any)}
											value={debugEmailTemplate}
										>
											<option value="OTP_PREVIEW">MR Login OTP (Preview)</option>
											<option value="SUBSCRIPTION_PREVIEW">License Renewal Reminder</option>
											<option value="SYSTEM_ALERT_PREVIEW">Service Health Notice</option>
											<option value="CUSTOM">Custom Diagnostic Note</option>
										</select>
									</div>

									<div>
										<label className="block text-xs font-bold text-gray-700">Sender Email Gateway</label>
										<select
											className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-bold text-gray-900"
											onChange={(e) => setDebugEmailUseDevCredentials(e.target.value === "true")}
											value={debugEmailUseDevCredentials ? "true" : "false"}
										>
											<option value="false">Admin Email (Gmail: {maskedEnv.gmailUser || "info.devolvestudio@gmail.com"})</option>
											<option value="true">Developer Email (Zoho: {license.developerEmail || "info@devfinity.net"})</option>
										</select>
									</div>
								</div>

								{debugEmailTemplate === "CUSTOM" && (
									<>
										<div>
											<label className="block text-xs font-bold text-gray-700">Subject Line</label>
											<input
												className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold text-gray-900"
												onChange={(e) => setDebugEmailCustomSubject(e.target.value)}
												placeholder="Diagnostics probe subject..."
												type="text"
												value={debugEmailCustomSubject}
											/>
										</div>
										<div>
											<label className="block text-xs font-bold text-gray-700">Custom Message</label>
											<textarea
												className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900"
												onChange={(e) => setDebugEmailCustomMessage(e.target.value)}
												placeholder="Enter test note..."
												rows={2}
												value={debugEmailCustomMessage}
											/>
										</div>
									</>
								)}

								<div className="flex items-center justify-between pt-2">
									<span className="text-[11px] text-gray-500">
										Sender: {debugEmailUseDevCredentials ? (maskedEnv.devSmtpUser || "Developer") : "Admin System"}
									</span>
									<button
										className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-xs text-white shadow-xs transition hover:bg-blue-700"
										disabled={isPending}
										onClick={handleSendDebugEmail}
										type="button"
									>
										<Mail className="h-3.5 w-3.5" />
										{isPending ? "Sending Email..." : "Send Test Email"}
									</button>
								</div>

								{/* Email Result Output */}
								{debugEmailResult && (
									<div
										className={`rounded-xl border p-3.5 font-mono text-xs ${
											debugEmailResult.success
												? "border-emerald-200 bg-emerald-50 text-emerald-900"
												: "border-rose-200 bg-rose-50 text-rose-900"
										}`}
									>
										<div className="flex items-center gap-1.5 font-bold">
											{debugEmailResult.success ? (
												<CheckCircle2 className="h-4 w-4 text-emerald-600" />
											) : (
												<AlertOctagon className="h-4 w-4 text-rose-600" />
											)}
											<span>{debugEmailResult.message}</span>
										</div>
										{debugEmailResult.messageId && (
											<div className="mt-1 text-[11px] text-gray-500 truncate">
												Message-ID: {debugEmailResult.messageId}
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* 3 Diagnostic Cards: Storage Engine + Rate Limiter + DB Latency */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
						{/* Active Storage Benchmark */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col justify-between">
							<div>
								<div className="flex items-center justify-between border-b border-gray-100 pb-3">
									<div className="flex items-center gap-2">
										<HardDrive className="h-4 w-4 text-amber-600" />
										<h4 className="font-bold text-xs uppercase tracking-wider text-gray-800">
											Server Storage Latency
										</h4>
									</div>
									<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
										Zero-Crash FS
									</span>
								</div>

								<div className="mt-3 space-y-2 text-xs">
									<div className="flex justify-between">
										<span className="text-gray-500">Active Storage Dir:</span>
										<span className="font-mono font-bold text-gray-900 truncate max-w-[140px]">
											{storageBenchmarkResult?.activeDir || (maskedEnv.nodeEnv === "production" ? "/tmp/pharmaql-data" : "data/")}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-500">Serverless Temp Routing:</span>
										<span className="font-bold text-gray-900">
											{storageBenchmarkResult?.isServerless ? "Active (Vercel / Lambda)" : "Local Storage"}
										</span>
									</div>
									{storageBenchmarkResult && (
										<div className="mt-2 rounded-xl bg-gray-50 p-2.5 font-mono text-[11px] space-y-1">
											<div className="flex justify-between">
												<span>Write Latency:</span>
												<span className="font-bold text-emerald-700">{storageBenchmarkResult.writeLatencyMs}ms</span>
											</div>
											<div className="flex justify-between">
												<span>Read Latency:</span>
												<span className="font-bold text-emerald-700">{storageBenchmarkResult.readLatencyMs}ms</span>
											</div>
											<div className="flex justify-between border-t border-gray-200 pt-1 font-bold">
												<span>Total Roundtrip:</span>
												<span className="text-purple-700">{storageBenchmarkResult.totalLatencyMs}ms</span>
											</div>
										</div>
									)}
								</div>
							</div>

							<button
								className="mt-4 w-full rounded-xl border border-gray-300 bg-white py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
								disabled={isPending}
								onClick={handleRunStorageBenchmark}
								type="button"
							>
								{isPending ? "Testing Storage..." : "Run Storage Benchmark"}
							</button>
						</div>

						{/* Client IP & Rate Limiter Inspection */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col justify-between">
							<div>
								<div className="flex items-center justify-between border-b border-gray-100 pb-3">
									<div className="flex items-center gap-2">
										<Shield className="h-4 w-4 text-emerald-600" />
										<h4 className="font-bold text-xs uppercase tracking-wider text-gray-800">
											Rate Limit Inspection
										</h4>
									</div>
									<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
										Security Engine
									</span>
								</div>

								<div className="mt-3 space-y-2 text-xs">
									<div className="flex justify-between">
										<span className="text-gray-500">Detected Client IP:</span>
										<span className="font-mono font-bold text-gray-900">
											{clientRateLimitResult?.ip || "Inspect below"}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-500">Bucket Lock Status:</span>
										<span className="font-bold">
											{clientRateLimitResult?.isLocked ? (
												<span className="text-rose-600">LOCKED ({clientRateLimitResult.retryAfterSeconds}s)</span>
											) : (
												<span className="text-emerald-600">Clean / Unrestricted</span>
											)}
										</span>
									</div>
									<div className="text-[11px] text-gray-500 pt-1">
										Resets sliding buckets for login attempts, password-protected unblocks, and export floods.
									</div>
								</div>
							</div>

							<div className="mt-4 flex gap-2">
								<button
									className="flex-1 rounded-xl border border-gray-300 bg-white py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
									disabled={isPending}
									onClick={handleCheckClientRateLimit}
									type="button"
								>
									Inspect IP
								</button>
								<button
									className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
									disabled={isPending}
									onClick={handleResetClientRateLimit}
									type="button"
								>
									Reset My IP
								</button>
							</div>
						</div>

						{/* Express API & Database Benchmark */}
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col justify-between">
							<div>
								<div className="flex items-center justify-between border-b border-gray-100 pb-3">
									<div className="flex items-center gap-2">
										<Database className="h-4 w-4 text-purple-600" />
										<h4 className="font-bold text-xs uppercase tracking-wider text-gray-800">
											Database & API Probe
										</h4>
									</div>
									<span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
										MySQL Gateway
									</span>
								</div>

								<div className="mt-3 space-y-2 text-xs">
									<div className="flex justify-between">
										<span className="text-gray-500">Gateway URL:</span>
										<span className="font-mono text-gray-900 truncate max-w-[140px]">
											{maskedEnv.apiServerUrl}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-500">Status Response:</span>
										<span className="font-bold">
											{dbBenchmarkResult ? (
												<span className={dbBenchmarkResult.success ? "text-emerald-600" : "text-rose-600"}>
													{dbBenchmarkResult.status} ({dbBenchmarkResult.latencyMs}ms)
												</span>
											) : (
												<span className="text-gray-400">Not probed</span>
											)}
										</span>
									</div>
									{dbBenchmarkResult && (
										<div className="mt-2 rounded-xl bg-gray-50 p-2 font-mono text-[11px] text-gray-600 truncate">
											Response: {JSON.stringify(dbBenchmarkResult.data?.data || dbBenchmarkResult.status)}
										</div>
									)}
								</div>
							</div>

							<button
								className="mt-4 w-full rounded-xl border border-gray-300 bg-white py-2 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
								disabled={isPending}
								onClick={handleRunDbBenchmark}
								type="button"
							>
								{isPending ? "Pinging..." : "Ping API Gateway"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* TAB: FEEDBACK & BUG REPORTS */}
			{activeTab === "feedback" && (
				<DevFeedbackPanel />
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

					{/* Developer & Admin Renewal Email Notification Sender */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
						<div className="flex items-center gap-2 font-black text-lg text-gray-900">
							<Mail className="h-5 w-5 text-purple-600" />
							<span>Dispatch Subscription Notice Email</span>
						</div>
						<p className="text-xs text-gray-500">
							Send an official license status notice from developer systems directly to the Admin Email (<span className="font-mono text-purple-700 font-bold">{adminEmailsStr.split(",")[0]?.trim() || (license.adminEmails && license.adminEmails[0]) || "asmeepharma2022@gmail.com"}</span>) or designated contact inbox.
						</p>

						<div>
							<div className="flex items-center justify-between mb-1">
								<label className="block text-xs font-bold text-gray-700">Notification Recipient Email(s)</label>
								<span className="text-[11px] font-mono text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
									Admin Email: {adminEmailsStr.split(",")[0]?.trim() || (license.adminEmails && license.adminEmails[0]) || "asmeepharma2022@gmail.com"}
								</span>
							</div>
							<div className="flex gap-2">
								<input
									className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900"
									onChange={(e) => setAdminEmailsStr(e.target.value)}
									placeholder={(license.adminEmails && license.adminEmails[0]) || "asmeepharma2022@gmail.com"}
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
							<p className="mt-1 text-[11px] text-gray-500">
								Emails sent from this dev console are dispatched directly from developer systems (Zoho Mail) to the Admin Email.
							</p>
						</div>

						<div>
							<label className="block text-xs font-bold text-gray-700 mb-1.5">Dispatch Sender Email Gateway</label>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<label
									className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
										renewalSenderGateway === "ADMIN"
											? "border-[#0071BC] bg-blue-50/70 text-[#0B2545] font-bold"
											: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
									}`}
								>
									<input
										type="radio"
										name="renewalSenderGateway"
										value="ADMIN"
										checked={renewalSenderGateway === "ADMIN"}
										onChange={() => setRenewalSenderGateway("ADMIN")}
										className="text-[#0071BC] focus:ring-[#0071BC]"
									/>
									<div>
										<div>Admin Email (Gmail)</div>
										<div className="font-mono text-[11px] text-gray-500 font-normal">
											{maskedEnv.gmailUser || "info.devolvestudio@gmail.com"}
										</div>
									</div>
								</label>

								<label
									className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
										renewalSenderGateway === "DEVELOPER"
											? "border-purple-600 bg-purple-50/70 text-purple-950 font-bold"
											: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
									}`}
								>
									<input
										type="radio"
										name="renewalSenderGateway"
										value="DEVELOPER"
										checked={renewalSenderGateway === "DEVELOPER"}
										onChange={() => setRenewalSenderGateway("DEVELOPER")}
										className="text-purple-600 focus:ring-purple-500"
									/>
									<div>
										<div>Developer Email (Zoho SMTP)</div>
										<div className="font-mono text-[11px] text-gray-500 font-normal">
											{license.developerEmail || "info@devfinity.net"}
										</div>
									</div>
								</label>
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
							className={`rounded-xl px-5 py-2.5 font-bold text-xs text-white shadow-xs transition ${
								renewalSenderGateway === "ADMIN"
									? "bg-[#0071BC] hover:bg-[#005a96]"
									: "bg-purple-600 hover:bg-purple-700"
							}`}
							disabled={isPending}
							onClick={handleSendRenewalEmails}
							type="button"
						>
							{isPending
								? "Sending Notice..."
								: `Send Notice Email via ${renewalSenderGateway === "ADMIN" ? "Admin Email" : "Developer Email"} to (${adminEmailsStr.split(",")[0]?.trim() || (license.adminEmails && license.adminEmails[0]) || "asmeepharma2022@gmail.com"})`}
						</button>
					</div>
				</div>
			)}

			{/* TAB: PUSH NOTIFICATIONS & FIELD ALERTS */}
			{activeTab === "push" && (
				<div className="space-y-6">
					{/* Telemetry & Device Counters */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<span className="font-bold text-xs uppercase tracking-wider text-gray-500">
									Active Devices
								</span>
								<Bell className="h-4 w-4 text-purple-600" />
							</div>
							<div className="mt-2 flex items-baseline gap-2">
								<span className="font-black text-2xl text-gray-900">
									{pushSummary?.totalSubscriptions ?? "—"}
								</span>
								<span className="text-xs text-gray-500 font-medium">Registered Endpoints</span>
							</div>
						</div>

						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<span className="font-bold text-xs uppercase tracking-wider text-gray-500">
									Field MR Devices
								</span>
								<Users className="h-4 w-4 text-blue-600" />
							</div>
							<div className="mt-2 flex items-baseline gap-2">
								<span className="font-black text-2xl text-blue-700">
									{pushSummary?.mrCount ?? "—"}
								</span>
								<span className="text-xs text-gray-500 font-medium">MR Push Channels</span>
							</div>
						</div>

						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<span className="font-bold text-xs uppercase tracking-wider text-gray-500">
									Admin / Dev Devices
								</span>
								<Shield className="h-4 w-4 text-emerald-600" />
							</div>
							<div className="mt-2 flex items-baseline gap-2">
								<span className="font-black text-2xl text-emerald-700">
									{(pushSummary?.adminCount ?? 0) + (pushSummary?.devCount ?? 0)}
								</span>
								<span className="text-xs text-gray-500 font-medium">Management Channels</span>
							</div>
						</div>

						<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<span className="font-bold text-xs uppercase tracking-wider text-gray-500">
									In-App Alerts
								</span>
								<AlertTriangle className="h-4 w-4 text-amber-600" />
							</div>
							<div className="mt-2 flex items-baseline gap-2">
								<span className="font-black text-2xl text-amber-700">
									{pushSummary?.totalInAppNotifications ?? "—"}
								</span>
								<span className="text-xs text-gray-500 font-medium">Archived Alerts</span>
							</div>
						</div>
					</div>

					{/* Push Notification Dispatch Bench */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
							<div className="flex items-center gap-2">
								<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
									<Bell className="h-5 w-5" />
								</div>
								<div>
									<h2 className="font-black text-base text-gray-900">
										Interactive Push Notification Dispatch Bench
									</h2>
									<p className="text-xs text-gray-500">
										Send encrypted RFC 8292 Web Push notifications with vibration and system badges.
									</p>
								</div>
							</div>

							<button
								className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
								onClick={loadPushDiagnostics}
								type="button"
							>
								Refresh Telemetry
							</button>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<label className="block text-xs font-bold text-gray-700">Dispatch Target Audience</label>
								<select
									className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-bold text-gray-900"
									onChange={(e) => setPushTargetType(e.target.value as any)}
									value={pushTargetType}
								>
									<option value="CURRENT_USER">My Active Browser (Self-Test)</option>
									<option value="MR">Broadcast to All Active MRs</option>
									<option value="ADMIN">Broadcast to All Administrators</option>
									<option value="ALL">Platform-Wide Broadcast (All Users)</option>
									<option value="SPECIFIC_MR">Target Specific MR by ID</option>
								</select>
							</div>

							{pushTargetType === "SPECIFIC_MR" ? (
								<div>
									<label className="block text-xs font-bold text-gray-700">Select Target MR</label>
									<select
										className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-mono text-gray-900"
										onChange={(e) => setPushTargetMrId(e.target.value)}
										value={pushTargetMrId}
									>
										{mrList.slice(0, 50).map((m) => (
											<option key={m.id} value={m.id}>
												{m.name} ({m.id}) {m.division ? `- ${m.division}` : ""}
											</option>
										))}
									</select>
								</div>
							) : (
								<div>
									<label className="block text-xs font-bold text-gray-700">Target Deep Link</label>
									<select
										className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-mono text-gray-900"
										onChange={(e) => setPushDeepLink(e.target.value)}
										value={pushDeepLink}
									>
										<option value="/dashboard?tab=overdue">/dashboard?tab=overdue (Outstanding & Overdue)</option>
										<option value="/dashboard?tab=notices">/dashboard?tab=notices (Circulars & Notices)</option>
										<option value="/dashboard?tab=stock">/dashboard?tab=stock (Stock Movement)</option>
										<option value="/dashboard?tab=sales">/dashboard?tab=sales (Sales Statement)</option>
										<option value="/admin/dev">/admin/dev (Developer Control Center)</option>
									</select>
								</div>
							)}
						</div>

						<div>
							<label className="block text-xs font-bold text-gray-700">Push Notification Title</label>
							<input
								className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold text-gray-900"
								onChange={(e) => setPushTitle(e.target.value)}
								type="text"
								value={pushTitle}
							/>
						</div>

						<div>
							<label className="block text-xs font-bold text-gray-700">Notification Message Body</label>
							<textarea
								className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900"
								onChange={(e) => setPushBody(e.target.value)}
								rows={2}
								value={pushBody}
							/>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
							<p className="text-[11px] text-gray-500">
								Notifications are delivered via the browser Service Worker with vibration pattern [200, 100, 200] and click deep-linking.
							</p>

							<button
								className="rounded-xl bg-purple-600 px-5 py-2.5 font-bold text-xs text-white shadow-xs transition hover:bg-purple-700"
								disabled={isPending}
								onClick={handleDispatchPush}
								type="button"
							>
								{isPending ? "Dispatching Push..." : "Dispatch Web Push Notification"}
							</button>
						</div>

						{/* Result Output Card */}
						{pushResult && (
							<div
								className={`rounded-xl border p-4 text-xs font-mono ${
									pushResult.success
										? "border-emerald-200 bg-emerald-50 text-emerald-900"
										: "border-amber-200 bg-amber-50 text-amber-900"
								}`}
							>
								<div className="font-bold flex items-center gap-1.5">
									{pushResult.success ? (
										<CheckCircle2 className="h-4 w-4 text-emerald-600" />
									) : (
										<AlertTriangle className="h-4 w-4 text-amber-600" />
									)}
									<span>{pushResult.message}</span>
								</div>
								<div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
									<div>Delivered Devices: <span className="font-bold text-gray-900">{pushResult.sentCount ?? 0}</span></div>
									<div>Pruned Dead Endpoints: <span className="font-bold text-gray-900">{pushResult.prunedCount ?? 0}</span></div>
								</div>
							</div>
						)}
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
							<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
								<div className="relative flex-1 sm:w-80">
									<Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
									<input
										className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-4 text-xs font-medium text-gray-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
										onChange={(e) => setMrSearch(e.target.value)}
										placeholder="Search MR by name, code, company, or division..."
										type="text"
										value={mrSearch}
									/>
								</div>
								<span className="inline-flex items-center justify-center rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800 border border-purple-200 whitespace-nowrap">
									{filteredMRs.length} / {mrList.length} MRs
								</span>
							</div>
						</div>

						<div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
							<div className="max-h-[520px] overflow-y-auto">
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 bg-gray-50 font-bold text-gray-600 uppercase text-[11px] z-10 border-b border-gray-200">
										<tr>
											<th className="px-4 py-3">MR Name</th>
											<th className="px-4 py-3">MR Code</th>
											<th className="px-4 py-3">Company</th>
											<th className="px-4 py-3">Division</th>
											<th className="px-4 py-3">Rank</th>
											<th className="px-4 py-3 text-right">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{filteredMRs.length === 0 ? (
											<tr>
												<td colSpan={6} className="px-4 py-8 text-center text-gray-500">
													No MRs found matching &ldquo;{mrSearch}&rdquo;
												</td>
											</tr>
										) : (
											filteredMRs.map((mr) => (
												<tr className="hover:bg-purple-50/40 transition-colors" key={mr.id}>
													<td className="px-4 py-3">
														<div className="font-bold text-gray-900">{mr.name}</div>
														{mr.email && <div className="text-[11px] text-gray-400 font-mono">{mr.email}</div>}
													</td>
													<td className="px-4 py-3 font-mono font-semibold text-gray-700">{mr.id}</td>
													<td className="px-4 py-3">
														<div className="font-semibold text-gray-900">{mr.company || "All Companies"}</div>
														{mr.companyCode && <div className="text-[10px] text-gray-400 font-mono">Code: {mr.companyCode}</div>}
														{mr.assignedCompanies && mr.assignedCompanies.length > 1 && (
															<div className="text-[10px] text-purple-700 font-bold mt-0.5">
																+{mr.assignedCompanies.length - 1} more assigned
															</div>
														)}
													</td>
													<td className="px-4 py-3">
														<div className="flex flex-wrap gap-1 max-w-xs">
															{(mr.assignedDivisions && mr.assignedDivisions.length > 0
																? mr.assignedDivisions
																: mr.division ? [mr.division] : ["-"]
															).map((d: string) => (
																<span
																	key={d}
																	className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-800 text-[11px]"
																>
																	{d}
																</span>
															))}
														</div>
													</td>
													<td className="px-4 py-3">
														<span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800">
															Rank {mr.rank || 3}
														</span>
													</td>
													<td className="px-4 py-3 text-right">
														<button
															className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-purple-700 transition"
															disabled={isPending}
															onClick={() => handleStartImpersonate(mr.id)}
															type="button"
														>
															<Eye className="h-3.5 w-3.5" />
															View As MR
														</button>
													</td>
												</tr>
											))
										)}
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
												<td className="whitespace-nowrap px-4 py-2.5 text-gray-500" suppressHydrationWarning>
													<span suppressHydrationWarning>
														{new Date(log.timestamp).toLocaleTimeString()}
													</span>
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
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#0071BC]">
									<Terminal className="h-4 w-4" />
								</div>
								<h2 className="font-black text-lg text-gray-900">
									Stored Procedure Sandbox &amp; Debug SQL Generator
								</h2>
							</div>
							<p className="text-xs text-gray-500">
								Benchmark stored procedures against the legacy ERP MySQL engine and generate the exact <code className="font-mono text-purple-700 bg-purple-50 px-1 py-0.5 rounded font-bold">CALL ...</code> statements to run directly in MySQL Workbench, DBeaver, or phpMyAdmin.
							</p>
						</div>

						{/* Form Controls Grid */}
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
							<div>
								<label className="block text-xs font-bold text-gray-700">Stored Procedure</label>
								<select
									className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold text-gray-900 bg-white shadow-xs focus:ring-2 focus:ring-[#0071BC]"
									onChange={(e) => setSelectedProcedure(e.target.value)}
									value={selectedProcedure}
								>
									<option value="rptStockMovementStatement">rptStockMovementStatement (Stock Movement)</option>
									<option value="rptStockandSalesStatementReport">rptStockandSalesStatementReport (Stock &amp; Sales Statement)</option>
									<option value="rptItemCustomerSale">rptItemCustomerSale (Item Customer Sale)</option>
									<option value="rptMRwisePeriodicalOutstanding">rptMRwisePeriodicalOutstanding (Outstanding &amp; Overdue)</option>
									<option value="rptCompanyCustomerItemwiseSales">rptCompanyCustomerItemwiseSales (Company Customer Sales)</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-700">From Date</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-xs text-gray-900 bg-white shadow-xs focus:ring-2 focus:ring-[#0071BC]"
									onChange={(e) => setSandboxFromDate(e.target.value)}
									type="date"
									value={sandboxFromDate}
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-700">To Date</label>
								<input
									className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-xs text-gray-900 bg-white shadow-xs focus:ring-2 focus:ring-[#0071BC]"
									onChange={(e) => setSandboxToDate(e.target.value)}
									type="date"
									value={sandboxToDate}
								/>
							</div>

							{/* Search Company by Name or Code */}
							<div className="relative" ref={companyDropdownRef}>
								<div className="flex items-center justify-between mb-1">
									<label className="block text-xs font-bold text-gray-700">Company (Search Name or Code)</label>
									{sandboxCompanyCode && (
										<button
											type="button"
											onClick={() => {
												setSandboxCompanyCode("");
												setSandboxCompanySearch("");
												setIsCompanyDropdownOpen(false);
											}}
											className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
										>
											Clear
										</button>
									)}
								</div>

								<div className="relative">
									<input
										type="text"
										className="w-full rounded-xl border border-gray-300 p-2 pl-8 pr-16 text-xs text-gray-900 placeholder:text-gray-400 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0071BC]"
										placeholder="e.g. Asmee, 11, Generics..."
										value={sandboxCompanySearch}
										onChange={(e) => {
											setSandboxCompanySearch(e.target.value);
											setIsCompanyDropdownOpen(true);
										}}
										onFocus={() => setIsCompanyDropdownOpen(true)}
									/>
									<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
									{sandboxCompanyCode ? (
										<span className="absolute right-2 top-1.5 rounded-md bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-purple-800">
											Code: {sandboxCompanyCode}
										</span>
									) : (
										<span className="absolute right-2 top-2 text-[10px] text-gray-400 font-medium">
											All
										</span>
									)}
								</div>

								{/* Selected company preview badge */}
								{selectedCompanyInfo ? (
									<div className="mt-1.5 flex items-center justify-between rounded-lg bg-blue-50/80 border border-blue-200 px-2.5 py-1 text-[11px]">
										<div className="flex items-center gap-1.5 truncate">
											<Building2 className="h-3 w-3 text-blue-600 shrink-0" />
											<span className="font-bold text-blue-900 truncate">{selectedCompanyInfo.companyName}</span>
											{selectedCompanyInfo.divisionName && (
												<span className="text-gray-500 shrink-0 text-[10px]">({selectedCompanyInfo.divisionName})</span>
											)}
										</div>
										<span className="font-mono font-bold text-blue-700 shrink-0 ml-1">
											[{selectedCompanyInfo.companyCode}]
										</span>
									</div>
								) : sandboxCompanyCode ? (
									<div className="mt-1.5 flex items-center justify-between rounded-lg bg-gray-100 border border-gray-200 px-2.5 py-1 text-[11px]">
										<span className="text-gray-700">Custom Code: <strong className="font-mono text-purple-800">{sandboxCompanyCode}</strong></span>
									</div>
								) : (
									<div className="mt-1 text-[11px] text-gray-500">
										Filtering: <strong className="text-gray-700">All Marketing Companies</strong>
									</div>
								)}

								{/* Dropdown search popover */}
								{isCompanyDropdownOpen && (
									<div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl divide-y divide-gray-100">
										<div
											className="flex items-center justify-between p-2.5 text-xs hover:bg-gray-50 cursor-pointer font-bold text-gray-700 bg-gray-50/50"
											onClick={() => {
												setSandboxCompanyCode("");
												setSandboxCompanySearch("");
												setIsCompanyDropdownOpen(false);
											}}
										>
											<span>All Companies (No Filter / Blank Code)</span>
											<span className="font-mono text-[10px] text-gray-400">Code: &apos;&apos;</span>
										</div>

										{filteredCompanies.length === 0 ? (
											<div className="p-3 text-center text-xs text-gray-400">
												No companies match &quot;{sandboxCompanySearch}&quot;.
												<button
													type="button"
													onClick={() => {
														setSandboxCompanyCode(sandboxCompanySearch.trim());
														setIsCompanyDropdownOpen(false);
													}}
													className="mt-1.5 block mx-auto text-[#0071BC] font-bold text-[11px] underline"
												>
													Use &quot;{sandboxCompanySearch}&quot; as manual code
												</button>
											</div>
										) : (
											filteredCompanies.map((c, idx) => (
												<div
													key={`${c.companyCode}_${c.divisionName || "nodiv"}_${idx}`}
													className={`flex items-center justify-between p-2.5 text-xs hover:bg-blue-50 cursor-pointer transition-colors ${
														sandboxCompanyCode === c.companyCode ? "bg-blue-50 font-bold text-blue-900" : "text-gray-800"
													}`}
													onClick={() => {
														setSandboxCompanyCode(c.companyCode);
														setSandboxCompanySearch(c.companyName);
														setIsCompanyDropdownOpen(false);
													}}
												>
													<div className="truncate mr-2">
														<span className="font-semibold">{c.companyName}</span>
														{c.divisionName && (
															<span className="ml-1.5 text-[10px] text-gray-500 font-normal">
																• {c.divisionName}
															</span>
														)}
													</div>
													<span className="shrink-0 rounded bg-purple-100 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-800">
														{c.companyCode}
													</span>
												</div>
											))
										)}
									</div>
								)}
							</div>
						</div>

						{/* Live Generated Debug SQL Query Card */}
						<div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-xs font-mono shadow-md space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2.5">
								<div className="flex items-center gap-2">
									<Terminal className="h-4 w-4 text-emerald-400" />
									<span className="font-bold text-emerald-400 uppercase tracking-wide text-[11px]">
										Generated Debug SQL Query
									</span>
									<span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 font-mono">
										{selectedProcedure}
									</span>
								</div>

								<button
									type="button"
									onClick={() => handleCopySql(liveDebugSql)}
									className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-1 text-xs font-bold text-white transition-colors border border-gray-700"
								>
									{copiedSql ? (
										<>
											<Check className="h-3.5 w-3.5 text-emerald-400" />
											<span className="text-emerald-400">Copied!</span>
										</>
									) : (
										<>
											<Copy className="h-3.5 w-3.5 text-gray-300" />
											<span>Copy SQL Query</span>
										</>
									)}
								</button>
							</div>

							<div className="text-[11px] text-gray-400">
								Run directly in MySQL Workbench, DBeaver, or phpMyAdmin to verify raw database output against the web portal:
							</div>

							<div className="rounded-xl bg-black/60 p-3 overflow-x-auto border border-gray-800 select-all">
								<pre className="text-emerald-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
									{liveDebugSql}
								</pre>
							</div>
						</div>

						{/* Execution Action Button */}
						<div className="flex items-center gap-3">
							<button
								className="rounded-xl bg-[#0071BC] px-6 py-2.5 font-bold text-xs text-white shadow-xs hover:bg-[#005a96] transition flex items-center gap-2"
								disabled={isPending}
								onClick={handleRunSandbox}
								type="button"
							>
								<Play className="h-3.5 w-3.5" />
								<span>{isPending ? "Executing in MySQL Engine..." : "Execute & Benchmark Procedure in Backend"}</span>
							</button>

							<span className="text-xs text-gray-500 font-medium">
								Read-only query executed in isolated transaction.
							</span>
						</div>

						{/* Results & Verification View */}
						{sandboxResult && (
							<div className="mt-5 border-t border-gray-100 pt-5 space-y-4 font-mono">
								{/* Summary Status Badges */}
								<div className="flex flex-wrap gap-3 text-xs">
									<span
										className={`rounded-lg px-2.5 py-1 font-bold ${
											sandboxResult.success
												? "bg-emerald-100 text-emerald-800 border border-emerald-200"
												: "bg-rose-100 text-rose-800 border border-rose-200"
										}`}
									>
										Status: {sandboxResult.success ? "SUCCESS" : "ERROR"}
									</span>
									<span className="rounded-lg bg-blue-100 px-2.5 py-1 font-bold text-blue-800 border border-blue-200">
										Duration: {sandboxResult.data?.durationMs ?? sandboxResult.durationMs ?? 0} ms
									</span>
									<span className="rounded-lg bg-purple-100 px-2.5 py-1 font-bold text-purple-800 border border-purple-200">
										Rows Returned: {sandboxResult.data?.rowCount ?? sandboxResult.rowCount ?? 0}
									</span>
								</div>

								{/* Error Callout */}
								{sandboxResult.error && (
									<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-sans text-rose-900">
										<div className="font-bold flex items-center gap-1.5 mb-1 text-rose-700">
											<AlertOctagon className="h-4 w-4" />
											<span>Database Procedure Error</span>
										</div>
										<p>{sandboxResult.error}</p>
									</div>
								)}

								{/* Verified Backend Executed Query Card */}
								<div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<Terminal className="h-4 w-4 text-[#0071BC]" />
											<h4 className="font-bold text-xs uppercase tracking-wider text-gray-900">
												Backend Executed SQL Query (Direct DB Verification)
											</h4>
										</div>
										<button
											type="button"
											onClick={() =>
												handleCopySql(
													sandboxResult.debugSql ||
													sandboxResult.data?.debugSql ||
													liveDebugSql
												)
											}
											className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071BC] hover:bg-[#005a96] px-3 py-1 font-bold text-xs text-white shadow-xs transition"
										>
											{copiedSql ? (
												<>
													<Check className="h-3.5 w-3.5 text-white" />
													<span>Copied to Clipboard!</span>
												</>
											) : (
												<>
													<Copy className="h-3.5 w-3.5" />
													<span>Copy SQL for MySQL / DBeaver</span>
												</>
											)}
										</button>
									</div>
									<p className="text-[11px] text-gray-600 font-sans">
										Copy and run this exact statement directly in MySQL Workbench, DBeaver, or phpMyAdmin to verify raw procedure output against the portal:
									</p>
									<div className="rounded-xl bg-gray-900 p-3 font-mono text-xs text-emerald-400 overflow-x-auto select-all border border-gray-800">
										<code>
											{sandboxResult.debugSql || sandboxResult.data?.debugSql || liveDebugSql}
										</code>
									</div>
								</div>

								{/* Column Schema Badges */}
								{((sandboxResult.data?.columns || sandboxResult.columns) as string[])?.length > 0 && (
									<div className="space-y-1.5">
										<div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
											Result Columns ({((sandboxResult.data?.columns || sandboxResult.columns) as string[]).length})
										</div>
										<div className="flex flex-wrap gap-1 text-[11px]">
											{((sandboxResult.data?.columns || sandboxResult.columns) as string[]).map((c: string) => (
												<span className="rounded bg-gray-100 border border-gray-200 px-2 py-0.5 text-gray-700" key={c}>
													{c}
												</span>
											))}
										</div>
									</div>
								)}

								{/* Sample Rows JSON */}
								{((sandboxResult.data?.sampleRows || sandboxResult.sampleRows) as any[])?.length > 0 && (
									<div className="space-y-1.5">
										<div className="flex items-center justify-between text-[11px]">
											<span className="font-bold text-gray-600 uppercase tracking-wider">
												Sample Rows ({Math.min(10, ((sandboxResult.data?.sampleRows || sandboxResult.sampleRows) as any[]).length)} of {sandboxResult.data?.rowCount ?? sandboxResult.rowCount ?? 0})
											</span>
											<button
												type="button"
												onClick={() =>
													handleCopySql(
														JSON.stringify(
															sandboxResult.data?.sampleRows || sandboxResult.sampleRows,
															null,
															2
														)
													)
												}
												className="text-[11px] font-bold text-[#0071BC] hover:underline"
											>
												Copy Sample Rows JSON
											</button>
										</div>
										<div className="max-h-72 overflow-auto rounded-xl border border-gray-200 bg-gray-50 text-[11px]">
											<pre className="p-3 text-gray-800">
												{JSON.stringify(
													((sandboxResult.data?.sampleRows || sandboxResult.sampleRows) as any[]).slice(0, 10),
													null,
													2
												)}
											</pre>
										</div>
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

			{/* TAB: NOTICE BOARD & CIRCULARS */}
			{activeTab === "notices" && (
				<div className="space-y-6">
					{/* Hero / Quick Action Banner */}
					<div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-linear-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 text-white shadow-md">
						<div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/30 border border-purple-400/40 text-purple-300">
										<Megaphone className="h-4 w-4" />
									</div>
									<h2 className="font-black text-xl tracking-tight">Platform Notice Board &amp; Circulars</h2>
								</div>
								<p className="text-sm text-purple-200 max-w-2xl">
									Broadcast real-time announcements, festive greetings, or emergency alerts across the platform with fine-grained target audience segmentation.
								</p>
							</div>

							<div className="flex items-center gap-3">
								<button
									onClick={() => router.push("/admin/notices")}
									type="button"
									className="inline-flex items-center gap-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs px-4 py-2.5 shadow-sm transition-all"
								>
									<span>Launch Notice Manager</span>
									<ExternalLink className="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					</div>

					{/* Audience Segmentation Matrix */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
						<div>
							<h3 className="font-black text-lg text-gray-900">Target Audience Routing Matrix</h3>
							<p className="text-xs text-gray-500">
								When creating or activating a circular, the chosen target audience dictates which users receive the popup modal and automated Web Push notifications.
							</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
										MR
									</span>
									<span className="text-[11px] font-bold text-emerald-700">MRs Only</span>
								</div>
								<h4 className="font-bold text-sm text-gray-900">Medical Representatives</h4>
								<p className="text-xs text-gray-600">
									Broadcasts exclusively to field personnel. Renders upon opening the MR Dashboard and sends Web Push notifications to active MR device subscriptions.
								</p>
							</div>

							<div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
										ADMIN
									</span>
									<span className="text-[11px] font-bold text-indigo-700">Admins Only</span>
								</div>
								<h4 className="font-bold text-sm text-gray-900">Administrative Portal</h4>
								<p className="text-xs text-gray-600">
									Broadcasts to platform administrators. Renders on the Admin dashboard and management screens; bypasses field MR devices.
								</p>
							</div>

							<div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-2">
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-800">
										MR_AND_ADMIN
									</span>
									<span className="text-[11px] font-bold text-purple-700">MRs &amp; Admins</span>
								</div>
								<h4 className="font-bold text-sm text-gray-900">Field &amp; Office Synergy</h4>
								<p className="text-xs text-gray-600">
									Simultaneously broadcasts to both Field MRs and Administrative users. Does not trigger developer-specific internal workflows.
								</p>
							</div>

							<div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
										ALL
									</span>
									<span className="text-[11px] font-bold text-blue-700">Everyone</span>
								</div>
								<h4 className="font-bold text-sm text-gray-900">Platform-Wide Universal</h4>
								<p className="text-xs text-gray-600">
									Universal circular shown to all active users: MRs, Admins, and Developers. Automatic Web Push dispatched to all registered endpoint categories.
								</p>
							</div>

							<div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
										DEVELOPER
									</span>
									<span className="text-[11px] font-bold text-amber-700">Developers Only</span>
								</div>
								<h4 className="font-bold text-sm text-gray-900">Engineering &amp; Dev Team</h4>
								<p className="text-xs text-gray-600">
									Internal developer circulars. Visible only when logged in as a Developer. Hidden completely from MRs and standard Admins.
								</p>
							</div>

							<div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2 flex flex-col justify-between">
								<div>
									<div className="flex items-center justify-between">
										<span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-700">
											Web Push
										</span>
										<span className="text-[11px] font-bold text-gray-500">Auto-Dispatch</span>
									</div>
									<h4 className="font-bold text-sm text-gray-900 mt-2">Notification Push Engine</h4>
									<p className="text-xs text-gray-600">
										Activating any circular automatically creates notifications and delivers Web Push alerts to active devices in the selected target group.
									</p>
								</div>
								<button
									onClick={() => router.push("/admin/notices")}
									type="button"
									className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
								>
									<span>Configure Notices</span>
									<ExternalLink className="h-3 w-3" />
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
