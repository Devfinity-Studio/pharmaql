import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function main() {
    const prodRes = await db.execute(sql`
        SELECT * FROM "pg-drizzle_product" WHERE name ILIKE '%PRO GD POWDER (KESAR PISTA)%';
    `);

    if (prodRes.length > 0) {
        const prodId = prodRes[0].id;
        
        const vsRes = await db.execute(sql`
            SELECT t_date, entry_type, t_no, inward, qty FROM "pg-drizzle_legacy_view_stocks"
            WHERE item_id = ${prodId} AND EXTRACT(MONTH FROM t_date) = 4
            ORDER BY t_date
        `);
        console.log("Legacy View Stocks for April:");
        console.dir(vsRes, { depth: null });
    }
}
main();
