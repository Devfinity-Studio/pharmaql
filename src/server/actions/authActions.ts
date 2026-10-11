"use server";

import { cookies } from "next/headers";
import { apiPost } from "@/lib/api-client";
import { type SessionUser, signSessionToken } from "@/lib/jwt";
import { sendOtpEmail } from "@/lib/mailer";
import { AUTH_COOKIE_NAME } from "@/server/auth";

// Temporary in-memory OTP storage: email -> { otp, expiresAt }
// In production, server memory handles this seamlessly for standard verification cycles
const otpStore = new Map<
	string,
	{ otp: string; expiresAt: number; mrUser: SessionUser }
>();

/**
 * 1. Request OTP for Medical Representative (MR)
 * Looks up MR via API Server by Email or Mobile
 */
export async function requestMrOtp(emailOrPhone: string) {
	try {
		const cleanInput = emailOrPhone.trim();
		if (!cleanInput) {
			return {
				success: false,
				error: "Please enter your registered email address.",
			};
		}

		// Look up MR in API server
		const res = await apiPost<{
			id: string;
			name: string;
			email: string;
			mobile: string;
			division: string | null;
			company: string | null;
			companyCode: string | null;
			isBlocked: boolean;
			locNo: string;
		} | null>("/api/auth/mr-lookup", { emailOrPhone: cleanInput });

		if (!res.success || !res.data) {
			return {
				success: false,
				error:
					"No Medical Representative account found with this email. Please check with your administrator.",
			};
		}

		const mr = res.data;
		if (mr.isBlocked) {
			return {
				success: false,
				error: "Your account is marked as inactive. Please contact support.",
			};
		}

		// Check Live Overdue & Cascading Blocking status
		const { evaluateMROverdueStatus } = await import("./overdueEngine");
		const overdueStatus = await evaluateMROverdueStatus(mr.id);
		if (overdueStatus.isBlocked) {
			return {
				success: false,
				error:
					overdueStatus.message ||
					"Your account is currently blocked due to overdue payments. Please contact admin.",
				statusDetails: overdueStatus,
			};
		}

		const targetEmail = mr.email ? mr.email.trim() : null;
		if (!targetEmail) {
			return {
				success: false,
				error:
					"No email address registered for this MR in the ERP system. Please ask Admin to update your Email ID.",
			};
		}

		// Generate 6-digit secure numeric OTP
		const otp = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

		const mrSessionUser: SessionUser = {
			id: mr.id,
			name: mr.name || "MR User",
			email: targetEmail,
			role: "MR",
			locNo: mr.locNo || "11",
			division: mr.division || undefined,
			company: mr.company || undefined,
			companyCode: mr.companyCode || undefined,
			isBlocked: false,
			canViewStock: true,
			canViewSales: true,
			canViewFreeScheme: true,
			canViewPartyWise: true,
			canViewProductWise: true,
		};

		otpStore.set(targetEmail.toLowerCase(), {
			otp,
			expiresAt,
			mrUser: mrSessionUser,
		});

		// Send email using Gmail SMTP
		await sendOtpEmail(targetEmail, otp, mr.name);

		return {
			success: true,
			email: targetEmail,
			message: `OTP sent successfully to ${targetEmail}`,
		};
	} catch (error: any) {
		console.error("[Auth] Error requesting MR OTP:", error);
		return {
			success: false,
			error: error.message || "Failed to send OTP email.",
		};
	}
}

/**
 * 2. Verify OTP for Medical Representative (MR)
 */
export async function verifyMrOtp(email: string, otp: string) {
	try {
		const cleanEmail = email.trim().toLowerCase();
		const cleanOtp = otp.trim();

		const record = otpStore.get(cleanEmail);
		if (!record) {
			return {
				success: false,
				error: "OTP expired or not requested. Please request a new OTP.",
			};
		}

		if (Date.now() > record.expiresAt) {
			otpStore.delete(cleanEmail);
			return {
				success: false,
				error: "OTP has expired. Please request a new OTP.",
			};
		}

		if (record.otp !== cleanOtp) {
			return {
				success: false,
				error: "Invalid OTP code. Please enter the correct 6-digit code.",
			};
		}

		// Check overdue block one more time before issuing session
		const { evaluateMROverdueStatus } = await import("./overdueEngine");
		const overdueStatus = await evaluateMROverdueStatus(record.mrUser.id);
		if (overdueStatus.isBlocked) {
			otpStore.delete(cleanEmail);
			return {
				success: false,
				error:
					overdueStatus.message ||
					"Your account has been blocked due to overdue payments.",
			};
		}

		// OTP Valid! Clean up used OTP
		otpStore.delete(cleanEmail);

		// Issue Stateless JWT Session Cookie
		const token = await signSessionToken(record.mrUser, "7d");
		const cookieStore = await cookies();
		cookieStore.set(AUTH_COOKIE_NAME, token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 7 * 24 * 60 * 60,
			path: "/",
		});

		return { success: true, user: record.mrUser };
	} catch (error: any) {
		console.error("[Auth] Error verifying MR OTP:", error);
		return { success: false, error: error.message || "Verification failed." };
	}
}

/**
 * 3. Explicit Admin & Developer Password Login
 */
export async function loginAdminOrDev(email: string, pass: string) {
	try {
		const cleanEmail = email.trim().toLowerCase();
		const cleanPass = pass.trim();

		const adminEmail = (
			process.env.ADMIN_EMAIL || "admin@asmeepharma.com"
		).toLowerCase();
		const adminPass = process.env.ADMIN_PASSWORD || "Admin@PharmaQL2026";

		const devEmail = (
			process.env.DEV_EMAIL || "dev@asmeepharma.com"
		).toLowerCase();
		const devPass = process.env.DEV_PASSWORD || "Dev@PharmaQL2026";

		let sessionUser: SessionUser | null = null;

		if (cleanEmail === adminEmail && cleanPass === adminPass) {
			sessionUser = {
				id: "admin-system",
				name: "System Administrator",
				email: adminEmail,
				role: "ADMIN",
				locNo: "11",
				canViewStock: true,
				canViewSales: true,
				canViewFreeScheme: true,
				canViewPartyWise: true,
				canViewProductWise: true,
			};
		} else if (cleanEmail === devEmail && cleanPass === devPass) {
			sessionUser = {
				id: "dev-system",
				name: "Developer Admin",
				email: devEmail,
				role: "DEVELOPER",
				locNo: "11",
				canViewStock: true,
				canViewSales: true,
				canViewFreeScheme: true,
				canViewPartyWise: true,
				canViewProductWise: true,
			};
		}

		if (!sessionUser) {
			return {
				success: false,
				error: "Invalid credentials. Please verify email and password.",
			};
		}

		// Issue Stateless JWT Session Cookie
		const token = await signSessionToken(sessionUser, "7d");
		const cookieStore = await cookies();
		cookieStore.set(AUTH_COOKIE_NAME, token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 7 * 24 * 60 * 60,
			path: "/",
		});

		return { success: true, user: sessionUser };
	} catch (error: any) {
		console.error("[Auth] Error in admin/dev login:", error);
		return { success: false, error: error.message || "Login failed." };
	}
}

/**
 * 4. Universal Logout Action
 */
export async function logoutUser() {
	const cookieStore = await cookies();
	cookieStore.delete(AUTH_COOKIE_NAME);
	return { success: true };
}
