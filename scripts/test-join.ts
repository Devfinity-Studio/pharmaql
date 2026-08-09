import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    const data = await db.execute(sql`
        SELECT h.inv_no, o.doctor, o.city
        FROM "pg-drizzle_legacy_h_sale" h
        JOIN "pg-drizzle_outstanding" o ON h.inv_no = o.inv_no
        LIMIT 5
    `);
    console.log("JOIN OUTSTANDING:", data);
    process.exit(0);
}
run();
