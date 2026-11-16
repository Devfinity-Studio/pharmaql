import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Returns a typed Drizzle ORM client connected to Neon PostgreSQL over HTTP.
 * 100% serverless and edge-safe (uses fetch under the hood, sub-10ms cold start).
 * Returns null if no connection string is provided, enabling transparent fallback.
 */
export function getDrizzleDb() {
	const dbUrl = (
		process.env.CONTROL_PLANE_DATABASE_URL ||
		process.env.NEON_DATABASE_URL ||
		process.env.DATABASE_URL
	)?.trim();

	if (!dbUrl) {
		return null;
	}

	const sql = neon(dbUrl);
	return drizzle(sql, { schema });
}

export type DrizzleDb = ReturnType<typeof getDrizzleDb>;
export { schema };

