import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function run() {
	console.log("Mapping customers from sales...");
	const q = `
        WITH matched AS (
            SELECT h.cust_id, s.dealer, s.area,
                   ROW_NUMBER() OVER(PARTITION BY h.cust_id ORDER BY h.inv_dt DESC) as rn
            FROM "pg-drizzle_legacy_h_sale" h
            JOIN "pg-drizzle_legacy_l_sale" l ON l.rid = h.id
            JOIN "pg-drizzle_sale" s 
              ON CAST(s.date AS DATE) = CAST(h.inv_dt AS DATE)
             AND CAST(s.product_id AS text) = CAST(l.item_id AS text)
             AND CAST(s.quantity AS text) = CAST(l.qty AS text)
        )
        INSERT INTO "pg-drizzle_legacy_customers" (id, name, city)
        SELECT cust_id, dealer, area
        FROM matched
        WHERE rn = 1
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city;
    `;
	const res = await db.execute(sql.raw(q));
	console.log("Mapping done.", res);
	process.exit(0);
}
run();
