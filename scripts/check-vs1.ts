import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function main() {
	const res = await db.execute(sql`
        SELECT * FROM "pg-drizzle_legacy_view_stocks" WHERE id = '1';
    `);
	console.log(res);
}
main();
