import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.GMAIL_USER || "info.devolvestudio@gmail.com",
		pass: process.env.GMAIL_PASS || "uvowptulliolfumd",
	},
});

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
