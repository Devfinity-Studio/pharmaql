import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { env } from "@/env";
import { db } from "./db";
import * as schema from "./db/schema";
import { eq } from "drizzle-orm";

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

				await transporter.sendMail({
					from: env.GMAIL_USER,
					to: email,
					subject: "Your OTP Code",
					html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
				});
			},
		}),
	],
});
