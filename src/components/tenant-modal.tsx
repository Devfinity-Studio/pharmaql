"use client";

import React, { useState } from "react";
import {
	X,
	Database,
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
} from "lucide-react";
import {
	saveTenantAction,
	testDbConnectionAction,
	type TenantListItem,
	type SaveTenantInput,
	type DbPingResult,
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
	const [activeTab, setActiveTab] = useState<"general" | "stationery" | "database">("general");

	// Form Fields
	const [slug, setSlug] = useState(initialTenant?.slug || "");
	const [displayName, setDisplayName] = useState(initialTenant?.display_name || "");
	const [shortName, setShortName] = useState(initialTenant?.short_name || "");
	const [customDomain, setCustomDomain] = useState(initialTenant?.custom_domain || "");
	const [isActive, setIsActive] = useState(initialTenant ? initialTenant.is_active : true);

	// Stationery
	const [logoUrl, setLogoUrl] = useState(initialTenant?.logo_url || "");
	const [address, setAddress] = useState(initialTenant?.address || "");
	const [contactPhone, setContactPhone] = useState(initialTenant?.contact_phone || "");
	const [contactEmail, setContactEmail] = useState(initialTenant?.contact_email || "");
	const [gstin, setGstin] = useState(initialTenant?.gstin || "");

	// Database & API
	const [dbType, setDbType] = useState<"postgres" | "api_server">(
		initialTenant?.db_type || "postgres",
	);
	const [dbConnection, setDbConnection] = useState("");
	const [showDbConnection, setShowDbConnection] = useState(false);
	const [apiServerUrl, setApiServerUrl] = useState(initialTenant?.api_server_url || "");
	const [apiServerKey, setApiServerKey] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);

	// Diagnostics & Submission state
	const [isTestingDb, setIsTestingDb] = useState(false);
	const [testResult, setTestResult] = useState<DbPingResult | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleTestDb = async () => {
		setTestResult(null);
		setIsTestingDb(true);
		try {
			const res = await testDbConnectionAction({
				tenantId: initialTenant?.id,
				rawDbConnection: dbConnection.trim() || undefined,
			});
			setTestResult(res);
		} catch (err: any) {
			setTestResult({ success: false, error: err.message || "Failed to run ping test." });
		} finally {
			setIsTestingDb(false);
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
				is_active: isActive,
				logo_url: logoUrl.trim() || null,
				address: address.trim() || null,
				contact_phone: contactPhone.trim() || null,
				contact_email: contactEmail.trim() || null,
				gstin: gstin.trim() || null,
				db_type: dbType,
				db_connection: dbConnection.trim() || null,
				api_server_url: apiServerUrl.trim() || null,
				api_server_key: apiServerKey.trim() || null,
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
						<div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
							<Building className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-lg font-bold">
								{isEdit ? `Edit Tenant: ${initialTenant?.display_name}` : "Register New Client Tenant"}
							</h3>
							<p className="text-xs text-gray-400">
								Configure white-label branding, domain routing, and encrypted database credentials
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

				{/* Tabs */}
				<div className="flex border-b border-gray-800 bg-gray-950/30 px-6 pt-2 gap-2">
					<button
						type="button"
						onClick={() => setActiveTab("general")}
						className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
							activeTab === "general"
								? "border-blue-500 text-blue-400 bg-gray-800/50"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						<Globe className="w-3.5 h-3.5" />
						General & Domain
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("stationery")}
						className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
							activeTab === "stationery"
								? "border-blue-500 text-blue-400 bg-gray-800/50"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						<FileText className="w-3.5 h-3.5" />
						Stationery & Branding
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("database")}
						className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
							activeTab === "database"
								? "border-blue-500 text-blue-400 bg-gray-800/50"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						<Database className="w-3.5 h-3.5" />
						Database & Connectivity
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-6 space-y-4">
					{formError && (
						<div className="flex items-center gap-2 p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl">
							<AlertCircle className="w-4 h-4 shrink-0" />
							<span>{formError}</span>
						</div>
					)}

					{/* Tab 1: General */}
					{activeTab === "general" && (
						<div className="space-y-4">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Display Name <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="e.g. Asmee Pharma Pvt Ltd"
										value={displayName}
										onChange={(e) => setDisplayName(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Short Name
									</label>
									<input
										type="text"
										placeholder="e.g. Asmee Pharma"
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
									<p className="text-[11px] text-gray-500 mt-1">Unique subdomain key or internal identifier</p>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										Custom Domain
									</label>
									<input
										type="text"
										placeholder="e.g. portal.asmeepharma.com"
										value={customDomain}
										onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
									/>
									<p className="text-[11px] text-gray-500 mt-1">Incoming host header used for Edge routing</p>
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
									Active Status (Enables client domain resolution and access)
								</label>
							</div>
						</div>
					)}

					{/* Tab 2: Stationery */}
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
								<p className="text-[11px] text-gray-500 mt-1">Rendered on printable headers, sidebar, and PDF exports</p>
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
										placeholder="e.g. admin@asmeepharma.com"
										value={contactEmail}
										onChange={(e) => setContactEmail(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
									/>
								</div>
							</div>
						</div>
					)}

					{/* Tab 3: Database & API */}
					{activeTab === "database" && (
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-gray-300 mb-1">
									Database Architecture Type
								</label>
								<div className="flex gap-4">
									<label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
										<input
											type="radio"
											name="dbType"
											value="postgres"
											checked={dbType === "postgres"}
											onChange={() => setDbType("postgres")}
											className="text-blue-600 focus:ring-blue-500"
										/>
										Direct Dedicated Postgres
									</label>
									<label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
										<input
											type="radio"
											name="dbType"
											value="api_server"
											checked={dbType === "api_server"}
											onChange={() => setDbType("api_server")}
											className="text-blue-600 focus:ring-blue-500"
										/>
										On-Premises Windows API Server (.exe)
									</label>
								</div>
							</div>

							<div>
								<div className="flex items-center justify-between mb-1">
									<label className="block text-xs font-medium text-gray-300">
										PostgreSQL Connection URI (Encrypted with AES-256-GCM)
									</label>
									{isEdit && initialTenant?.has_db_connection && (
										<span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
											✓ Credential Configured
										</span>
									)}
								</div>
								<div className="relative">
									<input
										type={showDbConnection ? "text" : "password"}
										placeholder={
											isEdit && initialTenant?.has_db_connection
												? "•••••••• (Leave blank to keep current encrypted secret)"
												: "postgresql://user:password@host.aws.neon.tech:5432/dbname?sslmode=require"
										}
										value={dbConnection}
										onChange={(e) => setDbConnection(e.target.value)}
										className="w-full px-3 py-2 pr-10 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
									/>
									<button
										type="button"
										onClick={() => setShowDbConnection(!showDbConnection)}
										className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
									>
										{showDbConnection ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
									</button>
								</div>
								<p className="text-[11px] text-gray-500 mt-1">
									Automatically encrypted using `CONTROL_PLANE_ENCRYPTION_KEY`. Always queried with `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`.
								</p>
							</div>

							{/* Connection Test Diagnostics */}
							<div className="p-3 bg-gray-950/80 border border-gray-800 rounded-xl space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
										<Activity className="w-3.5 h-3.5 text-blue-400" />
										Live Connectivity Diagnostic
									</span>
									<button
										type="button"
										onClick={handleTestDb}
										disabled={isTestingDb || (!dbConnection.trim() && !initialTenant?.has_db_connection)}
										className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-750 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50"
									>
										{isTestingDb ? (
											<>
												<Loader2 className="w-3.5 h-3.5 animate-spin" />
												Pinging DB...
											</>
										) : (
											<>
												<Server className="w-3.5 h-3.5" />
												Test Connection
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
													<strong>Connected:</strong> {testResult.db} ({testResult.version}) in{" "}
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

							{/* API Server Section */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-800">
								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										API Server URL
									</label>
									<input
										type="text"
										placeholder="https://api.clientb.com:8443"
										value={apiServerUrl}
										onChange={(e) => setApiServerUrl(e.target.value)}
										className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-gray-300 mb-1">
										API Server Secret Key
									</label>
									<div className="relative">
										<input
											type={showApiKey ? "text" : "password"}
											placeholder={
												isEdit && initialTenant?.has_api_key
													? "•••••••• (Leave blank to keep current key)"
													: "Encrypted API Auth Key"
											}
											value={apiServerKey}
											onChange={(e) => setApiServerKey(e.target.value)}
											className="w-full px-3 py-2 pr-10 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 font-mono"
										/>
										<button
											type="button"
											onClick={() => setShowApiKey(!showApiKey)}
											className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
										>
											{showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Modal Footer */}
					<div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
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
								"Register Tenant"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
