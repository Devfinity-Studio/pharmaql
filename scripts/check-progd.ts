import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function main() {
	const prodRes = await db.execute(sql`
        SELECT * FROM "pg-drizzle_product" WHERE name ILIKE '%PRO GD POWDER (KESAR PISTA)%';
    `);
	console.log("Product:", prodRes);

	if (prodRes.length > 0) {
		const prodId = prodRes[0].id;

		const invRes = await db.execute(sql`
            SELECT * FROM "pg-drizzle_mr_inventory"
            WHERE product_id = ${prodId}
            ORDER BY date
        `);
		console.log("MR Inventory for product:", invRes);

		const vsRes = await db.execute(sql`
            SELECT * FROM "pg-drizzle_legacy_view_stocks"
            WHERE item_id = ${prodId}
            ORDER BY t_date
        `);
		console.log("Legacy view stocks for product:", vsRes);
	}
}
main();
