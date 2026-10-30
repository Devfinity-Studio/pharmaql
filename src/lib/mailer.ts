import nodemailer, { type Transporter } from "nodemailer";
import { decryptSecret } from "@/lib/crypto";
import { getControlPlaneSql } from "@/lib/control-plane-db";
import { getLocalTenantById, getLocalTenantBySlug } from "@/lib/local-tenants-store";

export interface TenantMailerInstance {
	transporter: Transporter;
	sender: {
		name: string;
		email: string;
	};
	brand: {
		name: string;
		logoUrl?: string | null;
		primaryColor?: string | null;
		accentColor?: string | null;
		supportEmail?: string | null;
	};
}

// In-memory cache for pooled tenant transporters (15 min TTL)
const tenantMailersCache = new Map<
	string,
	{ instance: TenantMailerInstance; cachedAt: number }
>();
const MAILER_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Invalidate cached mailer transporter for a tenant (e.g. after updating SMTP settings).
 */
export function evictTenantMailer(tenantId: string) {
	tenantMailersCache.delete(tenantId);
}

/**
 * Dynamically resolves or creates a dedicated Nodemailer Transporter for a tenant.
 * Queries Neon PostgreSQL (or local fallback store) and decrypts stored SMTP credentials.
 * Returns null if tenant has not configured custom SMTP.
 */
export async function getTenantMailer(
	tenantId: string,
): Promise<TenantMailerInstance | null> {
	if (!tenantId) return null;

	const cached = tenantMailersCache.get(tenantId);
	if (cached && Date.now() - cached.cachedAt < MAILER_CACHE_TTL_MS) {
		return cached.instance;
	}

	let rawTenant: any = null;
	const sql = getControlPlaneSql();

	if (sql) {
		try {
			const rows = await sql`
				SELECT 
					id,
					display_name,
					logo_url,
					primary_color,
					accent_color,
					support_email,
					contact_email,
					smtp_host,
					smtp_port,
					smtp_secure,
					smtp_user,
					smtp_password_encrypted,
					smtp_from_name,
					smtp_from_email
				FROM tenants 
				WHERE id::text = ${tenantId} OR slug = ${tenantId} 
				LIMIT 1;
			`;
			if (rows.length > 0) rawTenant = rows[0];
		} catch (err) {
			console.error("[Mailer] Error fetching tenant SMTP from cloud database:", err);
		}
	} else {
		try {
			rawTenant =
				(await getLocalTenantById(tenantId)) ||
				(await getLocalTenantBySlug(tenantId));
		} catch (err) {
			console.error("[Mailer] Error fetching tenant SMTP from local store:", err);
		}
	}

	if (!rawTenant) return null;

	const host = rawTenant.smtp_host?.trim();
	const user = rawTenant.smtp_user?.trim();
	const encryptedPass = rawTenant.smtp_password_encrypted?.trim();

	if (!host || !user || !encryptedPass) {
		return null;
	}

	let decryptedPass = "";
	try {
		decryptedPass = decryptSecret(encryptedPass);
	} catch (err) {
		console.error(`[Mailer] Failed to decrypt SMTP password for tenant ${tenantId}:`, err);
		return null;
	}

	const port = Number(rawTenant.smtp_port) || 465;
	const secure =
		rawTenant.smtp_secure !== false && rawTenant.smtp_secure !== "false";

	const transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: {
			user,
			pass: decryptedPass,
		},
		connectionTimeout: 10000,
		greetingTimeout: 10000,
		socketTimeout: 15000,
	});

	const displayName = rawTenant.display_name?.trim() || "PharmaQL Partner";
	const fromName = rawTenant.smtp_from_name?.trim() || `${displayName} Verification`;
	const fromEmail = rawTenant.smtp_from_email?.trim() || user;

	const instance: TenantMailerInstance = {
		transporter,
		sender: {
			name: fromName,
			email: fromEmail,
		},
		brand: {
			name: displayName,
			logoUrl: rawTenant.logo_url || null,
			primaryColor: rawTenant.primary_color || "#0B2545",
			accentColor: rawTenant.accent_color || "#134074",
			supportEmail: rawTenant.support_email || rawTenant.contact_email || null,
		},
	};

	tenantMailersCache.set(tenantId, { instance, cachedAt: Date.now() });
	return instance;
}

