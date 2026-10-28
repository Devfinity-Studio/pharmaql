import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET: z.string().optional(),
		GMAIL_USER: z.string().email().optional(),
		GMAIL_PASS: z.string().optional(),
		ADMIN_EMAIL: z.string().email().optional(),
		ADMIN_PASSWORD: z.string().optional(),
		DEV_EMAIL: z.string().email().optional(),
		DEV_PASSWORD: z.string().optional(),
		API_SERVER_URL: z
			.string()
			.optional()
			.default("https://api.asmeepharma.com"),
		API_SECRET_KEY: z.string().min(16).optional(),
		CONTROL_PLANE_DATABASE_URL: z.string().optional(),
		CONTROL_PLANE_ENCRYPTION_KEY: z.string().optional(),
		DEV_PORTAL_DOMAIN: z.string().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},
	client: {},
	runtimeEnv: {
		API_SERVER_URL: process.env.API_SERVER_URL,
		API_SECRET_KEY: process.env.API_SECRET_KEY,
		CONTROL_PLANE_DATABASE_URL: process.env.CONTROL_PLANE_DATABASE_URL,
		CONTROL_PLANE_ENCRYPTION_KEY: process.env.CONTROL_PLANE_ENCRYPTION_KEY,
		DEV_PORTAL_DOMAIN: process.env.DEV_PORTAL_DOMAIN,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		GMAIL_USER: process.env.GMAIL_USER,
		GMAIL_PASS: process.env.GMAIL_PASS,
		ADMIN_EMAIL: process.env.ADMIN_EMAIL,
		ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
		DEV_EMAIL: process.env.DEV_EMAIL,
		DEV_PASSWORD: process.env.DEV_PASSWORD,
		NODE_ENV: process.env.NODE_ENV,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
