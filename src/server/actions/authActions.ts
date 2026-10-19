"use server";

import { cookies, headers } from "next/headers";
import { apiPost } from "@/lib/api-client";
import { recordAuditEvent } from "@/lib/audit-logger";
import { type SessionUser, signSessionToken } from "@/lib/jwt";
import { sendOtpEmail } from "@/lib/mailer";
import { getPermissionsForRank } from "@/lib/permissions";
import {
	checkLoginAllowed,
	checkOtpVerifyAllowed,
	rateLimitOtpRequest,
	recordLoginFailure,
	recordLoginSuccess,
	recordOtpVerifyFailure,
	recordOtpVerifySuccess,
} from "@/lib/rate-limit";
import { getClientIp, getClientUserAgent } from "@/lib/security";
import { getMRInfo } from "@/server/actions/mrInfo";
import { recordMRLastLogin } from "@/server/actions/mrs";
import { AUTH_COOKIE_NAME, getSession } from "@/server/auth";

// Temporary in-memory OTP storage: email -> { otp, expiresAt, mrUser }
const otpStore = new Map<
	string,
	{ otp: string; expiresAt: number; mrUser: SessionUser }
>();

/**
 * 1. Request OTP for Medical Representative (MR)
 * Looks up MR via API Server by Email or Mobile with sliding-window rate limiting & audit logs
 */
