import { mailer, getDeveloperSenderEmail } from "./mailer";
import { readServerJson, writeServerJson } from "./server-storage";

export type FeedbackCategory =
	| "BUG"
	| "DATA_DISCREPANCY"
	| "FEATURE_REQUEST"
	| "GENERAL";

export type FeedbackUrgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type FeedbackStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "WONT_FIX";

export interface FeedbackDiagnostics {
	url: string;
	tab?: string;
	division?: string;
	userAgent: string;
	viewport?: string;
	isPwa?: boolean;
	isOnline?: boolean;
	recentErrors?: string[];
	ip?: string;
}

export interface FeedbackSubmitter {
	userId: string;
	userName: string;
	userEmail: string;
	userRole: string; // "MR" | "ADMIN" | "DEVELOPER"
	mrRank?: number;
	division?: string;
}

export interface FeedbackReport {
	id: string; // e.g. "FB-20261017-X8K2"
	category: FeedbackCategory;
	urgency: FeedbackUrgency;
	status: FeedbackStatus;
	title: string;
	description: string;
	contactNote?: string;
	submittedBy: FeedbackSubmitter;
	diagnostics: FeedbackDiagnostics;
	developerNotes?: string;
	createdAt: string;
	updatedAt: string;
	resolvedAt?: string;
}

export interface FeedbackFilterOptions {
	status?: FeedbackStatus | "ALL";
	category?: FeedbackCategory | "ALL";
	urgency?: FeedbackUrgency | "ALL";
	search?: string;
	limit?: number;
	offset?: number;
}

const FEEDBACK_STORAGE_FILE = "feedback_reports.json";

/**
 * Retrieve all feedback reports from persistent server storage.
 */
export async function getAllFeedbackReports(): Promise<FeedbackReport[]> {
	const reports = await readServerJson<FeedbackReport[]>(
		FEEDBACK_STORAGE_FILE,
		[],
	);
	return Array.isArray(reports) ? reports : [];
}

/**
 * Save feedback reports list to storage.
 */
export async function saveFeedbackReports(
	reports: FeedbackReport[],
): Promise<void> {
	await writeServerJson(FEEDBACK_STORAGE_FILE, reports);
}

/**
 * Create and persist a new feedback report.
 */
export async function createFeedbackReport(data: {
	category: FeedbackCategory;
	urgency: FeedbackUrgency;
	title: string;
	description: string;
	contactNote?: string;
	submittedBy: FeedbackSubmitter;
	diagnostics: FeedbackDiagnostics;
}): Promise<FeedbackReport> {
	const reports = await getAllFeedbackReports();

	const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
	const newId = `FB-${dateStr}-${randomSuffix}`;
	const now = new Date().toISOString();

	const newReport: FeedbackReport = {
		id: newId,
		category: data.category,
		urgency: data.urgency,
		status: "OPEN",
		title: data.title.trim(),
		description: data.description.trim(),
		contactNote: data.contactNote?.trim() || undefined,
		submittedBy: data.submittedBy,
		diagnostics: data.diagnostics,
		createdAt: now,
		updatedAt: now,
	};

	// Prepend to show newest first
	reports.unshift(newReport);
	await saveFeedbackReports(reports);

	return newReport;
}

/**
 * Query and filter feedback reports.
 */
export async function queryFeedbackReports(options: FeedbackFilterOptions = {}): Promise<{
	reports: FeedbackReport[];
	totalCount: number;
	counts: {
		all: number;
		open: number;
		underReview: number;
		resolved: number;
		critical: number;
	};
}> {
	const allReports = await getAllFeedbackReports();

	const counts = {
		all: allReports.length,
		open: allReports.filter((r) => r.status === "OPEN").length,
		underReview: allReports.filter((r) => r.status === "UNDER_REVIEW").length,
		resolved: allReports.filter((r) => r.status === "RESOLVED").length,
		critical: allReports.filter(
			(r) => r.urgency === "CRITICAL" && r.status !== "RESOLVED",
		).length,
	};

	let filtered = allReports;

	if (options.status && options.status !== "ALL") {
		filtered = filtered.filter((r) => r.status === options.status);
	}

	if (options.category && options.category !== "ALL") {
		filtered = filtered.filter((r) => r.category === options.category);
	}

	if (options.urgency && options.urgency !== "ALL") {
		filtered = filtered.filter((r) => r.urgency === options.urgency);
	}

	if (options.search && options.search.trim()) {
		const q = options.search.trim().toLowerCase();
		filtered = filtered.filter(
			(r) =>
				r.id.toLowerCase().includes(q) ||
				r.title.toLowerCase().includes(q) ||
				r.description.toLowerCase().includes(q) ||
				r.submittedBy.userName.toLowerCase().includes(q) ||
				r.submittedBy.userEmail.toLowerCase().includes(q) ||
				(r.submittedBy.userId && r.submittedBy.userId.toLowerCase().includes(q)),
		);
	}

	const totalCount = filtered.length;
	const offset = options.offset || 0;
	const limit = options.limit || 50;
	const paginated = filtered.slice(offset, offset + limit);

	return {
		reports: paginated,
		totalCount,
		counts,
	};
}

