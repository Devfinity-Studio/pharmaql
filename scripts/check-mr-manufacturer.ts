import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function main() {
	const res = await db.execute(
		sql`SELECT * FROM "pg-drizzle_mr_manufacturer" LIMIT 5;`,
	);
	console.dir(res, { depth: null });
}
main();
