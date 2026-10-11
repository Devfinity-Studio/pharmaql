import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./src/env.js";

async function main() {
	const conn = postgres(process.env.DATABASE_URL!);
	const db = drizzle(conn);

	try {
		const fromDate = new Date();
		await db.execute(sql`SELECT ${fromDate} as test`);
		console.log("Date parameter works!");
	} catch (err: any) {
		console.error("Error executing query:");
		console.error(err.stack || err);
	} finally {
		await conn.end();
	}
}

main();