export async function requestMrOtp(emailOrPhone: string) {
	const reqHeaders = await headers();
	const clientIp = getClientIp(reqHeaders);
	const userAgent = getClientUserAgent(reqHeaders);

	try {
		const cleanInput = emailOrPhone.trim();
		if (!cleanInput) {
			return {
				success: false,
				error: "Please enter your registered email address.",
			};
		}

		// 1. Enforce Sliding-Window Rate Limiting (5 requests per 10 mins per IP & Identifier)
		const rateCheck = rateLimitOtpRequest(clientIp, cleanInput);
		if (!rateCheck.allowed) {
			await recordAuditEvent({
				event: "RATE_LIMIT_EXCEEDED",
				ip: clientIp,
				userAgent,
				details: {
					action: "requestMrOtp",
					identifier: cleanInput,
					reason: rateCheck.message,
				},
			});

			return {
				success: false,
				error: rateCheck.message,
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
			allIds?: string[];
		} | null>("/api/auth/mr-lookup", { emailOrPhone: cleanInput });

		if (!res.success || !res.data) {
			await recordAuditEvent({
				event: "AUTH_LOGIN_FAILURE",
				ip: clientIp,
				userAgent,
				details: {
					action: "requestMrOtp",
					identifier: cleanInput,
					reason: "Account not found",
				},
			});

			return {
				success: false,
				error:
					"No Medical Representative account found with this email. Please check with your administrator.",
			};
		}

		const mr = res.data;
		if (mr.isBlocked) {
			await recordAuditEvent({
				event: "AUTH_LOGIN_FAILURE",
				userId: mr.id,
				userEmail: mr.email,
				ip: clientIp,
				userAgent,
				details: {
					action: "requestMrOtp",
					reason: "Account marked inactive",
				},
			});

			return {
				success: false,
				error: "Your account is marked as inactive. Please contact support.",
			};
		}

		// Check Live Overdue & Cascading Blocking status
		const { evaluateMROverdueStatus } = await import("./overdueEngine");
		const overdueStatus = await evaluateMROverdueStatus(mr.id);
		if (overdueStatus.isBlocked) {
			await recordAuditEvent({
				event: "AUTH_LOGIN_FAILURE",
				userId: mr.id,
				userEmail: mr.email,
				ip: clientIp,
				userAgent,
				details: {
					action: "requestMrOtp",
					reason: "Account blocked by overdue engine",
					overdueDetails: overdueStatus,
				},
			});

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

		// Look up MR info including rank and permissions
		const mrDetails = await getMRInfo(mr.id);
		const rank = mrDetails?.rank || 3;
		const perms = getPermissionsForRank(rank);

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
			rank,
			allIds: mr.allIds || [mr.id],
			canViewStock: perms.canViewStock,
			canViewSales: perms.canViewSales,
			canViewFreeScheme: perms.canViewFreeScheme,
			canViewPartyWise: perms.canViewPartyWise,
			canViewProductWise: perms.canViewProductWise,
		};

		otpStore.set(targetEmail.toLowerCase(), {
			otp,
			expiresAt,
			mrUser: mrSessionUser,
		});

		// Send email using Gmail SMTP
		await sendOtpEmail(targetEmail, otp, mr.name);

		// Record successful OTP dispatch
		await recordAuditEvent({
			event: "OTP_REQUEST",
			userId: mr.id,
			userEmail: targetEmail,
			role: "MR",
			ip: clientIp,
			userAgent,
			details: {
				action: "requestMrOtp",
				mrName: mr.name,
			},
		});

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
 * Protected with brute-force lockout and structured audit logging
 */
export async function verifyMrOtp(email: string, otp: string) {
	const reqHeaders = await headers();
	const clientIp = getClientIp(reqHeaders);
	const userAgent = getClientUserAgent(reqHeaders);

	try {
		const cleanEmail = email.trim().toLowerCase();
		const cleanOtp = otp.trim();

		// 1. Check if account or IP is locked due to repeated bad attempts
		const lockCheck = checkOtpVerifyAllowed(clientIp, cleanEmail);
		if (!lockCheck.allowed) {
			await recordAuditEvent({
				event: "RATE_LIMIT_EXCEEDED",
				userEmail: cleanEmail,
				ip: clientIp,
				userAgent,
				details: {
					action: "verifyMrOtp",
					reason: lockCheck.message,
				},
			});

			return {
				success: false,
				error: lockCheck.message,
			};
		}

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

		// Check OTP code validity
		if (record.otp !== cleanOtp) {
			const failMsg = recordOtpVerifyFailure(clientIp, cleanEmail);

			await recordAuditEvent({
				event: "OTP_VERIFY_FAILURE",
				userId: record.mrUser.id,
				userEmail: cleanEmail,
				role: "MR",
				ip: clientIp,
				userAgent,
				details: {
					action: "verifyMrOtp",
					reason: "Incorrect code",
				},
			});

			return {
				success: false,
				error: failMsg,
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

		// OTP Valid! Reset brute force counters & clean up active OTP
		recordOtpVerifySuccess(clientIp, cleanEmail);
		otpStore.delete(cleanEmail);

		// Record Last Login timestamp for MR
		await recordMRLastLogin(
			record.mrUser.id,
			cleanEmail,
			record.mrUser.allIds,
		);

		// Clear any past remote session revocation
		const { unrevokeUser } = await import("@/lib/presence-store");
		await unrevokeUser(record.mrUser.id);

		// Record Audit Events
		await recordAuditEvent({
			event: "OTP_VERIFY_SUCCESS",
			userId: record.mrUser.id,
			userEmail: cleanEmail,
			role: "MR",
			ip: clientIp,
			userAgent,
		});

		await recordAuditEvent({
			event: "AUTH_LOGIN_SUCCESS",
			userId: record.mrUser.id,
			userEmail: cleanEmail,
			role: "MR",
			ip: clientIp,
			userAgent,
			details: {
				method: "OTP",
				rank: record.mrUser.rank,
			},
		});

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
 * Protected with lockout per IP and persistent audit logging
 */
export async function loginAdminOrDev(email: string, pass: string) {
	let reqHeaders: Headers | undefined;
	try {
		reqHeaders = await headers();
	} catch {
		// Outside request scope
	}
	const clientIp = reqHeaders ? getClientIp(reqHeaders) : "127.0.0.1";
	const userAgent = reqHeaders ? getClientUserAgent(reqHeaders) : "Mozilla/5.0";

	try {
		const cleanEmail = email.trim().toLowerCase();
		const cleanPass = pass.trim();

		// 1. Check IP lockout for brute-force prevention
		const lockCheck = checkLoginAllowed(clientIp);
		if (!lockCheck.allowed) {
			await recordAuditEvent({
				event: "RATE_LIMIT_EXCEEDED",
				userEmail: cleanEmail,
				ip: clientIp,
				userAgent,
				details: {
					action: "loginAdminOrDev",
					reason: lockCheck.message,
				},
			});

			return {
				success: false,
				error: lockCheck.message,
			};
		}

		const adminEmail = (
			process.env.ADMIN_EMAIL || "admin@admin.com"
		).toLowerCase();
		const adminPass = process.env.ADMIN_PASSWORD || "Admin123";

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
			const failMsg = recordLoginFailure(clientIp);

			await recordAuditEvent({
				event: "AUTH_LOGIN_FAILURE",
				userEmail: cleanEmail,
				ip: clientIp,
				userAgent,
				details: {
					action: "loginAdminOrDev",
					attemptedEmail: cleanEmail,
				},
			});

			return {
				success: false,
				error: failMsg,
			};
		}

		// Reset brute-force counter on successful login
		recordLoginSuccess(clientIp);

		// Clear any past remote session revocation
		const { unrevokeUser } = await import("@/lib/presence-store");
		await unrevokeUser(sessionUser.id);

		// Record Audit Event
		await recordAuditEvent({
			event: "AUTH_LOGIN_SUCCESS",
			userId: sessionUser.id,
			userEmail: sessionUser.email,
			role: sessionUser.role,
			ip: clientIp,
			userAgent,
			details: {
				method: "PASSWORD",
			},
		});

		// Issue Stateless JWT Session Cookie
		const token = await signSessionToken(sessionUser, "7d");
		try {
			const cookieStore = await cookies();
			cookieStore.set(AUTH_COOKIE_NAME, token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 7 * 24 * 60 * 60,
				path: "/",
			});
		} catch {
			// Outside HTTP cookie store
		}

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
	try {
		const reqHeaders = await headers();
		const clientIp = getClientIp(reqHeaders);
		const userAgent = getClientUserAgent(reqHeaders);
		const session = await getSession({ headers: reqHeaders });

		if (session) {
			await recordAuditEvent({
				event: "AUTH_LOGOUT",
				userId: session.user.id,
				userEmail: session.user.email,
				role: session.user.role,
				ip: clientIp,
				userAgent,
			});
		}

		const cookieStore = await cookies();
		cookieStore.delete(AUTH_COOKIE_NAME);
		return { success: true };
	} catch (error: any) {
		console.error("[Auth] Error logging out:", error);
		const cookieStore = await cookies();
		cookieStore.delete(AUTH_COOKIE_NAME);
		return { success: true };
	}
}