/**
 * Standard Admin Transporter (Fallback for legacy/platform usage)
 */
export const mailer: Transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.GMAIL_USER || "info.devolvestudio@gmail.com",
		pass: process.env.GMAIL_PASS || "uvowptulliolfumd",
	},
});

let cachedDeveloperMailer: Transporter | null = null;

/**
 * Check whether dedicated developer SMTP credentials are configured.
 */
export function isDeveloperMailerConfigured(): boolean {
	return Boolean(process.env.DEV_SMTP_USER && process.env.DEV_SMTP_PASS);
}

/**
 * Get active developer sender email address.
 */
export function getDeveloperSenderEmail(): string {
	return process.env.DEV_EMAIL || process.env.DEV_SMTP_USER || "dev@asmeepharma.com";
}

/**
 * Retrieve or instantiate dedicated Developer Transporter.
 */
export function getDeveloperMailer(): Transporter {
	if (cachedDeveloperMailer) {
		return cachedDeveloperMailer;
	}

	const devUser = process.env.DEV_SMTP_USER;
	const devPass = process.env.DEV_SMTP_PASS;

	if (devUser && devPass) {
		const host = process.env.DEV_SMTP_HOST;
		const port = process.env.DEV_SMTP_PORT ? Number(process.env.DEV_SMTP_PORT) : undefined;
		const isZoho =
			(host && host.includes("zoho")) ||
			devUser.toLowerCase().includes("@devfinity.net") ||
			devUser.toLowerCase().includes("zoho");

		const resolvedHost = host || (isZoho ? "smtp.zoho.in" : undefined);
		const resolvedPort = port || (isZoho ? 465 : 587);
		const resolvedSecure = resolvedPort === 465;

		if (resolvedHost) {
			cachedDeveloperMailer = nodemailer.createTransport({
				host: resolvedHost,
				port: resolvedPort,
				secure: resolvedSecure,
				auth: {
					user: devUser,
					pass: devPass,
				},
			});
		} else {
			cachedDeveloperMailer = nodemailer.createTransport({
				service: "gmail",
				auth: {
					user: devUser,
					pass: devPass,
				},
			});
		}
		return cachedDeveloperMailer;
	}

	return mailer;
}

/**
 * Send an email specifically from the Developer to Admins or MRs.
 */
export async function sendDeveloperEmail({
	to,
	subject,
	html,
	text,
	senderName = "PharmaQL Developer",
}: {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	senderName?: string;
}) {
	const transporter = getDeveloperMailer();
	const senderEmail = getDeveloperSenderEmail();

	const mailOptions = {
		from: `"${senderName}" <${senderEmail}>`,
		to,
		subject,
		html,
		text: text || html.replace(/<[^>]*>?/gm, ""),
	};

	return await transporter.sendMail(mailOptions);
}

/**
 * Send MR login verification OTP email.
 * If tenantId is passed, enforces dedicated tenant SMTP with white-labeled branding.
 */
