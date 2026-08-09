import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_customers" (
            id text PRIMARY KEY,
            name text NOT NULL,
            city text
        );
    `);
    console.log("Table created.");
    process.exit(0);
}
run();
