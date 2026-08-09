import { db } from "./src/server/db/index";

async function main() {
	await db.execute(`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_view_stocks" (
            "id" varchar(255) PRIMARY KEY,
            "cmp_no" varchar(50),
            "loc_no" varchar(50),
            "t_date" timestamp with time zone,
            "item_id" integer,
            "batch_id" integer,
            "opening" integer,
            "inward" integer,
            "s_ret_inward" integer,
            "outward" integer,
            "sale_qty" integer,
            "sale_f_qty" integer,
            "add_stock_adj" integer,
            "less_stock_adj" integer,
            "qty" integer
        );
    `);

	await db.execute(`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_h_batch" (
            "id" integer PRIMARY KEY,
            "item_id" integer,
            "batch_no" varchar(255),
            "prate" double precision,
            "ptr" double precision,
            "mrp" double precision,
            "cost_rate" double precision
        );
    `);

	console.log("Tables created successfully");
	process.exit(0);
}
main();
