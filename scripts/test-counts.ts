import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function run() {
	const data = await db.execute(sql`
        SELECT COUNT(*) FROM "pg-drizzle_legacy_h_sale"
    `);
	console.log("HSALE COUNT:", data);

	// Check if specialclaimdata exists in postgres? I didn't import it!
	// But I CAN import it, or I can just import `account` if I can find it.
	process.exit(0);
}
run();
