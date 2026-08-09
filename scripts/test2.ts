import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function main() {
	const limitFromDate = new Date("2026-04-01T00:00:00.000Z");
	const limitToDate = new Date("2026-04-30T23:59:59.999Z");

	const res = await db.execute(sql`
			SELECT 
				v.item_id,
				SUM(CASE WHEN v.t_date >= ${limitFromDate.toISOString()} THEN v.inward ELSE 0 END) as inward,
				SUM(CASE WHEN v.t_date >= ${limitFromDate.toISOString()} THEN v.sale_qty + v.sale_f_qty ELSE 0 END) as sale_qty,
				MAX(h.prate) as prate
			FROM "pg-drizzle_legacy_view_stocks" v
			LEFT JOIN "pg-drizzle_legacy_h_batch" h ON h.id = v.batch_id AND h.item_id = v.item_id
			WHERE v.item_id IN (12875, 14564) AND v.loc_no = '11' AND v.t_date <= ${limitToDate.toISOString()}
			GROUP BY v.item_id
		`);
	console.log("My Query:", res);

	const res2 = await db.execute(sql`
			SELECT a.ItemId, 
				sum(a.OpeningQty) as Opening, 
				sum(a.Purchase) as Purchase, 
				sum(a.SalesQty) as SalesQty,
				Max(ifnull(a.Prate,0)) as Prate
			From
				(select v.item_id as ItemId, Sum(v.qty) as OpeningQty, 0 as Purchase, 0 as SalesQty, Max(h.prate) as Prate
				from "pg-drizzle_legacy_view_stocks" as v
				inner join "pg-drizzle_legacy_h_batch" as h on h.id=v.batch_id and h.item_id=v.item_id
				Where
					v.loc_no='11' and v.t_date < ${limitFromDate.toISOString()} and v.item_id IN (12875, 14564) and v.qty <> 0
				group by v.item_id, h.batch_id
			
				union all
				
				select v.item_id as ItemId, 0 as OpeningQty, sum(v.inward) as Purchase, sum(v.sale_qty + v.sale_f_qty) as SalesQty, Max(h.prate) as Prate
				from "pg-drizzle_legacy_view_stocks" as v
				inner join "pg-drizzle_legacy_h_batch" as h on h.id=v.batch_id and h.item_id=v.item_id
				Where
					v.loc_no='11' and v.t_date >= ${limitFromDate.toISOString()} and v.t_date <= ${limitToDate.toISOString()} and v.item_id IN (12875, 14564) and v.qty <> 0
				group by v.item_id, h.batch_id
				) as a
			Group by a.ItemId
	`);
	console.log("FoxPro Query:", res2);

	process.exit(0);
}
main();
