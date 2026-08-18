import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		DATABASE_URL: z.string().url(),
		GMAIL_USER: z.string().email(),
		GMAIL_PASS: z.string(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},
	client: {},
	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		DATABASE_URL: process.env.DATABASE_URL,
		GMAIL_USER: process.env.GMAIL_USER,
		GMAIL_PASS: process.env.GMAIL_PASS,
		NODE_ENV: process.env.NODE_ENV,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