export async function sendOtpEmail(
	to: string,
	otp: string,
	mrName?: string,
	tenantId?: string,
) {
	if (tenantId) {
		const tenantMailer = await getTenantMailer(tenantId);
		if (!tenantMailer) {
			throw new Error(
				"Email service is not configured for this organization. Please contact your administrator.",
			);
		}

		const brand = tenantMailer.brand;
		const primaryColor = brand.primaryColor || "#0B2545";
		const accentColor = brand.accentColor || "#0071BC";

		const logoHeader = brand.logoUrl
			? `<div style="text-align: center; margin-bottom: 20px;">
					<img src="${brand.logoUrl}" alt="${brand.name}" style="max-height: 48px; max-width: 180px; object-fit: contain;" />
					<p style="color: #64748b; font-size: 13px; margin-top: 6px;">${brand.name} Portal Verification</p>
				</div>`
			: `<div style="text-align: center; margin-bottom: 20px;">
					<h2 style="color: ${primaryColor}; margin: 0; font-size: 22px;">${brand.name}</h2>
					<p style="color: #64748b; font-size: 13px; margin-top: 4px;">Medical Representative Portal Verification</p>
				</div>`;

		const supportFooter = brand.supportEmail
			? `<p style="color: #94a3b8; font-size: 11px; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px; text-align: center;">
					Need assistance? Contact support at <a href="mailto:${brand.supportEmail}" style="color: ${accentColor}; text-decoration: none;">${brand.supportEmail}</a>
				</p>`
			: "";

		const mailOptions = {
			from: `"${tenantMailer.sender.name}" <${tenantMailer.sender.email}>`,
			to,
			subject: `Your ${brand.name} Login OTP: ${otp}`,
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
					${logoHeader}
					<p style="color: #334155; font-size: 15px; margin-bottom: 12px;">Hello <strong>${mrName || "Medical Representative"}</strong>,</p>
					<p style="color: #334155; font-size: 14px; line-height: 1.5;">Use the one-time verification code below to securely log into your ${brand.name} portal account:</p>
					<div style="background-color: #f8fafc; border: 1px solid ${accentColor}33; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0;">
						<span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: ${accentColor}; font-family: monospace;">${otp}</span>
					</div>
					<p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This OTP will expire in 10 minutes. If you did not request this login, please ignore this email.</p>
					${supportFooter}
				</div>
			`,
		};

		return await tenantMailer.transporter.sendMail(mailOptions);
	}

	// Platform / Dev fallback
	const mailOptions = {
		from: `"PharmaQL Portal" <${process.env.GMAIL_USER || "info.devolvestudio@gmail.com"}>`,
		to,
		subject: `Your PharmaQL Login OTP: ${otp}`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
				<div style="text-align: center; margin-bottom: 20px;">
					<h2 style="color: #0B2545; margin: 0; font-size: 22px;">PharmaQL Portal</h2>
					<p style="color: #64748b; font-size: 13px; margin-top: 4px;">Medical Representative Verification</p>
				</div>
				<p style="color: #334155; font-size: 15px; margin-bottom: 12px;">Hello <strong>${mrName || "Medical Representative"}</strong>,</p>
				<p style="color: #334155; font-size: 14px; line-height: 1.5;">Use the one-time verification code below to securely log into your portal account:</p>
				<div style="background-color: #f1f5f9; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0;">
					<span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0071BC; font-family: monospace;">${otp}</span>
				</div>
				<p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This OTP will expire in 10 minutes. If you did not request this login, please ignore this email.</p>
			</div>
		`,
	};

	return await mailer.sendMail(mailOptions);
}

/**
 * Verify transporter SMTP handshake connectivity and measure response latency.
 */
export async function verifyMailerConnection(type: "ADMIN" | "DEVELOPER"): Promise<{
	configured: boolean;
	success: boolean;
	latencyMs: number;
	user: string;
	error?: string;
}> {
	const isDev = type === "DEVELOPER";
	const isConfigured = isDev
		? isDeveloperMailerConfigured()
		: Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS);

	const user = isDev
		? getDeveloperSenderEmail()
		: process.env.GMAIL_USER || "info.devolvestudio@gmail.com";

	const transporter = isDev ? getDeveloperMailer() : mailer;
	const start = Date.now();

	try {
		await transporter.verify();
		return {
			configured: isConfigured,
			success: true,
			latencyMs: Date.now() - start,
			user,
		};
	} catch (err: any) {
		return {
			configured: isConfigured,
			success: false,
			latencyMs: Date.now() - start,
			user,
			error: err.message || "SMTP handshake verification failed",
		};
	}
}
