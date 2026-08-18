import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function main() {
	const res = await db.execute(sql`
        SELECT COUNT(*) as c1 FROM "pg-drizzle_legacy_view_stocks" WHERE s_ret_inward > 0;
    `);
	console.log("Total with s_ret_inward > 0:", res[0].c1);

	const res2 = await db.execute(sql`
        SELECT COUNT(*) as c2 FROM "pg-drizzle_legacy_view_stocks" WHERE s_ret_inward > 0 AND qty = 0;
    `);
	console.log("Total with s_ret_inward > 0 AND qty = 0:", res2[0].c2);

	const res3 = await db.execute(sql`
        SELECT s_ret_inward, qty, entry_type, t_no FROM "pg-drizzle_legacy_view_stocks" WHERE s_ret_inward > 0 LIMIT 5;
    `);
	console.log(res3);
}
main();
