import nodemailer, { type Transporter } from "nodemailer";

/**
 * Standard Admin Transporter
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
 * If DEV_SMTP_USER and DEV_SMTP_PASS are configured in environment, uses them.
 * Otherwise gracefully falls back to the default admin mailer instance.
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

		if (host) {
			cachedDeveloperMailer = nodemailer.createTransport({
				host,
				port: port || 587,
				secure: port === 465,
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

	// Fallback to standard mailer if developer SMTP not yet configured
	return mailer;
}

/**
 * Send an email specifically from the Developer to Admins or MRs.
 * Originates from the developer's credentials and verified sender email.
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
 */
export async function sendOtpEmail(to: string, otp: string, mrName?: string) {
	const mailOptions = {
		from: `"Asmee Pharma Portal" <${process.env.GMAIL_USER || "info.devolvestudio@gmail.com"}>`,
		to,
		subject: `Your PharmaQL Login OTP: ${otp}`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
				<div style="text-align: center; margin-bottom: 20px;">
					<h2 style="color: #0B2545; margin: 0; font-size: 22px;">Asmee Pharma Portal</h2>
					<p style="color: #64748b; font-size: 13px; margin-top: 4px;">PharmaQL Medical Representative Verification</p>
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
