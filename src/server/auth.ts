import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { db } from "./db";
import * as schema from "./db/schema";

const getBaseUrl = () => {
	let url =
		process.env.BETTER_AUTH_URL ||
		process.env.VERCEL_URL ||
		"http://localhost:3000";
	if (url && !url.startsWith("http")) {
		url = `https://${url}`;
	}
	return url;
};

export const auth = betterAuth({
	baseURL: getBaseUrl(),
	trustedOrigins: [
		"https://asmeepharma.com",
		"https://pharmaql.vercel.app",
		"https://www.asmeepharma.com",
	],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
		minPasswordLength: 3,
	},
	secret: env.BETTER_AUTH_SECRET,
	user: {
		additionalFields: {
			role: {
				type: "string",
				required: true,
				defaultValue: "MR",
			},
			isBlocked: {
				type: "boolean",
				required: false,
				defaultValue: false,
			},
			canViewFreeScheme: {
				type: "boolean",
				required: false,
				defaultValue: true,
			},
			canViewStock: {
				type: "boolean",
				required: false,
				defaultValue: true,
			},
			canViewSales: {
				type: "boolean",
				required: false,
				defaultValue: true,
			},
			canViewPartyWise: {
				type: "boolean",
				required: false,
				defaultValue: true,
			},
			canViewProductWise: {
				type: "boolean",
				required: false,
				defaultValue: true,
			},
		},
	},
	plugins: [
		emailOTP({
			disableSignUp: true,
			async sendVerificationOTP({ email, otp, type }, request) {
				const user = await db.query.user.findFirst({
					where: eq(schema.user.email, email.toLowerCase()),
				});

				if (!user) {
					throw new APIError("BAD_REQUEST", {
						message: "No MR account found with this email.",
					});
				}

				const transporter = (await import("nodemailer")).createTransport({
					service: "gmail",
					auth: {
						user: env.GMAIL_USER,
						pass: env.GMAIL_PASS,
					},
				});

				const htmlTemplate = `
					<!DOCTYPE html>
					<html>
					<head>
						<meta charset="utf-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>Your OTP Code</title>
					</head>
					<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6;">
						<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f7f6; padding: 40px 0;">
							<tr>
								<td align="center">
									<table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
										<!-- Header -->
										<tr>
											<td align="center" style="background-color: #1a1a1a; padding: 30px 20px;">
												<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">PHARMAQL</h1>
											</td>
										</tr>
										<!-- Body -->
										<tr>
											<td style="padding: 40px 40px;">
												<h2 style="color: #333333; margin-top: 0; margin-bottom: 20px; font-size: 22px;">Hello, ${user.name}</h2>
												<p style="color: #555555; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
													We received a request to log in to your Medical Representative account. Here is your One-Time Password (OTP):
												</p>
												
												<div style="text-align: center; margin: 30px 0;">
													<div style="display: inline-block; background-color: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; padding: 16px 32px;">
														<span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">${otp}</span>
													</div>
												</div>
												
												<p style="color: #555555; font-size: 14px; line-height: 1.5; margin-top: 30px;">
													This code will expire shortly. If you did not request this login, you can safely ignore this email.
												</p>
											</td>
										</tr>
										<!-- Footer -->
										<tr>
											<td align="center" style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #eeeeee;">
												<p style="color: #888888; font-size: 12px; margin: 0;">
													&copy; ${new Date().getFullYear()} PharmaQL. All rights reserved.
												</p>
											</td>
										</tr>
									</table>
								</td>
							</tr>
						</table>
					</body>
					</html>
				`;

				await transporter.sendMail({
					from: env.GMAIL_USER,
					to: email,
					subject: "Your OTP Code - PharmaQL",
					html: htmlTemplate,
				});
			},
		}),
	],
});
