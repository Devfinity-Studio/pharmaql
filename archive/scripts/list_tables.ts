import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function main() {
	const res = await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
    `);
	console.log(
		"Tables in DB:",
		res.map((r) => r.table_name),
	);
	process.exit(0);
}
main();
