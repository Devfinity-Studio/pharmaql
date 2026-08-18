"use client";

import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { emailOtp, signIn, signOut } from "@/lib/auth-client";
import { checkActiveSessions, clearOtherSessions } from "@/server/actions/mrs";

export function LoginForm() {
	const [step, setStep] = useState<
		"email" | "active-session-warning" | "password" | "otp"
	>("email");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	async function handleEmailSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			setError("Please enter a valid email address.");
			setLoading(false);
			return;
		}

		if (email.toLowerCase() === "admin@admin.com") {
			setStep("password");
			setLoading(false);
		} else {
			// Check for active sessions for MRs
			const sessionCheck = await checkActiveSessions(email);
			if (sessionCheck.hasActiveSessions) {
				setStep("active-session-warning");
				setLoading(false);
				return;
			}

			// Proceed to OTP
			await sendOTP(email);
		}
	}

	async function sendOTP(emailAddress: string) {
		setLoading(true);
		setError("");
		const res = await emailOtp.sendVerificationOtp({
			email: emailAddress,
			type: "sign-in",
		});

		if (res.error) {
			setError(res.error.message || "Failed to send OTP.");
			setLoading(false);
		} else {
			setStep("otp");
			setLoading(false);
		}
	}

	async function handleWarningContinue() {
		await sendOTP(email);
	}

	async function handlePasswordSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const res = await signIn.email({
			email,
			password,
		});

		await handleSignInResponse(res);
	}

	async function handleOtpSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const res = await signIn.emailOtp({
			email,
			otp,
		});

		await handleSignInResponse(res);
	}

	async function handleSignInResponse(res: any) {
		if (res.error) {
			setError(
				res.error.message || "Failed to sign in. Check your credentials.",
			);
			setLoading(false);
		} else if ((res.data?.user as any)?.isBlocked) {
			await signOut();
			setError(
				"you have been blocked please contact the admin to get unblocked",
			);
			setLoading(false);
		} else {
			const role = (res.data?.user as any)?.role;

			if (role === "MR") {
				// Clear any older active sessions now that the new OTP verified session is established
				await clearOtherSessions();
			}

			if (role === "ADMIN") {
				router.push("/admin/dashboard");
			} else {
				router.push("/dashboard");
			}
			router.refresh();
		}
	}

	return (
		<div className="border border-gray-200 bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
			{step === "email" && (
				<form className="space-y-6" onSubmit={handleEmailSubmit}>
					<div>
						<label className="block font-medium text-gray-700 text-sm">
							Email address
						</label>
						<div className="mt-1">
							<input
								className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
								onChange={(e) => setEmail(e.target.value)}
								required
								type="email"
								value={email}
							/>
						</div>
					</div>
					{error && <div className="text-red-600 text-sm">{error}</div>}
					<button
						className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
						disabled={loading}
						type="submit"
					>
						{loading ? "Please wait..." : "Continue"}
					</button>
				</form>
			)}

			{step === "active-session-warning" && (
				<div className="space-y-6">
					<div className="flex flex-col items-center text-center">
						<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
							<AlertCircle className="h-6 w-6 text-yellow-600" />
						</div>
						<h3 className="font-medium text-gray-900 text-lg">
							Active Session Detected
						</h3>
						<p className="mt-2 text-gray-500 text-sm">
							You are currently logged in on another device. Do you want to log
							out of other devices and continue logging in here?
						</p>
					</div>
					{error && (
						<div className="text-center text-red-600 text-sm">{error}</div>
					)}
					<div className="flex w-full flex-col gap-3">
						<button
							className="flex w-full justify-center rounded-md border border-transparent bg-yellow-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
							disabled={loading}
							onClick={handleWarningContinue}
						>
							{loading ? "Sending OTP..." : "Yes, log out others and send OTP"}
						</button>
						<button
							className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
							disabled={loading}
							onClick={() => setStep("email")}
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{step === "password" && (
				<form className="space-y-6" onSubmit={handlePasswordSubmit}>
					<div>
						<label className="block font-medium text-gray-700 text-sm">
							Password for Admin
						</label>
						<div className="mt-1">
							<input
								className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
								onChange={(e) => setPassword(e.target.value)}
								required
								type="password"
								value={password}
							/>
						</div>
					</div>
					{error && <div className="text-red-600 text-sm">{error}</div>}
					<div className="flex gap-4">
						<button
							className="text-gray-600 text-sm hover:text-gray-900"
							onClick={() => setStep("email")}
							type="button"
						>
							Back
						</button>
						<button
							className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
							disabled={loading}
							type="submit"
						>
							{loading ? "Signing in..." : "Sign in"}
						</button>
					</div>
				</form>
			)}

			{step === "otp" && (
				<form
					className="flex flex-col items-center space-y-6"
					onSubmit={handleOtpSubmit}
				>
					<div className="text-center">
						<h3 className="font-medium text-gray-900 text-lg">Enter OTP</h3>
						<p className="mt-1 mb-4 text-gray-500 text-sm">
							We sent a verification code to {email}
						</p>
					</div>
					<div className="flex w-full justify-center">
						<InputOTP maxLength={6} onChange={setOtp} value={otp}>
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
					{error && <div className="text-red-600 text-sm">{error}</div>}
					<div className="mt-4 flex w-full gap-4">
						<button
							className="text-gray-600 text-sm hover:text-gray-900"
							onClick={() => setStep("email")}
							type="button"
						>
							Back
						</button>
						<button
							className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
							disabled={loading || otp.length < 6}
							type="submit"
						>
							{loading ? "Verifying..." : "Verify & Sign in"}
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
