import { sendDeveloperEmail } from "./mailer";
import { readServerJson, writeServerJson } from "./server-storage";

export interface LicenseConfig {
	status: "ACTIVE" | "EXPIRED" | "SUSPENDED";
	expiresAt: string; // ISO date string, e.g. 2027-03-31T23:59:59.000Z
	gracePeriodDays: number;
	killswitchActive: boolean;
	organization: string;
	developerEmail: string;
	supportEmail: string;
	adminEmails: string[];
	updatedAt: string;
	updatedBy: string;
}

const DEFAULT_LICENSE: LicenseConfig = {
	status: "ACTIVE",
	expiresAt: "2027-03-31T23:59:59.000Z",
	gracePeriodDays: 7,
	killswitchActive: false,
	organization: "Asmee Pharma Pvt. Ltd.",
	developerEmail: process.env.DEV_EMAIL || "dev@asmeepharma.com",
	supportEmail: "support@devfinity.net",
	adminEmails: [process.env.DEV_EMAIL || "dev@asmeepharma.com"],
	updatedAt: new Date().toISOString(),
	updatedBy: "system",
};

/**
 * Retrieve current raw license configuration safely from server storage.
 * Resilient against Vercel/serverless read-only filesystems.
 */
export async function getLicenseConfig(): Promise<LicenseConfig> {
	const data = await readServerJson<Partial<LicenseConfig>>("license.json", DEFAULT_LICENSE);
	const config: LicenseConfig = { ...DEFAULT_LICENSE, ...data };

	// Sanitize adminEmails: replace dummy admin@admin.com with developer email
	if (
		!config.adminEmails ||
		config.adminEmails.length === 0 ||
		(config.adminEmails.length === 1 && config.adminEmails[0] === "admin@admin.com")
	) {
		config.adminEmails = [config.developerEmail || process.env.DEV_EMAIL || "dev@asmeepharma.com"];
	}
	return config;
}

export interface LicenseStatusResult {
	status: "ACTIVE" | "EXPIRED" | "SUSPENDED";
	isBlocked: boolean;
	daysRemaining: number;
	expiresAt: string;
	killswitchActive: boolean;
	reason?: string;
	organization: string;
	supportEmail: string;
	developerEmail: string;
	adminEmails: string[];
	gracePeriodDays: number;
}

/**
 * Computes live subscription status, remaining days, and access block state.
 */
export async function getLicenseStatus(): Promise<LicenseStatusResult> {
	const config = await getLicenseConfig();
	const now = Date.now();
	const expiryTime = new Date(config.expiresAt).getTime();
	const diffMs = expiryTime - now;
	const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

	if (config.killswitchActive || config.status === "SUSPENDED") {
		return {
			status: "SUSPENDED",
			isBlocked: true,
			daysRemaining,
			expiresAt: config.expiresAt,
			killswitchActive: true,
			reason: "Software access has been suspended due to subscription renewal requirement.",
			organization: config.organization,
			supportEmail: config.supportEmail,
			developerEmail: config.developerEmail,
			adminEmails: config.adminEmails,
			gracePeriodDays: config.gracePeriodDays,
		};
	}

	if (config.status === "EXPIRED" || daysRemaining < 0) {
		const daysOverdue = Math.max(0, Math.abs(daysRemaining));
		if (config.status === "EXPIRED" || daysOverdue > config.gracePeriodDays) {
			return {
				status: "EXPIRED",
				isBlocked: true,
				daysRemaining,
				expiresAt: config.expiresAt,
				killswitchActive: false,
				reason: `Software subscription expired on ${new Date(config.expiresAt).toLocaleDateString()}. Grace period elapsed.`,
				organization: config.organization,
				supportEmail: config.supportEmail,
				developerEmail: config.developerEmail,
				adminEmails: config.adminEmails,
				gracePeriodDays: config.gracePeriodDays,
			};
		}

		// Inside grace period
		return {
			status: "EXPIRED",
			isBlocked: false,
			daysRemaining,
			expiresAt: config.expiresAt,
			killswitchActive: false,
			reason: `Subscription expired. Grace period active (${config.gracePeriodDays - daysOverdue} days remaining).`,
			organization: config.organization,
			supportEmail: config.supportEmail,
			developerEmail: config.developerEmail,
			adminEmails: config.adminEmails,
			gracePeriodDays: config.gracePeriodDays,
		};
	}

	// Dispatch automated subscription milestone alert to Admins/Developers if within 14 days (throttled to 1/24h)
	if (daysRemaining <= 14 && daysRemaining > 0) {
		(async () => {
			try {
				const { sendPushToRole, getInAppNotifications } = await import("@/lib/push-notifications");
				const notifs = await getInAppNotifications();
				const recentlyAlerted = notifs.some(
					(n) => n.category === "SUBSCRIPTION" && Date.now() - new Date(n.createdAt).getTime() < 24 * 60 * 60 * 1000,
				);
				if (!recentlyAlerted) {
					await sendPushToRole("ADMIN", {
						title: "⚠️ Subscription Renewal Milestone",
						body: `PharmaQL license expires in ${daysRemaining} days (${new Date(config.expiresAt).toLocaleDateString()}). Please renew to ensure uninterrupted operation.`,
						url: "/admin/dev",
						category: "SUBSCRIPTION",
						urgency: "HIGH",
					});
				}
			} catch (err) {
				console.warn("[LicensePush] Renewal push alert error:", err);
			}
		})();
	}

	return {
		status: "ACTIVE",
		isBlocked: false,
		daysRemaining,
		expiresAt: config.expiresAt,
		killswitchActive: false,
		organization: config.organization,
		supportEmail: config.supportEmail,
		developerEmail: config.developerEmail,
		adminEmails: config.adminEmails,
		gracePeriodDays: config.gracePeriodDays,
	};
}

