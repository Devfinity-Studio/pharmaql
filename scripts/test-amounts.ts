import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    const s = await db.execute(sql`SELECT product_id, date, dealer, amount FROM "pg-drizzle_sale" LIMIT 5`);
    const l = await db.execute(sql`SELECT item_id, line_amt FROM "pg-drizzle_legacy_l_sale" LIMIT 5`);
    console.log("SALES:", s);
    console.log("LSALE:", l);
    process.exit(0);
}
run();
