import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function main() {
    const prodRes = await db.execute(sql`
        SELECT * FROM "pg-drizzle_product" WHERE name ILIKE '%PRO GD POWDER (KESAR PISTA)%';
    `);

    if (prodRes.length > 0) {
        const prodId = prodRes[0].id;
        
        const invRes = await db.execute(sql`
            SELECT date, opening, inward, outward FROM "pg-drizzle_mr_inventory"
            WHERE product_id = ${prodId} AND EXTRACT(MONTH FROM date) = 4
            ORDER BY date
        `);
        console.log("MR Inventory for April:");
        console.dir(invRes, { depth: null });
    }
}
main();
