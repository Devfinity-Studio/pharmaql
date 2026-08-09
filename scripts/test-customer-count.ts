import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    const data = await db.execute(sql`SELECT count(*) FROM "pg-drizzle_legacy_customers"`);
    console.log("CUSTOMERS:", data);
    process.exit(0);
}
run();
