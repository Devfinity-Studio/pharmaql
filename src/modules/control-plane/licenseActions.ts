"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import {
	getTenantAction,
	listTenantsAction,
	saveTenantAction,
	type TenantListItem,
} from "@/modules/control-plane/tenantActions";
import { sendDeveloperEmail } from "@/lib/mailer";

export interface TenantLicenseSummary {
	tenantId: string;
	slug: string;
	displayName: string;
	customDomain?: string | null;
	adminEmail?: string | null;
	status: "ACTIVE" | "EXPIRED" | "SUSPENDED";
	expiresAt: string;
	gracePeriodDays: number;
	daysRemaining: number;
	isBlocked: boolean;
	killswitchActive: boolean;
}

export interface MultiTenantLicenseOverview {
	tenants: TenantLicenseSummary[];
	metrics: {
		total: number;
		active: number;
		expiringSoon: number; // <= 30 days
		blocked: number;
	};
}

async function assertDeveloperSession() {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({ headers: reqHeaders });
	if (!session || session.user.role !== "DEVELOPER") {
		throw new Error("Unauthorized: Developer session required.");
	}
	return session;
}

/**
 * Fetch license status for all registered tenants with computed validity and metrics.
 */
export async function getMultiTenantLicensesAction(): Promise<MultiTenantLicenseOverview> {
	await assertDeveloperSession();

	const res = await listTenantsAction();
	const tenantList = res.success && res.tenants ? res.tenants : [];
	const now = Date.now();

	const summaries: TenantLicenseSummary[] = tenantList.map((t) => {
		const expiresAt = t.license_expires_at || "2027-03-31T23:59:59.000Z";
		const gracePeriodDays = t.license_grace_days ?? 7;
		const expiryTime = new Date(expiresAt).getTime();
		const diffMs = expiryTime - now;
		const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		const rawStatus = (t.license_status as any) || "ACTIVE";
		const killswitch = Boolean(t.is_license_blocked);

		let isBlocked = killswitch || rawStatus === "SUSPENDED";
		if (!isBlocked && (rawStatus === "EXPIRED" || daysRemaining < 0)) {
			const overdueDays = Math.max(0, Math.abs(daysRemaining));
			if (rawStatus === "EXPIRED" || overdueDays > gracePeriodDays) {
				isBlocked = true;
			}
		}

		return {
			tenantId: t.id,
			slug: t.slug,
			displayName: t.display_name,
			customDomain: t.custom_domain,
			adminEmail: t.admin_email,
			status: rawStatus,
			expiresAt,
			gracePeriodDays,
			daysRemaining,
			isBlocked,
			killswitchActive: killswitch,
		};
	});

	const metrics = {
		total: summaries.length,
		active: summaries.filter((s) => s.status === "ACTIVE" && !s.isBlocked).length,
		expiringSoon: summaries.filter((s) => !s.isBlocked && s.daysRemaining >= 0 && s.daysRemaining <= 30).length,
		blocked: summaries.filter((s) => s.isBlocked).length,
	};

	return {
		tenants: summaries,
		metrics,
	};
}

/**
 * Update licensing settings for a specific tenant.
 */