/**
 * Update the status or developer notes of a feedback report.
 */
export async function updateFeedbackReport(
	id: string,
	updates: {
		status?: FeedbackStatus;
		developerNotes?: string;
	},
): Promise<FeedbackReport | null> {
	const reports = await getAllFeedbackReports();
	const index = reports.findIndex((r) => r.id === id);
	if (index === -1) return null;

	const target = reports[index];
	if (!target) return null;

	const now = new Date().toISOString();
	if (updates.status !== undefined) {
		target.status = updates.status;
		if (updates.status === "RESOLVED") {
			target.resolvedAt = now;
		}
	}
	if (updates.developerNotes !== undefined) {
		target.developerNotes = updates.developerNotes;
	}
	target.updatedAt = now;

	reports[index] = target;
	await saveFeedbackReports(reports);

	return target;
}

/**
 * Dispatch an email alert to the Developer via the Admin Mailer.
 * Explicitly highlights MR/submitter details.
 */
export async function sendFeedbackDeveloperAlert(
	report: FeedbackReport,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	const developerEmail = getDeveloperSenderEmail();
	const adminFromEmail =
		process.env.GMAIL_USER || "info.devolvestudio@gmail.com";

	const urgencyColorMap: Record<FeedbackUrgency, string> = {
		CRITICAL: "#DC2626",
		HIGH: "#EA580C",
		NORMAL: "#0284C7",
		LOW: "#16A34A",
	};
	const urgencyColor = urgencyColorMap[report.urgency] || "#0284C7";

	const categoryEmojiMap: Record<FeedbackCategory, string> = {
		BUG: "🐛 Bug / Crash",
		DATA_DISCREPANCY: "📊 Data Discrepancy",
		FEATURE_REQUEST: "💡 Feature Request",
		GENERAL: "💬 General Feedback",
	};
	const categoryLabel =
		categoryEmojiMap[report.category] || report.category;

	const isMR = report.submittedBy.userRole === "MR";
	const submitterHeadline = isMR
		? `MR ${report.submittedBy.userName} (Rank ${report.submittedBy.mrRank ?? "N/A"})`
		: `${report.submittedBy.userRole} ${report.submittedBy.userName}`;

	const recentErrorsHtml =
		report.diagnostics.recentErrors &&
		report.diagnostics.recentErrors.length > 0
			? `<div style="margin-top: 15px; padding: 12px; background-color: #1E293B; color: #F87171; border-radius: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto;">
				<strong>Captured Client Logs:</strong><br/>
				${report.diagnostics.recentErrors.map((e) => `• ${e}`).join("<br/>")}
			</div>`
			: "";

	const htmlBody = `
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="utf-8">
		<title>PharmaQL User Feedback & Error Report</title>
	</head>
	<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B;">
		<div style="max-width: 650px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
			<!-- Header -->
			<div style="background-color: #0B2545; color: #FFFFFF; padding: 20px 24px; border-bottom: 4px solid ${urgencyColor};">
				<div style="display: flex; justify-content: space-between; align-items: center;">
					<h2 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em;">
						PharmaQL Feedback & Issue Alert
					</h2>
					<span style="background-color: ${urgencyColor}; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase;">
						${report.urgency}
					</span>
				</div>
				<p style="margin: 6px 0 0; font-size: 13px; color: #94A3B8;">
					Ticket ID: <strong>${report.id}</strong> | ${new Date(report.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
				</p>
			</div>

			<div style="padding: 24px;">
				<!-- Submitter Attribution Card -->
				<div style="background-color: #F1F5F9; border-left: 4px solid #0071BC; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
					<div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B; margin-bottom: 4px;">
						Report Submitted By:
					</div>
					<div style="font-size: 15px; font-weight: 700; color: #0F172A;">
						${submitterHeadline}
					</div>
					<div style="font-size: 13px; color: #475569; margin-top: 4px;">
						Email: <strong>${report.submittedBy.userEmail}</strong> &bull; User ID: <code>${report.submittedBy.userId}</code>
						${report.submittedBy.division ? ` &bull; Division: <strong>${report.submittedBy.division}</strong>` : ""}
						${report.contactNote ? `<br/>Contact Note: <em>"${report.contactNote}"</em>` : ""}
					</div>
				</div>

				<!-- Subject & Category -->
				<div style="margin-bottom: 16px;">
					<span style="font-size: 12px; font-weight: 600; color: #0284C7; background-color: #E0F2FE; padding: 3px 8px; border-radius: 6px;">
						${categoryLabel}
					</span>
					<h3 style="margin: 8px 0 6px; font-size: 17px; color: #0F172A; font-weight: 700;">
						${report.title}
					</h3>
				</div>

				<!-- Description -->
				<div style="background-color: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">
${report.description}
				</div>

				<!-- Diagnostic Context -->
				<div style="margin-top: 20px; border-top: 1px solid #E2E8F0; padding-top: 16px;">
					<h4 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase;">
						Environment Diagnostics
					</h4>
					<table style="width: 100%; font-size: 12px; border-collapse: collapse; color: #475569;">
						<tr>
							<td style="padding: 4px 0; width: 140px; font-weight: 600;">Active Page URL:</td>
							<td style="padding: 4px 0; word-break: break-all;"><code>${report.diagnostics.url}</code></td>
						</tr>
						${
							report.diagnostics.tab
								? `<tr><td style="padding: 4px 0; font-weight: 600;">Active Tab:</td><td style="padding: 4px 0;"><strong>${report.diagnostics.tab}</strong></td></tr>`
								: ""
						}
						${
							report.diagnostics.division
								? `<tr><td style="padding: 4px 0; font-weight: 600;">Selected Division:</td><td style="padding: 4px 0;">${report.diagnostics.division}</td></tr>`
								: ""
						}
						<tr>
							<td style="padding: 4px 0; font-weight: 600;">User-Agent / Device:</td>
							<td style="padding: 4px 0; word-break: break-all;">${report.diagnostics.userAgent}</td>
						</tr>
						${
							report.diagnostics.viewport
								? `<tr><td style="padding: 4px 0; font-weight: 600;">Viewport:</td><td style="padding: 4px 0;">${report.diagnostics.viewport} ${report.diagnostics.isPwa ? "(PWA Installed)" : ""}</td></tr>`
								: ""
						}
						${
							report.diagnostics.ip
								? `<tr><td style="padding: 4px 0; font-weight: 600;">Client IP:</td><td style="padding: 4px 0;">${report.diagnostics.ip}</td></tr>`
								: ""
						}
					</table>

					${recentErrorsHtml}
				</div>

				<!-- Action Footer -->
				<div style="margin-top: 24px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px;">
					<p style="font-size: 13px; color: #64748B; margin-bottom: 12px;">
						This issue is logged in the Developer Control Center.
					</p>
					<a href="${process.env.NEXTAUTH_URL || "https://pharmaql.vercel.app"}/admin/dev?tab=feedback" 
					   style="display: inline-block; background-color: #0071BC; color: #FFFFFF; font-weight: 600; font-size: 13px; text-decoration: none; padding: 10px 20px; border-radius: 8px;">
						Inspect Ticket in Dev Control Center &rarr;
					</a>
				</div>
			</div>
		</div>
	</body>
	</html>
	`;

	const subject = `[PharmaQL ${report.urgency}] ${report.category}: ${report.title} (${isMR ? `MR ${report.submittedBy.userName}` : report.submittedBy.userName})`;

	try {
		const info = await mailer.sendMail({
			from: `"PharmaQL Alert" <${adminFromEmail}>`,
			to: developerEmail,
			subject,
			html: htmlBody,
			text: `Ticket: ${report.id}\nCategory: ${report.category}\nUrgency: ${report.urgency}\nSubmitted By: ${report.submittedBy.userName} (${report.submittedBy.userRole}, ${report.submittedBy.userEmail})\n\nTitle: ${report.title}\n\nDescription:\n${report.description}\n\nURL: ${report.diagnostics.url}`,
		});

		return { success: true, messageId: info.messageId };
	} catch (err: any) {
		console.error("Failed to send developer feedback alert email:", err);
		return { success: false, error: err.message || "Email dispatch failed" };
	}
}
