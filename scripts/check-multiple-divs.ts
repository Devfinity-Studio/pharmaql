import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function main() {
	const mrWithDivs = await db.execute(sql`
        SELECT * FROM "pg-drizzle_mr_manufacturer"
        WHERE mr_id = 'info@avrivaskintech.in'
    `);
	console.dir(mrWithDivs, { depth: null });
}
main();