export async function updateTenantLicenseAction(
	tenantId: string,
	input: {
		license_status?: "ACTIVE" | "EXPIRED" | "SUSPENDED";
		license_expires_at?: string;
		license_grace_days?: number;
		is_license_blocked?: boolean;
	},
): Promise<{ success: boolean; error?: string }> {
	await assertDeveloperSession();

	const tenantRes = await getTenantAction(tenantId);
	if (!tenantRes.success || !tenantRes.tenant) {
		return { success: false, error: "Tenant not found." };
	}

	const t = tenantRes.tenant;
	const saveRes = await saveTenantAction({
		id: t.id,
		slug: t.slug,
		custom_domain: t.custom_domain,
		is_active: t.is_active,
		display_name: t.display_name,
		short_name: t.short_name,
		logo_url: t.logo_url,
		primary_color: t.primary_color,
		accent_color: t.accent_color,
		address: t.address,
		contact_phone: t.contact_phone,
		contact_email: t.contact_email,
		support_email: t.support_email,
		user_email_domain: t.user_email_domain,
		gstin: t.gstin,
		api_server_url: t.api_server_url,
		legacy_db_name: t.legacy_db_name,
		erp_software_type: t.erp_software_type,
		comp_no: t.comp_no,
		loc_no: t.loc_no,
		overdue_direct_block_days: t.overdue_direct_block_days,
		overdue_division_block_days: t.overdue_division_block_days,
		overdue_blocking_disabled: t.overdue_blocking_disabled,
		max_data_days: t.max_data_days,
		admin_email: t.admin_email,
		smtp_host: t.smtp_host,
		smtp_port: t.smtp_port,
		smtp_secure: t.smtp_secure,
		smtp_user: t.smtp_user,
		smtp_from_name: t.smtp_from_name,
		smtp_from_email: t.smtp_from_email,
		license_status: input.license_status ?? t.license_status ?? "ACTIVE",
		license_expires_at: input.license_expires_at ?? t.license_expires_at ?? "2027-03-31T23:59:59.000Z",
		license_grace_days: input.license_grace_days ?? t.license_grace_days ?? 7,
		is_license_blocked: input.is_license_blocked !== undefined ? input.is_license_blocked : t.is_license_blocked,
	});

	if (saveRes.success) {
		revalidatePath("/admin/dev");
		return { success: true };
	}

	return { success: false, error: saveRes.error || "Failed to update tenant license." };
}

/**
 * Dispatch an official license renewal email to a tenant's administrator.
 */
export async function sendTenantRenewalNoticeAction(
	tenantId: string,
): Promise<{ success: boolean; message: string }> {
	await assertDeveloperSession();

	const tenantRes = await getTenantAction(tenantId);
	if (!tenantRes.success || !tenantRes.tenant) {
		return { success: false, message: "Tenant not found." };
	}

	const t = tenantRes.tenant;
	const recipient = t.admin_email || t.contact_email;
	if (!recipient) {
		return { success: false, message: "No admin email configured for this tenant." };
	}

	const expiryFormatted = t.license_expires_at
		? new Date(t.license_expires_at).toLocaleDateString("en-IN", {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: "March 31, 2027";

	const html = `
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
			<div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0071BC; padding-bottom: 16px;">
				<h2 style="color: #0B2545; margin: 0; font-size: 24px;">${t.display_name}</h2>
				<p style="color: #0071BC; font-weight: bold; margin: 4px 0 0 0; font-size: 14px;">PharmaQL Software License Renewal Notice</p>
			</div>

			<p style="color: #334155; font-size: 15px;">Dear Administrator,</p>
			<p style="color: #334155; font-size: 14px; line-height: 1.6;">
				This is an official notice regarding the software license and ERP bridge maintenance subscription for <strong>${t.display_name}</strong>.
			</p>

			<div style="background-color: #f8fafc; border-left: 4px solid #0071BC; padding: 16px; margin: 20px 0; border-radius: 6px;">
				<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
					<tr>
						<td style="padding: 6px 0; color: #64748b; width: 140px;">Tenant:</td>
						<td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${t.display_name} (${t.slug})</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b;">License Expiry:</td>
						<td style="padding: 6px 0; font-weight: bold; color: #0369a1;">${expiryFormatted}</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b;">Status:</td>
						<td style="padding: 6px 0; font-weight: bold; color: ${t.is_license_blocked ? "#dc2626" : "#16a34a"};">
							${t.is_license_blocked ? "BLOCKED / SUSPENDED" : t.license_status || "ACTIVE"}
						</td>
					</tr>
				</table>
			</div>

			<p style="color: #475569; font-size: 13px; line-height: 1.5;">
				Please coordinate with your Devfinity account manager or support team to process your subscription renewal before the grace period expires.
			</p>

			<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
				PharmaQL Enterprise Multi-Tenant Platform &bull; Devfinity Studio
			</div>
		</div>
	`;

	const sent = await sendDeveloperEmail({
		to: recipient,
		subject: `[Notice] PharmaQL Software License Renewal Reminder — ${t.display_name}`,
		html,
	});

	if (sent) {
		return { success: true, message: `Renewal reminder dispatched to ${recipient}` };
	}
	return { success: false, message: "Failed to send email. Check SMTP server configuration." };
}