/**
 * Update license parameters (extend subscription date, toggle killswitch, update admin list).
 */
export async function updateLicenseConfig(
	update: Partial<LicenseConfig>,
	updatedBy: string,
): Promise<LicenseConfig> {
	const current = await getLicenseConfig();
	const next: LicenseConfig = {
		...current,
		...update,
		updatedAt: new Date().toISOString(),
		updatedBy,
	};

	await writeServerJson("license.json", next);
	return next;
}

/**
 * Dispatch subscription renewal reminder & invoice email to developer or configured recipients.
 * Guarantees that emails sent from the developer portal target the developer email, not dummy admin@admin.com.
 */
export async function sendSubscriptionReminderEmails(
	customNote?: string,
	targetEmails?: string[],
) {
	const status = await getLicenseStatus();
	const devEmail = process.env.DEV_EMAIL || status.developerEmail || "dev@asmeepharma.com";

	// Determine recipients:
	// 1. Explicitly provided targetEmails
	// 2. Filter status.adminEmails to remove dummy "admin@admin.com"
	// 3. Fallback to developer email
	let recipients: string[] = [];
	if (targetEmails && targetEmails.length > 0) {
		recipients = targetEmails.map((e) => e.trim()).filter(Boolean);
	} else {
		recipients = (status.adminEmails || [])
			.map((e) => e.trim())
			.filter((e) => Boolean(e) && e.toLowerCase() !== "admin@admin.com");
	}

	if (recipients.length === 0) {
		recipients = [devEmail];
	}

	const expiryFormatted = new Date(status.expiresAt).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	const subject = `[Notice] PharmaQL Software License Renewal Reminder — ${status.organization}`;

	const html = `
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
			<div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0071BC; padding-bottom: 16px;">
				<h2 style="color: #0B2545; margin: 0; font-size: 24px;">Asmee Pharma Pvt. Ltd.</h2>
				<p style="color: #0071BC; font-weight: bold; margin: 4px 0 0 0; font-size: 14px;">PharmaQL ERP Portal Software License</p>
			</div>

			<p style="color: #334155; font-size: 15px;">Dear Team,</p>
			<p style="color: #334155; font-size: 14px; line-height: 1.6;">
				This is an official notice regarding the software license and maintenance subscription for <strong>${status.organization}</strong>.
			</p>

			<div style="background-color: #f8fafc; border-left: 4px solid #0071BC; padding: 16px; margin: 20px 0; border-radius: 6px;">
				<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
					<tr>
						<td style="padding: 6px 0; color: #64748b; width: 140px;">Subscription Status:</td>
						<td style="padding: 6px 0; font-weight: bold; color: ${status.isBlocked ? "#dc2626" : status.daysRemaining < 30 ? "#d97706" : "#16a34a"};">
							${status.status} ${status.isBlocked ? "(BLOCKED)" : `(${status.daysRemaining} days remaining)`}
						</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b;">Current Expiry Date:</td>
						<td style="padding: 6px 0; font-weight: bold; color: #0B2545;">${expiryFormatted}</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b;">Grace Period:</td>
						<td style="padding: 6px 0; font-weight: bold; color: #0B2545;">${status.gracePeriodDays} Days</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b;">Developer Email:</td>
						<td style="padding: 6px 0; font-weight: bold; color: #0071BC;">${devEmail}</td>
					</tr>
				</table>
			</div>

			${
				customNote
					? `<div style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #92400e;">
						<strong>Developer Note:</strong> ${customNote}
					</div>`
					: ""
			}

			<p style="color: #334155; font-size: 14px; line-height: 1.6;">
				To ensure uninterrupted access for all Medical Representatives, order processing, and administrative report generation, please complete your renewal before the license expiration date.
			</p>

			<div style="margin: 28px 0; text-align: center;">
				<a href="mailto:${status.supportEmail}?subject=PharmaQL%20License%20Renewal%20${encodeURIComponent(status.organization)}" style="background-color: #0071BC; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 8px; display: inline-block; font-size: 14px;">
					Contact Devfinity Support for Renewal
				</a>
			</div>

			<div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
				<p style="margin: 0;">Sent by PharmaQL Developer Systems &bull; Developer: <a href="mailto:${devEmail}" style="color: #0071BC;">${devEmail}</a> &bull; Support: <a href="mailto:${status.supportEmail}" style="color: #0071BC;">${status.supportEmail}</a></p>
			</div>
		</div>
	`;

	let sentCount = 0;
	for (const recipient of recipients) {
		try {
			await sendDeveloperEmail({
				senderName: "PharmaQL Developer Systems",
				to: recipient,
				subject,
				html,
			});
			sentCount += 1;
		} catch (err) {
			console.error(`[LicenseMailer] Failed to send email to ${recipient}:`, err);
		}
	}

	return {
		success: sentCount > 0,
		sentCount,
		message: `Successfully dispatched renewal notice to ${sentCount} recipient(s) (${recipients.join(", ")}).`,
	};
}

