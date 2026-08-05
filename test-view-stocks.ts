import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { env } from "./src/env.js";

async function main() {
  const conn = postgres(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  try {
    const res = await db.execute(sql`SELECT * FROM "pg-drizzle_legacy_view_stocks" LIMIT 5;`);
    console.log("legacy_view_stocks samples:", res);

    const res2 = await db.execute(sql`SELECT COUNT(*) as count FROM "pg-drizzle_legacy_view_stocks";`);
    console.log("Total rows:", res2[0].count);
    
    // Test the actual query for one product
    const query = sql`
			SELECT 
				SUM(opening) as opening,
				SUM(inward) as purchase,
				SUM(s_ret_inward) as sales_return,
				SUM(add_stock_adj) as add_stock_adj,
				SUM(sale_qty + sale_f_qty) as sales_qty,
				SUM(outward) as outward,
				SUM(less_stock_adj) as less_stock_adj,
				SUM(curr_qty) as curr_qty
			FROM (
				SELECT SUM(v.qty) as opening, 0 as inward, 0 as s_ret_inward, 0 as add_stock_adj, 0 as sale_qty, 0 as sale_f_qty, 0 as outward, 0 as less_stock_adj, 0 as curr_qty,
				v.batch_id
				FROM "pg-drizzle_legacy_view_stocks" v
				WHERE v.t_date < '1970-01-01T00:00:00.000Z'
				GROUP BY v.batch_id
				
				UNION ALL
				
				SELECT 0 as opening, SUM(v.inward) as inward, SUM(v.s_ret_inward) as s_ret_inward, SUM(v.add_stock_adj) as add_stock_adj, SUM(v.sale_qty) as sale_qty, SUM(v.sale_f_qty) as sale_f_qty, SUM(v.outward) as outward, SUM(v.less_stock_adj) as less_stock_adj, SUM(v.qty) as curr_qty,
				v.batch_id
				FROM "pg-drizzle_legacy_view_stocks" v
				WHERE v.t_date >= '1970-01-01T00:00:00.000Z' AND v.t_date <= '9999-12-31T23:59:59.999Z'
				GROUP BY v.batch_id
			) as a
    `;
    const res3 = await db.execute(query);
    console.log("Query result without loc_no:", res3);
    
  } catch (err: any) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
