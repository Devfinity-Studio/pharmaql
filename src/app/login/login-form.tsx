"use client";

import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	KeyRound,
	Mail,
	PhoneCall,
	ShieldAlert,
	ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import {
	loginAdminOrDev,
	requestMrOtp,
	verifyMrOtp,
} from "@/server/actions/authActions";

export function LoginForm() {
	useEffect(() => {
		const keysToRemove = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (key && key.startsWith("seen_notice_")) {
				keysToRemove.push(key);
			}
		}
		for (const k of keysToRemove) {
			sessionStorage.removeItem(k);
		}
	}, []);

	const searchParams = useSearchParams();
	const reason = searchParams.get("reason");
	const requestedMode = searchParams.get("mode");
	const isDevAccess = searchParams.get("dev") === "1" || searchParams.get("access") === "dev";

	const [mode, setMode] = useState<"mr" | "admin">(
		requestedMode === "admin" || isDevAccess ? "admin" : "mr",
	);
	const [step, setStep] = useState<"request" | "otp">("request");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [error, setError] = useState(
		reason === "session_revoked"
			? "Your active session was terminated by an administrator. Please sign in again."
			: "",
	);
	const [successMsg, setSuccessMsg] = useState("");
	const [loading, setLoading] = useState(false);
	const [blockedInfo, setBlockedInfo] = useState<any>(null);
	const router = useRouter();

	useEffect(() => {
		if (requestedMode === "admin" || isDevAccess) {
			setMode("admin");
		}
	}, [requestedMode, isDevAccess]);

	async function handleMrOtpRequest(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");
		setSuccessMsg("");
		setBlockedInfo(null);

		const res = await requestMrOtp(email);
		if (!res.success) {
			if (res.statusDetails?.isBlocked) {
				setBlockedInfo(res.statusDetails);
			} else {
				setError(res.error || "Failed to send OTP.");
			}
			setLoading(false);
		} else {
			setSuccessMsg(res.message || `OTP sent to ${res.email}`);
			setStep("otp");
			setLoading(false);
		}
	}

	async function handleMrOtpVerify(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const res = await verifyMrOtp(email, otp);
		if (!res.success) {
			if ((res as any).statusDetails?.isBlocked) {
				setBlockedInfo((res as any).statusDetails);
			} else {
				setError(res.error || "Invalid OTP code.");
			}
			setLoading(false);
		} else {
			setBlockedInfo(null);
			router.push("/dashboard");
			router.refresh();
		}
	}

	async function handleAdminLogin(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");
		setBlockedInfo(null);

		const res = await loginAdminOrDev(email, password);
		if (!res.success) {
			setError(res.error || "Login failed.");
			setLoading(false);
		} else {
			if (res.user?.role === "DEVELOPER") {
				router.push("/admin/dev");
			} else if (res.user?.role === "ADMIN") {
				router.push("/admin/dashboard");
			} else {
				router.push("/dashboard");
			}
			router.refresh();
		}
	}

	// Dedicated Contact Admin Blocked State View
	if (blockedInfo) {
		const isDivisionBlocked = blockedInfo.status === "DIVISION_BLOCKED";
		const isDirectBlocked = blockedInfo.status === "DIRECT_BLOCKED";
		const isManualBlocked = blockedInfo.status === "MANUAL_BLOCKED";

		return (
			<div className="border border-red-200 bg-white px-5 py-8 shadow-md sm:rounded-2xl sm:px-8">
				{/* Header Status */}
				<div className="flex flex-col items-center text-center">
					<div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 ring-8 ring-red-50">
						<ShieldAlert className="h-7 w-7" />
					</div>
					<span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 font-bold text-red-800 text-xs uppercase tracking-wider">
						Account Suspended
					</span>
					<h3 className="mt-2 font-bold text-gray-900 text-xl tracking-tight">
						{isDirectBlocked && "Account Suspended: Overdue Payment"}
						{isDivisionBlocked && "Division Access Suspended"}
						{isManualBlocked && "Account Suspended by Admin"}
					</h3>
					<p className="mt-1 font-medium text-gray-600 text-sm">
						{blockedInfo.mrName || email}
					</p>
				</div>

				{/* Primary Explanation Box */}
				<div className="mt-5 rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-900 leading-relaxed">
					<p className="font-semibold text-red-950">
						{blockedInfo.message ||
							"Your account is currently suspended due to overdue invoices exceeding credit terms."}
					</p>
				</div>

				{/* If Division Cascading Block (>95 Days) */}
				{isDivisionBlocked && (
					<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-950">
						<div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
							<AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
							Division-Wide Policy (&gt;95 Days Overdue)
						</div>
						<p className="mt-1 text-amber-900/90 leading-relaxed">
							Under company policy, when any representative within division{" "}
							<span className="font-bold underline">
								{blockedInfo.divisionName || "Assigned Division"}
							</span>{" "}
							has unpaid invoices exceeding <strong>95 days</strong>, access for
							all representatives in that division is temporarily paused until
							the overdue invoice is resolved.
						</p>

						<div className="mt-3 divide-y divide-amber-200/80 rounded-lg border border-amber-200 bg-white/80 p-3 font-mono text-[11px]">
							<div className="flex justify-between py-1">
								<span className="text-gray-500">Responsible Representative:</span>
								<span className="font-bold text-gray-900">
									{blockedInfo.responsibleMrName} (MR #{blockedInfo.responsibleMrId})
								</span>
							</div>
							{blockedInfo.responsibleInvoiceNo && (
								<div className="flex justify-between py-1">
									<span className="text-gray-500">Unpaid Invoice:</span>
									<span className="font-bold text-gray-900">
										{blockedInfo.responsibleInvoiceNo}
									</span>
								</div>
							)}
							{blockedInfo.responsibleAmount !== undefined && (
								<div className="flex justify-between py-1">
									<span className="text-gray-500">Pending Amount:</span>
									<span className="font-bold text-red-600">
										₹{Number(blockedInfo.responsibleAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
									</span>
								</div>
							)}
							{blockedInfo.responsibleOverDays !== undefined && (
								<div className="flex justify-between py-1">
									<span className="text-gray-500">Overdue Duration:</span>
									<span className="font-bold text-red-600">
										{blockedInfo.responsibleOverDays} days (exceeds 95d limit)
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				{/* If Direct MR Block (>90 Days) */}
				{isDirectBlocked && blockedInfo.blockingInvoices && blockedInfo.blockingInvoices.length > 0 && (
					<div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
						<div className="flex items-center justify-between pb-2 font-bold text-gray-800 text-xs">
							<span>Invoices Exceeding 90 Days ({blockedInfo.blockingInvoices.length})</span>
							<span className="text-red-600">
								Total: ₹{Number(blockedInfo.totalPendingAmt || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
							</span>
						</div>
						<div className="max-h-48 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 bg-white">
							{blockedInfo.blockingInvoices.map((inv: any, idx: number) => (
								<div key={idx} className="p-2.5 text-[11px]">
									<div className="flex items-center justify-between font-bold text-gray-900">
										<span>{inv.invoiceNo}</span>
										<span className="text-red-600">₹{Number(inv.amount).toFixed(2)}</span>
									</div>
									<div className="mt-0.5 flex items-center justify-between text-gray-500">
										<span className="truncate max-w-[180px]">{inv.customer}</span>
										<span className="font-semibold text-red-600">
											{inv.overDays} days overdue
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Next Steps & Support Contact */}
				<div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
					<h4 className="font-bold text-gray-900 text-xs">
						What should you do?
					</h4>
					<p className="mt-1 text-gray-600 text-xs leading-relaxed">
						Please follow up with the party or clearance desk to reconcile outstanding payment. You can also contact the Accounts Administration desk for payment receipt clearance or temporary exemption.
					</p>

					<div className="mt-3 flex flex-col gap-2">
						<a
							href="tel:+919624105404"
							className="flex items-center justify-center gap-2 rounded-lg bg-[#0071BC] px-4 py-2 font-bold text-xs text-white shadow-sm hover:bg-[#005a96] transition-colors"
						>
							<PhoneCall className="h-3.5 w-3.5" />
							Call Accounts Desk (+91 96241 05404)
						</a>
						<a
							href={`mailto:admin@asmeepharma.com?subject=Account%20Reactivation%20Request%20-%20${encodeURIComponent(blockedInfo.mrName || email)}`}
							className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 text-xs shadow-sm hover:bg-gray-50 transition-colors"
						>
							<Mail className="h-3.5 w-3.5 text-gray-500" />
							Email Administration
						</a>
					</div>
				</div>

				{/* Back to Login Button */}
				<div className="mt-5 text-center">
					<button
						className="inline-flex items-center gap-1.5 font-bold text-xs text-gray-500 hover:text-gray-900 transition-colors"
						onClick={() => {
							setBlockedInfo(null);
							setError("");
							setStep("request");
						}}
						type="button"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to Login
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="border border-gray-200 bg-white px-4 py-8 shadow-sm sm:rounded-2xl sm:px-10">
			{/* Mode Toggle Tabs */}
			<div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
				<button
					className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-bold text-xs transition-all ${
						mode === "mr"
							? "bg-[#0071BC] text-white shadow-sm"
							: "text-gray-600 hover:text-gray-900"
					}`}
					onClick={() => {
						setMode("mr");
						setStep("request");
						setError("");
						setSuccessMsg("");
					}}
					type="button"
				>
					<Mail className="h-4 w-4" />
					MR Email OTP
				</button>
				<button
					className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-bold text-xs transition-all ${
						mode === "admin"
							? "bg-[#0B2545] text-white shadow-sm"
							: "text-gray-600 hover:text-gray-900"
					}`}
					onClick={() => {
						setMode("admin");
						setError("");
						setSuccessMsg("");
					}}
					type="button"
				>
					<ShieldCheck className="h-4 w-4" />
					Admin
				</button>
			</div>

			{/* MR FLOW */}
			{mode === "mr" && step === "request" && (
				<form className="space-y-6" onSubmit={handleMrOtpRequest}>
					<div>
						<label className="block font-semibold text-gray-700 text-sm">
							Registered Email Address
						</label>
						<p className="mt-0.5 text-gray-500 text-xs">
							We will send a 6-digit verification code to your email.
						</p>
						<div className="mt-2">
							<input
								className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-[#0071BC] focus:ring-[#0071BC] sm:text-sm"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="mr.name@asmeepharma.com"
								required
								type="email"
								value={email}
							/>
						</div>
					</div>

					<button
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0071BC] px-4 py-2.5 font-bold text-sm text-white shadow-sm hover:bg-[#005a96] disabled:opacity-50"
						disabled={loading}
						type="submit"
					>
						{loading ? "Sending OTP..." : "Send Verification OTP"}
						<ArrowRight className="h-4 w-4" />
					</button>
				</form>
			)}

			{mode === "mr" && step === "otp" && (
				<form className="space-y-6" onSubmit={handleMrOtpVerify}>
					{successMsg && (
						<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-medium text-emerald-800 text-xs">
							{successMsg}
						</div>
					)}
					<div className="flex flex-col items-center">
						<label className="mb-3 block font-semibold text-gray-700 text-sm">
							Enter 6-Digit OTP Code
						</label>
						<InputOTP
							maxLength={6}
							onChange={(value) => setOtp(value)}
							value={otp}
						>
							<InputOTPGroup>
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
								<InputOTPSlot index={3} />
								<InputOTPSlot index={4} />
								<InputOTPSlot index={5} />
							</InputOTPGroup>
						</InputOTP>
					</div>

					<button
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0071BC] px-4 py-2.5 font-bold text-sm text-white shadow-sm hover:bg-[#005a96] disabled:opacity-50"
						disabled={loading || otp.length < 6}
						type="submit"
					>
						{loading ? "Verifying..." : "Verify & Sign In"}
					</button>

					<div className="text-center">
						<button
							className="font-semibold text-[#0071BC] text-xs hover:underline"
							onClick={() => setStep("request")}
							type="button"
						>
							← Change Email or Resend OTP
						</button>
					</div>
				</form>
			)}

			{/* ADMIN / DEV FLOW */}
			{mode === "admin" && (
				<form className="space-y-5" onSubmit={handleAdminLogin}>
					{isDevAccess && (
						<div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-50/70 p-3 text-xs text-amber-900 font-medium">
							<ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
							<span>Developer Access Mode &bull; Enter developer or admin credentials.</span>
						</div>
					)}

					<div>
						<label className="block font-semibold text-gray-700 text-sm">
							Admin or Developer Email
						</label>
						<div className="mt-1.5">
							<input
								className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-[#0B2545] focus:ring-[#0B2545] sm:text-sm"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="admin@asmeepharma.com or dev email"
								required
								type="email"
								value={email}
							/>
						</div>
					</div>

					<div>
						<label className="block font-semibold text-gray-700 text-sm">
							Password
						</label>
						<div className="mt-1.5">
							<input
								className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-[#0B2545] focus:ring-[#0B2545] sm:text-sm"
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••••••"
								required
								type="password"
								value={password}
							/>
						</div>
					</div>

					<button
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B2545] px-4 py-2.5 font-bold text-sm text-white shadow-sm hover:bg-[#081a30] disabled:opacity-50"
						disabled={loading}
						type="submit"
					>
						<KeyRound className="h-4 w-4" />
						{loading ? "Signing in..." : "Authenticate"}
					</button>
				</form>
			)}

			{error && (
				<div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 font-medium text-red-700 text-xs">
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
					<div>{error}</div>
				</div>
			)}
		</div>
	);
}