/**
 * Toggle emergency killswitch.
 */
export async function toggleKillswitch(
	active: boolean,
	updatedBy: string,
): Promise<LicenseConfig> {
	return updateLicenseConfig({ killswitchActive: active }, updatedBy);
}

/**
 * Extend subscription by a number of days from current expiry.
 */
export async function extendSubscriptionDays(
	days: number,
	updatedBy: string,
): Promise<LicenseConfig> {
	const current = await getLicenseConfig();
	const currentExpiry = new Date(current.expiresAt).getTime();
	const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
	const newExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
	return updateLicenseConfig({ expiresAt: newExpiry }, updatedBy);
}

/**
 * Immediately suspend software usage due to subscription expiration or payment hold.
 * Blocks all MRs and standard Admins instantly platform-wide.
 */
export async function suspendUsageImmediately(
	updatedBy: string,
): Promise<LicenseConfig> {
	return updateLicenseConfig(
		{ status: "SUSPENDED", killswitchActive: true },
		updatedBy,
	);
}

/**
 * Force subscription into an expired state immediately (for testing or billing lock).
 */
export async function forceExpireImmediately(
	updatedBy: string,
): Promise<LicenseConfig> {
	const expiredPastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
	return updateLicenseConfig(
		{ status: "EXPIRED", killswitchActive: false, expiresAt: expiredPastDate },
		updatedBy,
	);
}

/**
 * Restore active subscription usage and unblock platform access immediately.
 */
export async function restoreActiveUsage(
	updatedBy: string,
): Promise<LicenseConfig> {
	const current = await getLicenseConfig();
	const currentExpiryTime = new Date(current.expiresAt).getTime();
	// If expiry date was expired or in the past, guarantee at least 1-year extension from now
	const expiresAt =
		currentExpiryTime <= Date.now()
			? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
			: current.expiresAt;

	return updateLicenseConfig(
		{ status: "ACTIVE", killswitchActive: false, expiresAt },
		updatedBy,
	);
}

