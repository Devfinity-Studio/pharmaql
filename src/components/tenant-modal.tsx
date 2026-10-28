"use client";

import React, { useState, useEffect } from "react";
import {
	X,
	Server,
	Building,
	FileText,
	CheckCircle2,
	AlertCircle,
	Loader2,
	Eye,
	EyeOff,
	Globe,
	Activity,
	Palette,
	ShieldAlert,
	Sliders,
} from "lucide-react";
import {
	saveTenantAction,
	testApiServerConnectionAction,
	type TenantListItem,
	type SaveTenantInput,
	type ApiServerPingResult,
} from "@/modules/control-plane/tenantActions";

interface TenantModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSaved: () => void;
	initialTenant?: TenantListItem | null;
}

export function TenantModal({
	isOpen,
	onClose,
	onSaved,
	initialTenant,
}: TenantModalProps) {
	const isEdit = Boolean(initialTenant?.id);
	const [activeTab, setActiveTab] = useState<"general" | "stationery" | "erp" | "policies">("general");

	// 1. General & Domain
	const [slug, setSlug] = useState(initialTenant?.slug || "");
	const [displayName, setDisplayName] = useState(initialTenant?.display_name || "");
	const [shortName, setShortName] = useState(initialTenant?.short_name || "");
	const [customDomain, setCustomDomain] = useState(initialTenant?.custom_domain || "");
	const [primaryColor, setPrimaryColor] = useState(initialTenant?.primary_color || "#0B2545");
	const [accentColor, setAccentColor] = useState(initialTenant?.accent_color || "#134074");
	const [isActive, setIsActive] = useState(initialTenant ? initialTenant.is_active : true);

	// 2. Stationery & Contacts
	const [logoUrl, setLogoUrl] = useState(initialTenant?.logo_url || "");
	const [address, setAddress] = useState(initialTenant?.address || "");
	const [contactPhone, setContactPhone] = useState(initialTenant?.contact_phone || "");
	const [contactEmail, setContactEmail] = useState(initialTenant?.contact_email || "");
	const [supportEmail, setSupportEmail] = useState(initialTenant?.support_email || "");
	const [userEmailDomain, setUserEmailDomain] = useState(initialTenant?.user_email_domain || "");
	const [gstin, setGstin] = useState(initialTenant?.gstin || "");

	// 3. ERP & API Server Integration
	const [apiServerUrl, setApiServerUrl] = useState(initialTenant?.api_server_url || "");
	const [apiServerKey, setApiServerKey] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);
	const [erpSoftwareType, setErpSoftwareType] = useState(initialTenant?.erp_software_type || "Technomax");
	const [legacyDbName, setLegacyDbName] = useState(initialTenant?.legacy_db_name || "pdyasvmaster");
	const [compNo, setCompNo] = useState<number>(initialTenant?.comp_no ?? 11);
	const [locNo, setLocNo] = useState<number>(initialTenant?.loc_no ?? 11);

	// 4. Policies & Overdue
	const [overdueDirectBlockDays, setOverdueDirectBlockDays] = useState<number>(
		initialTenant?.overdue_direct_block_days ?? 90,
	);
	const [overdueDivisionBlockDays, setOverdueDivisionBlockDays] = useState<number>(
		initialTenant?.overdue_division_block_days ?? 95,
	);

	// Diagnostics & Submission state
	const [isTestingApi, setIsTestingApi] = useState(false);
	const [testResult, setTestResult] = useState<ApiServerPingResult | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	// Synchronize form fields whenever modal opens or editing tenant changes
	useEffect(() => {
		if (isOpen) {
			setSlug(initialTenant?.slug || "");
			setDisplayName(initialTenant?.display_name || "");
			setShortName(initialTenant?.short_name || "");
			setCustomDomain(initialTenant?.custom_domain || "");
			setPrimaryColor(initialTenant?.primary_color || "#0B2545");
			setAccentColor(initialTenant?.accent_color || "#134074");
			setIsActive(initialTenant ? initialTenant.is_active : true);

			setLogoUrl(initialTenant?.logo_url || "");
			setAddress(initialTenant?.address || "");
			setContactPhone(initialTenant?.contact_phone || "");
			setContactEmail(initialTenant?.contact_email || "");
			setSupportEmail(initialTenant?.support_email || "");
			setUserEmailDomain(initialTenant?.user_email_domain || "");
			setGstin(initialTenant?.gstin || "");

			setApiServerUrl(initialTenant?.api_server_url || "");
			setApiServerKey("");
			setShowApiKey(false);
			setErpSoftwareType(initialTenant?.erp_software_type || "Technomax");
			setLegacyDbName(initialTenant?.legacy_db_name || "pdyasvmaster");
			setCompNo(initialTenant?.comp_no ?? 11);
			setLocNo(initialTenant?.loc_no ?? 11);

			setOverdueDirectBlockDays(initialTenant?.overdue_direct_block_days ?? 90);
			setOverdueDivisionBlockDays(initialTenant?.overdue_division_block_days ?? 95);

			setTestResult(null);
			setFormError(null);
			setActiveTab("general");
		}
	}, [isOpen, initialTenant]);

	if (!isOpen) return null;

	const handleTestApi = async () => {
		setTestResult(null);
		setIsTestingApi(true);
		try {
			const res = await testApiServerConnectionAction({
				tenantId: initialTenant?.id,
				rawApiServerUrl: apiServerUrl.trim() || undefined,
				rawApiKey: apiServerKey.trim() || undefined,
			});
			setTestResult(res);
		} catch (err: any) {
			setTestResult({ success: false, error: err.message || "Failed to reach API server." });
		} finally {
			setIsTestingApi(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);

		if (!slug.trim()) {
			setFormError("Tenant slug is required.");
			setActiveTab("general");
			return;
		}
		if (!displayName.trim()) {
			setFormError("Display name is required.");
			setActiveTab("general");
			return;
		}

		setIsSubmitting(true);
		try {
			const payload: SaveTenantInput = {
				id: initialTenant?.id,
				slug: slug.trim(),
				display_name: displayName.trim(),
				short_name: shortName.trim() || null,
				custom_domain: customDomain.trim() || null,
				primary_color: primaryColor.trim() || "#0B2545",
				accent_color: accentColor.trim() || "#134074",
				is_active: isActive,
				logo_url: logoUrl.trim() || null,
				address: address.trim() || null,
				contact_phone: contactPhone.trim() || null,
				contact_email: contactEmail.trim() || null,
				support_email: supportEmail.trim() || null,
				user_email_domain: userEmailDomain.trim() || null,
				gstin: gstin.trim() || null,
				api_server_url: apiServerUrl.trim() || null,
				api_server_key: apiServerKey.trim() || null,
				legacy_db_name: legacyDbName.trim() || "pdyasvmaster",
				erp_software_type: erpSoftwareType.trim() || "Technomax",
				comp_no: Number(compNo),
				loc_no: Number(locNo),
				overdue_direct_block_days: Number(overdueDirectBlockDays),
				overdue_division_block_days: Number(overdueDivisionBlockDays),
			};

			const res = await saveTenantAction(payload);
			if (res.success) {
				onSaved();
				onClose();
			} else {
				setFormError(res.error || "Failed to save tenant.");
			}
		} catch (err: any) {
			setFormError(err.message || "An unexpected error occurred.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
			<div className="relative w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 text-white shadow-2xl overflow-hidden my-8">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-gray-950/60">
					<div className="flex items-center gap-3">
						<div
							className="p-2 rounded-xl border"
							style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}50` }}
						>
							<Building className="w-5 h-5 text-blue-400" />
						</div>
						<div>
							<h3 className="text-lg font-bold">
								{isEdit ? `Edit Tenant: ${initialTenant?.display_name}` : "Onboard New Client Organization"}
							</h3>
							<p className="text-xs text-gray-400">
								Configure dynamic branding, domain routing, API Server credentials, CompNo/LocNo, and policies
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Navigation Tabs */}
				<div className="flex border-b border-gray-800 bg-gray-950/40 px-6 pt-2 gap-2 overflow-x-auto">
					<button
						type="button"
						onClick={() => setActiveTab("general")}
						className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
							activeTab === "general"
								? "border-blue-500 text-blue-400 bg-gray-800/50"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						<Globe className="w-3.5 h-3.5" />
						1. General & Domain
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("stationery")}
						className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
							activeTab === "stationery"
								? "border-blue-500 text-blue-400 bg-gray-800/50"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						<FileText className="w-3.5 h-3.5" />
						2. Stationery & Contacts
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("erp")}
						className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
							activeTab === "erp"
								? "border-blue-500 text-blue-400 bg-gray-800/50"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						<Server className="w-3.5 h-3.5" />
						3. ERP & API Server
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("policies")}
						className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
							activeTab === "policies"
								? "border-blue-500 text-blue-400 bg-gray-800/50"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						<ShieldAlert className="w-3.5 h-3.5" />
						4. Overdue Policies
					</button>
				</div>

				{/* Form Body */}
				<form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
					{formError && (
						<div className="flex items-center gap-2 p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl">
							<AlertCircle className="w-4 h-4 shrink-0" />
							<span>{formError}</span>
						</div>
					)}

					{/* Tab 1: General & Domain */}
					{activeTab === "general" && (
						<div className="space-y-4">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Display / Legal Company Name <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="e.g. Asmee Pharma Pvt. Ltd."
										value={displayName}
										onChange={(e) => setDisplayName(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Short Name (Brand Label)
									</label>
									<input
										type="text"
										placeholder="e.g. Asmee"
										value={shortName}
										onChange={(e) => setShortName(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Tenant Slug <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="e.g. asmee"
										value={slug}
										onChange={(e) => setSlug(e.target.value.toLowerCase())}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
									/>
									<p className="text-[11px] text-gray-500 mt-1">
										Local URL: <span className="text-blue-400 font-mono">{slug ? `${slug}.localhost:3000` : "slug.localhost:3000"}</span>
									</p>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Custom Production Domain
									</label>
									<input
										type="text"
										placeholder="e.g. portal.asmeepharma.com"
										value={customDomain}
										onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
									/>
									<p className="text-[11px] text-gray-500 mt-1">Production incoming host header</p>
								</div>
							</div>

							{/* Dynamic Color Scheme */}
							<div className="p-3 bg-gray-950/70 border border-gray-800 rounded-xl space-y-3">
								<div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
									<Palette className="w-4 h-4 text-purple-400" />
									Client Brand Color Scheme
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label className="block text-[11px] text-gray-400 mb-1">Primary Brand Color</label>
										<div className="flex items-center gap-2">
											<input
												type="color"
												value={primaryColor}
												onChange={(e) => setPrimaryColor(e.target.value)}
												className="w-9 h-9 rounded-lg border border-gray-700 bg-transparent cursor-pointer p-0.5"
											/>
											<input
												type="text"
												value={primaryColor}
												onChange={(e) => setPrimaryColor(e.target.value)}
												className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs font-mono text-white"
											/>
										</div>
									</div>
									<div>
										<label className="block text-[11px] text-gray-400 mb-1">Accent Color</label>
										<div className="flex items-center gap-2">
											<input
												type="color"
												value={accentColor}
												onChange={(e) => setAccentColor(e.target.value)}
												className="w-9 h-9 rounded-lg border border-gray-700 bg-transparent cursor-pointer p-0.5"
											/>
											<input
												type="text"
												value={accentColor}
												onChange={(e) => setAccentColor(e.target.value)}
												className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs font-mono text-white"
											/>
										</div>
									</div>
								</div>
							</div>

							<div className="flex items-center gap-3 p-3 bg-gray-950/60 border border-gray-800 rounded-xl">
								<input
									type="checkbox"
									id="is-active-check"
									checked={isActive}
									onChange={(e) => setIsActive(e.target.checked)}
									className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
								/>
								<label htmlFor="is-active-check" className="text-xs text-gray-300 font-medium cursor-pointer">
									Active Status (Enables client domain resolution and user login)
								</label>
							</div>
						</div>
					)}

					{/* Tab 2: Stationery & Contacts */}
					{activeTab === "stationery" && (
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-gray-300 mb-1">
									Brand Logo URL
								</label>
								<input
									type="text"
									placeholder="https://example.com/logo.png or /logo.png"
									value={logoUrl}
									onChange={(e) => setLogoUrl(e.target.value)}
									className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
								/>
								<p className="text-[11px] text-gray-500 mt-1">Rendered on printable headers, sidebar, and PDF reports</p>
							</div>

							<div>
								<label className="block text-xs font-medium text-gray-300 mb-1">
									Physical Address / Corporate Office
								</label>
								<textarea
									rows={2}
									placeholder="e.g. 401, Apollo Enclave, RC Dutt Road, Alkapuri, Vadodara, Gujarat 390007"
									value={address}
									onChange={(e) => setAddress(e.target.value)}
									className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										GSTIN Number
									</label>
									<input
										type="text"
										placeholder="e.g. 24AABCA1234F1Z5"
										value={gstin}
										onChange={(e) => setGstin(e.target.value.toUpperCase())}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Contact Phone
									</label>
									<input
										type="text"
										placeholder="e.g. +91 98765 43210"
										value={contactPhone}
										onChange={(e) => setContactPhone(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Contact Email
									</label>
									<input
										type="email"
										placeholder="e.g. info@client.com"
										value={contactEmail}
										onChange={(e) => setContactEmail(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-800">
								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Support / Notification Email
									</label>
									<input
										type="email"
										placeholder="e.g. asmeepharma2022@gmail.com"
										value={supportEmail}
										onChange={(e) => setSupportEmail(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
									/>
									<p className="text-[11px] text-gray-500 mt-1">Receives alerts, license notices, and feedback</p>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Default MR User Email Domain
									</label>
									<input
										type="text"
										placeholder="e.g. @asmeepharma.com"
										value={userEmailDomain}
										onChange={(e) => setUserEmailDomain(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
									/>
									<p className="text-[11px] text-gray-500 mt-1">Appended when MR logs in with numeric username</p>
								</div>
							</div>
						</div>
					)}

					{/* Tab 3: ERP & API Server Integration */}
					{activeTab === "erp" && (
						<div className="space-y-4">
							{/* Client API Server Configuration */}
							<div className="p-4 bg-gray-950/80 border border-gray-800 rounded-xl space-y-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Server className="w-4 h-4 text-cyan-400" />
										<span className="text-xs font-bold text-white">Client On-Premises API Server</span>
									</div>
									{isEdit && initialTenant?.has_api_key && (
										<span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
											✓ API Key Configured
										</span>
									)}
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-medium text-gray-300 mb-1">
											API Server Base URL
										</label>
										<input
											type="text"
											placeholder="https://api.asmeepharma.com"
											value={apiServerUrl}
											onChange={(e) => setApiServerUrl(e.target.value)}
											className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
										/>
										<p className="text-[10px] text-gray-500 mt-1">
											Hosts Technomax queries and runs native api-server.exe
										</p>
									</div>

									<div>
										<label className="block text-xs font-medium text-gray-300 mb-1">
											API Secret Key (AES-256-GCM Encrypted)
										</label>
										<div className="relative">
											<input
												type={showApiKey ? "text" : "password"}
												placeholder={
													isEdit && initialTenant?.has_api_key
														? "•••••••• (Leave blank to keep current key)"
														: "Enter API authentication key"
												}
												value={apiServerKey}
												onChange={(e) => setApiServerKey(e.target.value)}
												className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
											/>
											<button
												type="button"
												onClick={() => setShowApiKey(!showApiKey)}
												className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
											>
												{showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
											</button>
										</div>
										<p className="text-[10px] text-gray-500 mt-1">
											Encrypted in Neon using CONTROL_PLANE_ENCRYPTION_KEY
										</p>
									</div>
								</div>

								{/* Inline API Server Test Diagnostics */}
								<div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
									<div className="flex items-center gap-1.5 text-xs text-gray-400">
										<Activity className="w-3.5 h-3.5 text-cyan-400" />
										Verification: <span className="font-mono text-gray-300">Health & Auth Token</span>
									</div>
									<button
										type="button"
										onClick={handleTestApi}
										disabled={isTestingApi || (!apiServerUrl.trim() && !initialTenant?.api_server_url)}
										className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-750 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded-lg transition-colors disabled:opacity-50"
									>
										{isTestingApi ? (
											<>
												<Loader2 className="w-3.5 h-3.5 animate-spin" />
												Pinging API...
											</>
										) : (
											<>
												<Activity className="w-3.5 h-3.5" />
												Test API Server
											</>
										)}
									</button>
								</div>

								{testResult && (
									<div
										className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
											testResult.success
												? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
												: "bg-rose-500/10 border-rose-500/30 text-rose-300"
										}`}
									>
										{testResult.success ? (
											<>
												<CheckCircle2 className="w-4 h-4 shrink-0" />
												<span>
													<strong>Connected:</strong> API status <span className="font-mono">{testResult.status}</span> (DB: {testResult.db}) in{" "}
													<span className="font-mono">{testResult.latencyMs}ms</span>
												</span>
											</>
										) : (
											<>
												<AlertCircle className="w-4 h-4 shrink-0" />
												<span>{testResult.error}</span>
											</>
										)}
									</div>
								)}
							</div>

							{/* ERP SQL Parameter Identifiers */}
							<div className="p-3 bg-gray-950/70 border border-gray-800 rounded-xl space-y-3">
								<div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
									<Sliders className="w-4 h-4 text-emerald-400" />
									ERP System & Stored Procedure SQL Parameters
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label className="block text-[11px] text-gray-400 mb-1">ERP Software Platform</label>
										<input
											type="text"
											placeholder="Technomax / Marg / Busy"
											value={erpSoftwareType}
											onChange={(e) => setErpSoftwareType(e.target.value)}
											className="w-full px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white"
										/>
									</div>
									<div>
										<label className="block text-[11px] text-gray-400 mb-1">Primary Legacy DB Name</label>
										<input
											type="text"
											placeholder="e.g. pdyasvmaster"
											value={legacyDbName}
											onChange={(e) => setLegacyDbName(e.target.value)}
											className="w-full px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs font-mono text-white"
										/>
									</div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label className="block text-[11px] text-gray-400 mb-1">Company No (`CompNo`)</label>
										<input
											type="number"
											placeholder="11"
											value={compNo}
											onChange={(e) => setCompNo(Number(e.target.value))}
											className="w-full px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs font-mono text-white"
										/>
										<p className="text-[10px] text-gray-500 mt-0.5">Passed as first parameter to stored procedures</p>
									</div>
									<div>
										<label className="block text-[11px] text-gray-400 mb-1">Location No (`LocNo`)</label>
										<input
											type="number"
											placeholder="11"
											value={locNo}
											onChange={(e) => setLocNo(Number(e.target.value))}
											className="w-full px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs font-mono text-white"
										/>
										<p className="text-[10px] text-gray-500 mt-0.5">Passed as location parameter to stored procedures</p>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Tab 4: Policies & Overdue */}
					{activeTab === "policies" && (
						<div className="space-y-4">
							<div className="p-4 bg-gray-950/70 border border-gray-800 rounded-xl space-y-4">
								<div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
									<ShieldAlert className="w-4 h-4 text-amber-400" />
									Automated MR Overdue Blocking Thresholds
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-medium text-gray-300 mb-1">
											Direct MR Overdue Block Days
										</label>
										<input
											type="number"
											min={30}
											max={180}
											value={overdueDirectBlockDays}
											onChange={(e) => setOverdueDirectBlockDays(Number(e.target.value))}
											className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-blue-500"
										/>
										<p className="text-[11px] text-gray-500 mt-1">
											Individual MR blocked from login when any pending invoice exceeds this number of days (default: 90)
										</p>
									</div>

									<div>
										<label className="block text-xs font-medium text-gray-300 mb-1">
											Division Cascading Block Days
										</label>
										<input
											type="number"
											min={30}
											max={180}
											value={overdueDivisionBlockDays}
											onChange={(e) => setOverdueDivisionBlockDays(Number(e.target.value))}
											className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-blue-500"
										/>
										<p className="text-[11px] text-gray-500 mt-1">
											All peer MRs in the division blocked when an invoice exceeds this threshold (default: 95)
										</p>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Footer Buttons */}
					<div className="flex items-center justify-between pt-4 border-t border-gray-800">
						<div className="flex items-center gap-2">
							<span
								className="w-4 h-4 rounded-full border border-white/20"
								style={{ backgroundColor: primaryColor }}
								title="Theme Preview"
							/>
							<span className="text-xs text-gray-400">
								Color: <span className="font-mono">{primaryColor}</span>
							</span>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={onClose}
								className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
							>
								{isSubmitting ? (
									<>
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
										Saving Tenant...
									</>
								) : isEdit ? (
									"Update Tenant"
								) : (
									"Onboard Tenant"
								)}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
