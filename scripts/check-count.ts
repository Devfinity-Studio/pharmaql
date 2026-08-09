import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    try {
        const res = await db.execute(sql`SELECT count(*) FROM "pg-drizzle_legacy_customers"`);
        console.log("Count:", res);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
