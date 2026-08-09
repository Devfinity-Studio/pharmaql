import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    const total = await db.execute(sql`SELECT count(*) FROM "pg-drizzle_legacy_h_sale"`);
    const mapped = await db.execute(sql`
        SELECT count(DISTINCT h.id)
        FROM "pg-drizzle_legacy_h_sale" h
        JOIN "pg-drizzle_outstanding" o ON h.inv_no = o.inv_no
    `);
    console.log("TOTAL HSALE:", total);
    console.log("MAPPED HSALE:", mapped);
    process.exit(0);
}
run();
