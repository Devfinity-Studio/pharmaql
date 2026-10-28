import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		// Core Authentication & Session
		BETTER_AUTH_SECRET: z.string().optional(),

		// Multi-Tenant Control Plane (Neon Postgres + AES Master Key)
		CONTROL_PLANE_DATABASE_URL: z.string().optional(),
		CONTROL_PLANE_ENCRYPTION_KEY: z.string().optional(),
		DEV_PORTAL_DOMAIN: z.string().optional().default("pharmaql.devfinity.net"),

		// Master Platform Developer Credentials
		DEV_EMAIL: z.string().email().optional(),
		DEV_PASSWORD: z.string().optional(),

		// Dedicated Developer SMTP (Zoho / Resend / Custom SMTP)
		DEV_SMTP_USER: z.string().optional(),
		DEV_SMTP_PASS: z.string().optional(),
		DEV_SMTP_HOST: z.string().optional(),
		DEV_SMTP_PORT: z.string().optional(),

		// Optional Mailer (MR OTPs fallback)
		GMAIL_USER: z.string().email().optional(),
		GMAIL_PASS: z.string().optional(),

		// Optional Fallbacks for Local Offline Testing (Used when offline or no Neon tenant configured)
		ADMIN_EMAIL: z.string().email().optional(),
		ADMIN_PASSWORD: z.string().optional(),
		API_SERVER_URL: z.string().optional(),
		API_SECRET_KEY: z.string().optional(),

		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},
	client: {},
	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		CONTROL_PLANE_DATABASE_URL: process.env.CONTROL_PLANE_DATABASE_URL,
		CONTROL_PLANE_ENCRYPTION_KEY: process.env.CONTROL_PLANE_ENCRYPTION_KEY,
		DEV_PORTAL_DOMAIN: process.env.DEV_PORTAL_DOMAIN,
		DEV_EMAIL: process.env.DEV_EMAIL,
		DEV_PASSWORD: process.env.DEV_PASSWORD,
		DEV_SMTP_USER: process.env.DEV_SMTP_USER,
		DEV_SMTP_PASS: process.env.DEV_SMTP_PASS,
		DEV_SMTP_HOST: process.env.DEV_SMTP_HOST,
		DEV_SMTP_PORT: process.env.DEV_SMTP_PORT,
		GMAIL_USER: process.env.GMAIL_USER,
		GMAIL_PASS: process.env.GMAIL_PASS,
		ADMIN_EMAIL: process.env.ADMIN_EMAIL,
		ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
		API_SERVER_URL: process.env.API_SERVER_URL,
		API_SECRET_KEY: process.env.API_SECRET_KEY,
		NODE_ENV: process.env.NODE_ENV,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
