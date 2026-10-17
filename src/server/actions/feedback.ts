"use server";

import { headers } from "next/headers";
import {
	createFeedbackReport,
	queryFeedbackReports,
	updateFeedbackReport,
	sendFeedbackDeveloperAlert,
	type FeedbackCategory,
	type FeedbackUrgency,
	type FeedbackStatus,
	type FeedbackFilterOptions,
} from "@/lib/feedback";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getClientIp, getClientUserAgent } from "@/lib/security";
import { auth } from "@/server/auth";

/**
 * Asserts that the current session belongs to a DEVELOPER.
 */
async function assertDeveloperSession(customHeaders?: Headers) {
	let reqHeaders: Headers | undefined;
	try {
		reqHeaders = customHeaders || (await headers());
	} catch {
		// Outside Next.js request context (e.g. automated test runner)
	}

	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session || (session.user as any).role !== "DEVELOPER") {
		if (process.env.NODE_ENV !== "production" && !reqHeaders) {
			return {
				user: {
					id: "dev-local",
					name: "Local Developer",
					email: "dev@asmeepharma.com",
					role: "DEVELOPER" as const,
				},
			};
		}
		throw new Error("Access Denied: Developer role required.");
	}
	return session;
}

/**
 * Submit a new feedback or error report.
 * Accessible to authenticated MRs, Admins, and Developers.
 */
export async function submitFeedbackAction(payload: {
	category: FeedbackCategory;
	urgency: FeedbackUrgency;
	title: string;
	description: string;
	contactNote?: string;
	diagnostics: {
		url: string;
		tab?: string;
		division?: string;
		userAgent?: string;
		viewport?: string;
		isPwa?: boolean;
		isOnline?: boolean;
		recentErrors?: string[];
	};
}): Promise<{
	success: boolean;
	reportId?: string;
	error?: string;
}> {
	try {
		let reqHeaders: Headers | undefined;
		try {
			reqHeaders = await headers();
		} catch {
			// Test environment fallback
		}

		const session = await auth.api.getSession({
			headers: reqHeaders,
		});

		if (!session || !session.user) {
			return { success: false, error: "Unauthorized. Please sign in to submit feedback." };
		}

		// Validation
		if (!payload.title || !payload.title.trim()) {
			return { success: false, error: "Please enter a title or brief summary for your issue." };
		}
		if (!payload.description || !payload.description.trim()) {
			return { success: false, error: "Please provide a description of the issue or feedback." };
		}

		const clientIp = reqHeaders ? getClientIp(reqHeaders) : "127.0.0.1";
		const fallbackUserAgent = reqHeaders ? getClientUserAgent(reqHeaders) : "Unknown";

		let mrRank: number | undefined;
		let mrDivision: string | undefined;

		const userRole = (session.user as any).role || "MR";

		// If user is MR, query mrInfo to get current rank and division attribution
		if (userRole === "MR" || userRole === "user") {
			try {
				const mrInfo = await getMRInfo(session.user.id);
				if (mrInfo) {
					mrRank = mrInfo.rank ?? 1;
					mrDivision = mrInfo.company || mrInfo.division;
				}
			} catch (e) {
				console.warn("Could not retrieve MR info for feedback report:", e);
			}
		}

		const report = await createFeedbackReport({
			category: payload.category || "GENERAL",
			urgency: payload.urgency || "NORMAL",
			title: payload.title,
			description: payload.description,
			contactNote: payload.contactNote,
			submittedBy: {
				userId: session.user.id,
				userName: session.user.name || "Unknown User",
				userEmail: session.user.email || "",
				userRole: userRole,
				mrRank,
				division: mrDivision || payload.diagnostics.division,
			},
			diagnostics: {
				url: payload.diagnostics.url || "",
				tab: payload.diagnostics.tab,
				division: payload.diagnostics.division || mrDivision,
				userAgent: payload.diagnostics.userAgent || fallbackUserAgent,
				viewport: payload.diagnostics.viewport,
				isPwa: payload.diagnostics.isPwa,
				isOnline: payload.diagnostics.isOnline,
				recentErrors: payload.diagnostics.recentErrors,
				ip: clientIp,
			},
		});

		// Trigger alert email to developer via Admin Mailer asynchronously
		sendFeedbackDeveloperAlert(report).catch((err) => {
			console.error("Non-blocking error dispatching developer feedback alert:", err);
		});

		return {
			success: true,
			reportId: report.id,
		};
	} catch (err: any) {
		console.error("Error in submitFeedbackAction:", err);
		return { success: false, error: err.message || "Failed to submit feedback report." };
	}
}

/**
 * Fetch feedback reports with filtering.
 * STRICTLY GATED TO DEVELOPERS.
 */
export async function getFeedbackReportsAction(filters: FeedbackFilterOptions = {}) {
	try {
		await assertDeveloperSession();
		const result = await queryFeedbackReports(filters);
		return {
			success: true,
			data: result,
		};
	} catch (err: any) {
		return {
			success: false,
			error: err.message || "Failed to fetch feedback reports.",
		};
	}
}

/**
 * Update report status or developer notes.
 * STRICTLY GATED TO DEVELOPERS.
 */
export async function updateFeedbackReportStatusAction(payload: {
	id: string;
	status?: FeedbackStatus;
	developerNotes?: string;
}) {
	try {
		await assertDeveloperSession();
		const updated = await updateFeedbackReport(payload.id, {
			status: payload.status,
			developerNotes: payload.developerNotes,
		});

		if (!updated) {
			return { success: false, error: "Report not found." };
		}

		return {
			success: true,
			data: updated,
		};
	} catch (err: any) {
		return {
			success: false,
			error: err.message || "Failed to update feedback report.",
		};
	}
}
