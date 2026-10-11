import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function run() {
	try {
		const res = await db.execute(
			sql`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'pg-drizzle_legacy_%'`,
		);
		console.log(
			"Legacy tables:",
			res.map((r: any) => r.table_name),
		);
	} catch (e) {
		console.error(e);
	}
	process.exit(0);
}
run();
