import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function run() {
	try {
		const res = await db.execute(sql`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'pg-drizzle_legacy_customers'
        `);
		console.log("Schema:", res);
	} catch (e) {
		console.error(e);
	}
	process.exit(0);
}
run();
