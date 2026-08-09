import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function main() {
    const res = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'pg-drizzle_legacy_view_stocks';
    `);
    console.log(res);
}
main();
