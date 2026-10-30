"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Building2,
	Globe,
	Database,
	ShieldCheck,
	CheckCircle2,
	AlertCircle,
	ArrowLeft,
	Save,
	Key,
	Eye,
	EyeOff,
	RefreshCw,
	Sparkles,
	Copy,
	Check,
	Lock,
	Server,
	Activity,
	Mail,
	Send,
	CheckCheck,
} from "lucide-react";
import {
	saveTenantAction,
	testApiServerConnectionAction,
	testTenantSmtpAction,
	type SaveTenantInput,
	type ApiServerPingResult,
} from "@/modules/control-plane/tenantActions";

interface TenantFormProps {
	mode: "create" | "edit";
	initialTenant?: any;
}

export function TenantForm({ mode, initialTenant }: TenantFormProps) {
	const router = useRouter();

	// 1. Core Identity & Branding
	const [slug, setSlug] = useState(initialTenant?.slug || "");
	const [displayName, setDisplayName] = useState(initialTenant?.display_name || "");
	const [shortName, setShortName] = useState(initialTenant?.short_name || "");
	const [customDomain, setCustomDomain] = useState(initialTenant?.custom_domain || "");
	const [primaryColor, setPrimaryColor] = useState(initialTenant?.primary_color || "#0B2545");
	const [accentColor, setAccentColor] = useState(initialTenant?.accent_color || "#134074");
	const [isActive, setIsActive] = useState(initialTenant ? Boolean(initialTenant.is_active) : true);

	// 2. Stationery & Contacts
	const [logoUrl, setLogoUrl] = useState(initialTenant?.logo_url || "");
	const [address, setAddress] = useState(initialTenant?.address || "");
	const [contactPhone, setContactPhone] = useState(initialTenant?.contact_phone || "");
	const [contactEmail, setContactEmail] = useState(initialTenant?.contact_email || "");
	const [supportEmail, setSupportEmail] = useState(initialTenant?.support_email || "");
	const [userEmailDomain, setUserEmailDomain] = useState(initialTenant?.user_email_domain || "");
	const [gstin, setGstin] = useState(initialTenant?.gstin || "");

	// 3. Database & ERP Integration
	const [apiServerUrl, setApiServerUrl] = useState(initialTenant?.api_server_url || "");
	const [apiServerKey, setApiServerKey] = useState(initialTenant?.api_server_key || "");
	const [showApiKey, setShowApiKey] = useState(false);
	const [legacyDbName, setLegacyDbName] = useState(initialTenant?.legacy_db_name || "pdyasvmaster");
	const [erpSoftwareType, setErpSoftwareType] = useState(initialTenant?.erp_software_type || "Technomax");
	const [compNo, setCompNo] = useState<number>(initialTenant?.comp_no ?? 11);
	const [locNo, setLocNo] = useState<number>(initialTenant?.loc_no ?? 11);
	const [overdueDirectBlockDays, setOverdueDirectBlockDays] = useState<number>(
		initialTenant?.overdue_direct_block_days ?? 90,
	);
	const [overdueDivisionBlockDays, setOverdueDivisionBlockDays] = useState<number>(
		initialTenant?.overdue_division_block_days ?? 95,
	);

	// 4. Tenant Administrator Credentials
	const [adminEmail, setAdminEmail] = useState(initialTenant?.admin_email || "");
	const [adminPassword, setAdminPassword] = useState(initialTenant?.admin_password || "");
	const [showAdminPassword, setShowAdminPassword] = useState(false);
	const [copiedPassword, setCopiedPassword] = useState(false);

	// 5. Tenant Custom SMTP Configuration
	const [smtpHost, setSmtpHost] = useState(initialTenant?.smtp_host || "");
	const [smtpPort, setSmtpPort] = useState<number>(initialTenant?.smtp_port ?? 465);
	const [smtpSecure, setSmtpSecure] = useState<boolean>(
		initialTenant?.smtp_secure !== undefined && initialTenant?.smtp_secure !== null
			? Boolean(initialTenant.smtp_secure)
			: true,
	);
	const [smtpUser, setSmtpUser] = useState(initialTenant?.smtp_user || "");
	const [smtpPassword, setSmtpPassword] = useState(initialTenant?.smtp_password || "");
	const [showSmtpPassword, setShowSmtpPassword] = useState(false);
	const [smtpFromName, setSmtpFromName] = useState(initialTenant?.smtp_from_name || "");
	const [smtpFromEmail, setSmtpFromEmail] = useState(initialTenant?.smtp_from_email || "");
	const [smtpPreset, setSmtpPreset] = useState<string>("custom");

	// SMTP Diagnostics
	const [isTestingSmtp, setIsTestingSmtp] = useState(false);
	const [smtpTestResult, setSmtpTestResult] = useState<{
		success: boolean;
		latencyMs?: number;
		error?: string;
	} | null>(null);
	const [testRecipientType, setTestRecipientType] = useState<"admin" | "custom">("admin");
	const [customRecipientEmail, setCustomRecipientEmail] = useState("");

	// Diagnostics & Submitting
	const [isTestingApi, setIsTestingApi] = useState(false);
	const [testResult, setTestResult] = useState<ApiServerPingResult | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState<string | null>(null);

	// Auto-derive slug if creating
	const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setDisplayName(val);
		if (mode === "create" && !slug) {
			const autoSlug = val
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "");
			setSlug(autoSlug);
		}
	};

	const generateRandomKey = () => {
		const chars = "abcdef0123456789";
		let key = "";
		for (let i = 0; i < 64; i++) {
			key += chars[Math.floor(Math.random() * chars.length)];
		}
		setApiServerKey(key);
	};

	const generateRandomPassword = () => {
		const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		const lower = "abcdefghijklmnopqrstuvwxyz";
		const numbers = "0123456789";
		const symbols = "@#$!%*?&";
		const all = upper + lower + numbers + symbols;

		let pass = "";
		pass += upper[Math.floor(Math.random() * upper.length)];
		pass += lower[Math.floor(Math.random() * lower.length)];
		pass += numbers[Math.floor(Math.random() * numbers.length)];
		pass += symbols[Math.floor(Math.random() * symbols.length)];
		for (let i = 4; i < 14; i++) {
			pass += all[Math.floor(Math.random() * all.length)];
		}
		setAdminPassword(pass);
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedPassword(true);
			setTimeout(() => setCopiedPassword(false), 2000);
		} catch {}
	};

	const handleTestApi = async () => {
		setTestResult(null);
		setIsTestingApi(true);
		try {
			const res = await testApiServerConnectionAction({
				apiServerUrl: apiServerUrl.trim(),
				apiKey: apiServerKey.trim() || undefined,
				tenantId: initialTenant?.id,
			});
			setTestResult(res);
		} catch (err: any) {
			setTestResult({ success: false, error: err.message || "Failed to reach API server." });
		} finally {
			setIsTestingApi(false);
		}
	};

	const applySmtpPreset = (preset: string) => {
		setSmtpPreset(preset);
		if (preset === "zoho_in") {
			setSmtpHost("smtp.zoho.in");
			setSmtpPort(465);
			setSmtpSecure(true);
		} else if (preset === "zoho_com") {
			setSmtpHost("smtp.zoho.com");
			setSmtpPort(465);
			setSmtpSecure(true);
		} else if (preset === "gmail") {
			setSmtpHost("smtp.gmail.com");
			setSmtpPort(465);
			setSmtpSecure(true);
		} else if (preset === "office365") {
			setSmtpHost("smtp.office365.com");
			setSmtpPort(587);
			setSmtpSecure(false);
		}
	};

	const handleTestSmtp = async () => {
		setIsTestingSmtp(true);
		setSmtpTestResult(null);
		try {
			const recipient =
				testRecipientType === "admin"
					? adminEmail.trim() || smtpUser.trim()
					: customRecipientEmail.trim();

			if (!recipient) {
				setSmtpTestResult({
					success: false,
					error: "Please enter a valid recipient email address.",
				});
				setIsTestingSmtp(false);
				return;
			}

			const res = await testTenantSmtpAction({
				tenantId: initialTenant?.id,
				smtpHost: smtpHost.trim(),
				smtpPort: Number(smtpPort) || 465,
				smtpSecure,
				smtpUser: smtpUser.trim(),
				smtpPassword: smtpPassword.trim() || undefined,
				smtpFromName: smtpFromName.trim() || displayName.trim(),
				smtpFromEmail: smtpFromEmail.trim() || smtpUser.trim(),
				recipientEmail: recipient,
			});
			setSmtpTestResult(res);
		} catch (err: any) {
			setSmtpTestResult({
				success: false,
				error: err.message || "Failed to test SMTP connection.",
			});
		} finally {
			setIsTestingSmtp(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);
		setFormSuccess(null);

		if (!slug.trim()) {
			setFormError("Tenant slug is required.");
			return;
		}
		if (!displayName.trim()) {
			setFormError("Organization display name is required.");
			return;
		}

		setIsSubmitting(true);
		try {
			const input: SaveTenantInput = {
				id: initialTenant?.id,
				slug: slug.trim(),
				custom_domain: customDomain.trim() || null,
				is_active: isActive,
				display_name: displayName.trim(),
				short_name: shortName.trim() || null,
				logo_url: logoUrl.trim() || null,
				primary_color: primaryColor.trim() || null,
				accent_color: accentColor.trim() || null,
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
				comp_no: Number(compNo) || 11,
				loc_no: Number(locNo) || 11,
				overdue_direct_block_days: Number(overdueDirectBlockDays) || 90,
				overdue_division_block_days: Number(overdueDivisionBlockDays) || 95,
				admin_email: adminEmail.trim() || null,
				admin_password: adminPassword.trim() || null,
				smtp_host: smtpHost.trim() || null,
				smtp_port: Number(smtpPort) || 465,
				smtp_secure: smtpSecure,
				smtp_user: smtpUser.trim() || null,
				smtp_password: smtpPassword.trim() || null,
				smtp_from_name: smtpFromName.trim() || null,
				smtp_from_email: smtpFromEmail.trim() || null,
			};

			const result = await saveTenantAction(input);
			if (!result.success) {
				setFormError(result.error || "Failed to save tenant.");
				setIsSubmitting(false);
				return;
			}

			setFormSuccess(
				mode === "create"
					? "Tenant onboarded successfully! Redirecting to Control Center..."
					: "Tenant updated successfully!",
			);

			setTimeout(() => {
				router.push("/admin/tenants");
				router.refresh();
			}, 1200);
		} catch (err: any) {
			setFormError(err.message || "An unexpected error occurred.");
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-8 pb-16">
			{/* Sticky Top-Bar Header */}
			<div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 -mx-4 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
				<div className="flex items-center gap-4">
					<Link
						href="/admin/tenants"
						className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
						title="Back to Tenants List"
					>
						<ArrowLeft className="w-5 h-5" />
					</Link>
					<div>
						<h1 className="text-xl font-bold text-white flex items-center gap-2">
							<Building2 className="w-6 h-6 text-teal-400" />
							{mode === "create" ? "Onboard New Client Organization" : `Edit Tenant: ${displayName || slug}`}
						</h1>
						<p className="text-xs text-slate-400">
							{mode === "create"
								? "Configure multi-tenant routing, custom domain, ERP integration, and admin credentials."
								: `Unique UUID: ${initialTenant?.id || "N/A"}`}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 w-full sm:w-auto justify-end">
					<button
						type="button"
						onClick={() => setIsActive(!isActive)}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
							isActive
								? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
								: "bg-rose-500/20 text-rose-400 border border-rose-500/30"
						}`}
					>
						<span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-rose-400"}`} />
						{isActive ? "Status: Active" : "Status: Suspended"}
					</button>

					<Link
						href="/admin/tenants"
						className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
					>
						Cancel
					</Link>

					<button
						type="submit"
						disabled={isSubmitting}
						className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
					>
						{isSubmitting ? (
							<>
								<RefreshCw className="w-4 h-4 animate-spin" />
								Saving...
							</>
						) : (
							<>
								<Save className="w-4 h-4" />
								{mode === "create" ? "Complete Onboarding" : "Save Changes"}
							</>
						)}
					</button>
				</div>
			</div>

			{/* Status Alerts */}
			{formError && (
				<div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
					<AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
					<div className="flex-1">
						<p className="font-semibold">Validation Error</p>
						<p>{formError}</p>
					</div>
				</div>
			)}

			{formSuccess && (
				<div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-3">
					<CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
					<div className="flex-1">
						<p className="font-semibold">Success</p>
						<p>{formSuccess}</p>
					</div>
				</div>
			)}

			{/* Section 1: Organization Identity & Branding */}
			<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
				<div className="flex items-center gap-3 border-b border-slate-800 pb-4">
					<div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
						<Building2 className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-lg font-bold text-white">1. Organization Identity & White-Label Branding</h2>
						<p className="text-xs text-slate-400">
							Defines legal entity naming, sub-domain route, corporate colors, and document stationery.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Display Name (Legal Entity) <span className="text-rose-400">*</span>
						</label>
						<input
							type="text"
							required
							placeholder="e.g. Asmee Pharma Pvt. Ltd."
							value={displayName}
							onChange={handleDisplayNameChange}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none transition-colors"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Short Name / Brand Display
						</label>
						<input
							type="text"
							placeholder="e.g. Asmee"
							value={shortName}
							onChange={(e) => setShortName(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none transition-colors"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Routing Slug <span className="text-rose-400">*</span>
						</label>
						<div className="flex rounded-xl overflow-hidden border border-slate-700 bg-slate-950 focus-within:border-teal-500 transition-colors">
							<span className="px-3 py-2.5 bg-slate-800 text-xs text-slate-400 select-none">
								https://
							</span>
							<input
								type="text"
								required
								placeholder="asmee"
								value={slug}
								onChange={(e) =>
									setSlug(
										e.target.value
											.toLowerCase()
											.replace(/[^a-z0-9-]/g, "-"),
									)
								}
								className="flex-1 px-3 py-2.5 bg-transparent text-white text-sm focus:outline-none font-mono"
							/>
							<span className="px-3 py-2.5 bg-slate-800 text-xs text-slate-400 select-none">
								.pharmaql.devfinity.net
							</span>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Logo URL (Public Asset)
						</label>
						<div className="flex gap-3 items-center">
							<input
								type="text"
								placeholder="https://example.com/logo.png or /logo.png"
								value={logoUrl}
								onChange={(e) => setLogoUrl(e.target.value)}
								className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none transition-colors"
							/>
							{logoUrl && (
								<div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
									<img
										src={logoUrl}
										alt="Preview"
										className="max-h-full max-w-full object-contain"
										onError={(e) => {
											(e.target as HTMLElement).style.display = "none";
										}}
									/>
								</div>
							)}
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Corporate Primary Color
						</label>
						<div className="flex items-center gap-3">
							<input
								type="color"
								value={primaryColor}
								onChange={(e) => setPrimaryColor(e.target.value)}
								className="w-10 h-10 rounded-lg bg-transparent cursor-pointer border border-slate-700 p-0.5"
							/>
							<input
								type="text"
								value={primaryColor}
								onChange={(e) => setPrimaryColor(e.target.value)}
								className="w-32 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-teal-500 focus:outline-none"
							/>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Corporate Accent Color
						</label>
						<div className="flex items-center gap-3">
							<input
								type="color"
								value={accentColor}
								onChange={(e) => setAccentColor(e.target.value)}
								className="w-10 h-10 rounded-lg bg-transparent cursor-pointer border border-slate-700 p-0.5"
							/>
							<input
								type="text"
								value={accentColor}
								onChange={(e) => setAccentColor(e.target.value)}
								className="w-32 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-teal-500 focus:outline-none"
							/>
						</div>
					</div>

					<div className="md:col-span-2">
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Registered Stationery Address
						</label>
						<textarea
							rows={2}
							placeholder="Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none transition-colors"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact Phone</label>
						<input
							type="text"
							placeholder="+91 98765 43210"
							value={contactPhone}
							onChange={(e) => setContactPhone(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Support Email</label>
						<input
							type="email"
							placeholder="support@asmeepharma.com"
							value={supportEmail}
							onChange={(e) => setSupportEmail(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">Staff Email Domain</label>
						<input
							type="text"
							placeholder="@asmeepharma.com"
							value={userEmailDomain}
							onChange={(e) => setUserEmailDomain(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">GSTIN Registration</label>
						<input
							type="text"
							placeholder="24AAAAA0000A1Z5"
							value={gstin}
							onChange={(e) => setGstin(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none uppercase font-mono"
						/>
					</div>
				</div>
			</div>

			{/* Section 2: Custom Domain & DNS */}
			<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
				<div className="flex items-center gap-3 border-b border-slate-800 pb-4">
					<div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
						<Globe className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-lg font-bold text-white">2. Custom Domain & DNS Mapping</h2>
						<p className="text-xs text-slate-400">
							Route client staff and medical representatives to their own branded domain.
						</p>
					</div>
				</div>

				<div className="space-y-4">
					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Client Custom Domain FQDN
						</label>
						<input
							type="text"
							placeholder="portal.asmeepharma.com"
							value={customDomain}
							onChange={(e) => setCustomDomain(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-sky-500 focus:outline-none transition-colors font-mono"
						/>
					</div>

					<div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
						<p className="font-semibold text-slate-300 flex items-center gap-1.5">
							<Activity className="w-4 h-4 text-sky-400" /> DNS Configuration Requirements:
						</p>
						<ul className="list-disc list-inside space-y-1 text-slate-400">
							<li>
								For Subdomains (e.g., <code className="text-sky-300">portal.client.com</code>): Add a{" "}
								<strong>CNAME</strong> record pointing to{" "}
								<code className="text-emerald-400 font-mono">cname.vercel-dns.com</code>.
							</li>
							<li>
								For Apex Domains (e.g., <code className="text-sky-300">client.com</code>): Add an{" "}
								<strong>A</strong> record pointing to{" "}
								<code className="text-emerald-400 font-mono">76.76.21.21</code>.
							</li>
							<li>
								If Vercel credentials are configured, the domain is automatically registered in your Vercel
								Production project upon saving.
							</li>
						</ul>
					</div>
				</div>
			</div>

			{/* Section 3: Database & ERP Bridge Engine */}
			<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
				<div className="flex items-center gap-3 border-b border-slate-800 pb-4">
					<div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
						<Database className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-lg font-bold text-white">3. Database & ERP Bridge Engine (Technomax)</h2>
						<p className="text-xs text-slate-400">
							Connection parameters, query injection codes, and live database latency diagnostics.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="md:col-span-2">
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							On-Premise ERP Bridge URL <span className="text-rose-400">*</span>
						</label>
						<input
							type="text"
							placeholder="https://api.asmeepharma.com or http://192.168.1.100:3005"
							value={apiServerUrl}
							onChange={(e) => setApiServerUrl(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none transition-colors font-mono"
						/>
					</div>

					<div className="md:col-span-2">
						<div className="flex items-center justify-between mb-1.5">
							<label className="text-xs font-semibold text-slate-300">
								API Bridge Secret Bearer Key (AES-256-GCM Encrypted)
							</label>
							<button
								type="button"
								onClick={generateRandomKey}
								className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
							>
								<Sparkles className="w-3.5 h-3.5" />
								Generate Random Key
							</button>
						</div>
						<div className="relative">
							<input
								type={showApiKey ? "text" : "password"}
								placeholder={
									initialTenant?.has_api_key && !apiServerKey
										? "•••••••••••••••••••••••••••••••• (Encrypted in Cloud DB)"
										: "Enter secret key or generate random"
								}
								value={apiServerKey}
								onChange={(e) => setApiServerKey(e.target.value)}
								className="w-full px-3.5 py-2.5 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-amber-500 focus:outline-none"
							/>
							<button
								type="button"
								onClick={() => setShowApiKey(!showApiKey)}
								className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
							>
								{showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
							</button>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Database Name (<code className="text-amber-400">legacy_db_name</code>)
						</label>
						<input
							type="text"
							placeholder="pdyasvmaster"
							value={legacyDbName}
							onChange={(e) => setLegacyDbName(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							ERP Software Type
						</label>
						<input
							type="text"
							placeholder="Technomax"
							value={erpSoftwareType}
							onChange={(e) => setErpSoftwareType(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Company Number (<code className="text-amber-400">comp_no</code>)
						</label>
						<input
							type="number"
							value={compNo}
							onChange={(e) => setCompNo(Number(e.target.value))}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
						/>
						<p className="text-[11px] text-slate-500 mt-1">Injected into Technomax stored procedures.</p>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Location Number (<code className="text-amber-400">loc_no</code>)
						</label>
						<input
							type="number"
							value={locNo}
							onChange={(e) => setLocNo(Number(e.target.value))}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
						/>
						<p className="text-[11px] text-slate-500 mt-1">Injected into inventory & outstanding queries.</p>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Direct Overdue Auto-Block Days
						</label>
						<input
							type="number"
							value={overdueDirectBlockDays}
							onChange={(e) => setOverdueDirectBlockDays(Number(e.target.value))}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Division Overdue Auto-Block Days
						</label>
						<input
							type="number"
							value={overdueDivisionBlockDays}
							onChange={(e) => setOverdueDivisionBlockDays(Number(e.target.value))}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
						/>
					</div>

					<div className="md:col-span-2 pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
						<button
							type="button"
							onClick={handleTestApi}
							disabled={isTestingApi || !apiServerUrl.trim()}
							className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
						>
							{isTestingApi ? (
								<>
									<RefreshCw className="w-4 h-4 animate-spin" /> Testing Database Ping...
								</>
							) : (
								<>
									<Server className="w-4 h-4" /> Test Connection & Latency
								</>
							)}
						</button>

						{testResult && (
							<div
								className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
									testResult.success
										? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
										: "bg-rose-500/10 text-rose-400 border border-rose-500/20"
								}`}
							>
								{testResult.success ? (
									<CheckCircle2 className="w-4 h-4 text-emerald-400" />
								) : (
									<AlertCircle className="w-4 h-4 text-rose-400" />
								)}
								<span>
									{testResult.success
										? `Connected in ${testResult.latencyMs}ms (${testResult.status || "OK"})`
										: testResult.error || "Connection Failed"}
								</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Section 4: Tenant Administrator Account */}
			<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
				<div className="flex items-center gap-3 border-b border-slate-800 pb-4">
					<div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
						<ShieldCheck className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-lg font-bold text-white">4. Tenant Administrator Credentials</h2>
						<p className="text-xs text-slate-400">
							Isolated administrative sign-in account created specifically for this client organization.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Tenant Admin Email Address
						</label>
						<input
							type="email"
							placeholder="admin@asmeepharma.com"
							value={adminEmail}
							onChange={(e) => setAdminEmail(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors"
						/>
						<p className="text-[11px] text-slate-500 mt-1">
							Used to log in at <code className="text-indigo-400">/login</code> on this tenant's domain.
						</p>
					</div>

					<div>
						<div className="flex items-center justify-between mb-1.5">
							<label className="text-xs font-semibold text-slate-300">
								Tenant Admin Password
							</label>
							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={generateRandomPassword}
									className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
								>
									<Key className="w-3.5 h-3.5" />
									Generate Strong
								</button>
								{adminPassword && (
									<button
										type="button"
										onClick={() => copyToClipboard(adminPassword)}
										className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
									>
										{copiedPassword ? (
											<Check className="w-3.5 h-3.5 text-emerald-400" />
										) : (
											<Copy className="w-3.5 h-3.5" />
										)}
										{copiedPassword ? "Copied!" : "Copy"}
									</button>
								)}
							</div>
						</div>
						<div className="relative">
							<input
								type={showAdminPassword ? "text" : "password"}
								placeholder={
									initialTenant?.has_admin_password && !adminPassword
										? "•••••••••••••••• (Encrypted in Cloud DB)"
										: "Enter secure password"
								}
								value={adminPassword}
								onChange={(e) => setAdminPassword(e.target.value)}
								className="w-full px-3.5 py-2.5 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
							/>
							<button
								type="button"
								onClick={() => setShowAdminPassword(!showAdminPassword)}
								className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
							>
								{showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
							</button>
						</div>
					</div>

					<div className="md:col-span-2 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-300/80 space-y-1">
						<p className="font-semibold text-indigo-300 flex items-center gap-1.5">
							<Lock className="w-4 h-4" /> Tenant Security Isolation Guarantee
						</p>
						<p>
							Credentials stored here are encrypted using AES-256-GCM. When field representatives or
							administrators sign in on a client portal (e.g. <code>portal.asmeepharma.com</code>), the login
							pipeline authenticates exclusively against this tenant's admin account.
						</p>
					</div>
				</div>
			</div>

			{/* Section 5: Email & Notification Services (SMTP) */}
			<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
				<div className="flex items-center gap-3 border-b border-slate-800 pb-4">
					<div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
						<Mail className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-lg font-bold text-white">5. Dedicated Email & Notification Services (SMTP)</h2>
						<p className="text-xs text-slate-400">
							Configure custom SMTP delivery for OTP codes, alerts, and transactional messages originating from this organization.
						</p>
					</div>
				</div>

				{/* 1-Click Provider Presets */}
				<div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
							<Sparkles className="w-4 h-4 text-teal-400" /> 1-Click Provider Quick Presets
						</span>
						<span className="text-[11px] text-slate-500">Auto-configures host, port, and security layer</span>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
						{[
							{ id: "zoho_in", name: "Zoho Mail (India)", host: "smtp.zoho.in:465" },
							{ id: "zoho_com", name: "Zoho Mail (Global)", host: "smtp.zoho.com:465" },
							{ id: "gmail", name: "Google / Gmail", host: "smtp.gmail.com:465" },
							{ id: "office365", name: "Microsoft 365", host: "smtp.office365.com:587" },
							{ id: "custom", name: "Custom SMTP", host: "Manual Settings" },
						].map((p) => (
							<button
								key={p.id}
								type="button"
								onClick={() => applySmtpPreset(p.id)}
								className={`p-2.5 rounded-xl border text-left transition-all ${
									smtpPreset === p.id
										? "bg-teal-500/15 border-teal-500/50 text-teal-200"
										: "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
								}`}
							>
								<p className="text-xs font-semibold truncate">{p.name}</p>
								<p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{p.host}</p>
							</button>
						))}
					</div>
					{smtpPreset === "gmail" && (
						<p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
							💡 <strong>Google Workspace / Gmail Tip:</strong> Generate an <em>App Password</em> in your Google Account security settings (2FA required) and paste it below. Never use your raw personal password.
						</p>
					)}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							SMTP Host Server
						</label>
						<input
							type="text"
							placeholder="smtp.zoho.in"
							value={smtpHost}
							onChange={(e) => setSmtpHost(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-teal-500 focus:outline-none"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-slate-300 mb-1.5">
								Port
							</label>
							<input
								type="number"
								placeholder="465"
								value={smtpPort}
								onChange={(e) => setSmtpPort(Number(e.target.value) || 465)}
								className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-teal-500 focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-slate-300 mb-1.5">
								Security Protocol
							</label>
							<button
								type="button"
								onClick={() => setSmtpSecure(!smtpSecure)}
								className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
									smtpSecure
										? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
										: "bg-sky-500/10 border-sky-500/30 text-sky-400"
								}`}
							>
								<Lock className="w-3.5 h-3.5" />
								{smtpSecure ? "SSL / TLS (Secure)" : "STARTTLS (TLS)"}
							</button>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							SMTP Username / Sender Address
						</label>
						<input
							type="email"
							placeholder="notifications@asmeepharma.com"
							value={smtpUser}
							onChange={(e) => setSmtpUser(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
						/>
						<p className="text-[11px] text-slate-500 mt-1">
							The authenticated account used to connect and send messages.
						</p>
					</div>

					<div>
						<div className="flex items-center justify-between mb-1.5">
							<label className="text-xs font-semibold text-slate-300">
								SMTP Password / App Key
							</label>
						</div>
						<div className="relative">
							<input
								type={showSmtpPassword ? "text" : "password"}
								placeholder={
									initialTenant?.has_smtp_password && !smtpPassword
										? "•••••••••••••••• (Encrypted in Cloud DB)"
										: "Enter SMTP App Password"
								}
								value={smtpPassword}
								onChange={(e) => setSmtpPassword(e.target.value)}
								className="w-full px-3.5 py-2.5 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-teal-500 focus:outline-none"
							/>
							<button
								type="button"
								onClick={() => setShowSmtpPassword(!showSmtpPassword)}
								className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
							>
								{showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
							</button>
						</div>
						<p className="text-[11px] text-slate-500 mt-1">
							Encrypted with AES-256-GCM. Never transmitted to client browsers.
						</p>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Custom "From" Display Name (Optional)
						</label>
						<input
							type="text"
							placeholder={displayName || "Asmee Pharma Verification"}
							value={smtpFromName}
							onChange={(e) => setSmtpFromName(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-300 mb-1.5">
							Custom "From" Sender Email (Optional)
						</label>
						<input
							type="email"
							placeholder={smtpUser || "no-reply@asmeepharma.com"}
							value={smtpFromEmail}
							onChange={(e) => setSmtpFromEmail(e.target.value)}
							className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
						/>
					</div>

					{/* Live Test Diagnostics Panel */}
					<div className="md:col-span-2 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<Send className="w-4 h-4 text-teal-400" />
								<h3 className="text-sm font-bold text-white">Live SMTP Handshake & Delivery Test</h3>
							</div>

							<button
								type="button"
								disabled={isTestingSmtp || !smtpHost || !smtpUser}
								onClick={handleTestSmtp}
								className="px-4 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold transition-all flex items-center gap-2 self-start sm:self-auto disabled:opacity-40"
							>
								{isTestingSmtp ? (
									<>
										<RefreshCw className="w-3.5 h-3.5 animate-spin" />
										Testing Handshake...
									</>
								) : (
									<>
										<CheckCheck className="w-3.5 h-3.5" />
										Send Test Verification Email
									</>
								)}
							</button>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
							<div className="flex items-center gap-4">
								<label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
									<input
										type="radio"
										name="testRecipient"
										checked={testRecipientType === "admin"}
										onChange={() => setTestRecipientType("admin")}
										className="accent-teal-500"
									/>
									Send to Admin ({adminEmail || smtpUser || "Not set"})
								</label>
								<label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
									<input
										type="radio"
										name="testRecipient"
										checked={testRecipientType === "custom"}
										onChange={() => setTestRecipientType("custom")}
										className="accent-teal-500"
									/>
									Custom Recipient
								</label>
							</div>

							{testRecipientType === "custom" && (
								<input
									type="email"
									placeholder="Enter your personal email for test delivery"
									value={customRecipientEmail}
									onChange={(e) => setCustomRecipientEmail(e.target.value)}
									className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-teal-500 focus:outline-none"
								/>
							)}
						</div>

						{smtpTestResult && (
							<div
								className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
									smtpTestResult.success
										? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
										: "bg-rose-500/10 border-rose-500/30 text-rose-300"
								}`}
							>
								{smtpTestResult.success ? (
									<CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
								) : (
									<AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
								)}
								<div>
									<p className="font-semibold">
										{smtpTestResult.success
											? `SMTP Handshake & Test Dispatch Succeeded (${smtpTestResult.latencyMs}ms)`
											: "SMTP Handshake Verification Failed"}
									</p>
									{smtpTestResult.error && (
										<p className="text-[11px] mt-0.5 text-rose-200/90">{smtpTestResult.error}</p>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</form>
	);
}
