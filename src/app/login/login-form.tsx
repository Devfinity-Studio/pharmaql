"use client";

import {
	AlertCircle,
	ArrowRight,
	KeyRound,
	Mail,
	ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
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

	const [mode, setMode] = useState<"mr" | "admin">("mr");
	const [step, setStep] = useState<"request" | "otp">("request");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [error, setError] = useState("");
	const [successMsg, setSuccessMsg] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	async function handleMrOtpRequest(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");
		setSuccessMsg("");

		const res = await requestMrOtp(email);
		if (!res.success) {
			setError(res.error || "Failed to send OTP.");
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
			setError(res.error || "Invalid OTP code.");
			setLoading(false);
		} else {
			router.push("/dashboard");
			router.refresh();
		}
	}

	async function handleAdminLogin(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const res = await loginAdminOrDev(email, password);
		if (!res.success) {
			setError(res.error || "Login failed.");
			setLoading(false);
		} else {
			if (res.user?.role === "ADMIN" || res.user?.role === "DEVELOPER") {
				router.push("/admin/dashboard");
			} else {
				router.push("/dashboard");
			}
			router.refresh();
		}
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
					Admin / Developer
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
					<div>
						<label className="block font-semibold text-gray-700 text-sm">
							Admin / Developer Email
						</label>
						<div className="mt-1.5">
							<input
								className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-[#0B2545] focus:ring-[#0B2545] sm:text-sm"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="admin@asmeepharma.com"
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
