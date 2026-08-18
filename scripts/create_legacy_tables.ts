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

	await db.execute(`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_h_sale" (
            "id" varchar(255) PRIMARY KEY,
            "cmp_no" varchar(50),
            "loc_no" varchar(50),
            "inv_dt" timestamp with time zone,
            "inv_no" varchar(255),
            "cust_id" varchar(255),
            "inv_type" varchar(50)
        );
    `);

	await db.execute(`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_l_sale" (
            "id" varchar(255) PRIMARY KEY,
            "rid" varchar(255),
            "item_id" integer,
            "batch_no" varchar(255),
            "exp_dt" varchar(255),
            "mrp" double precision,
            "rate" double precision,
            "qty" integer,
            "f_qty" integer,
            "taxable_amt" double precision,
            "vat_amt" double precision,
            "line_amt" double precision
        );
    `);

	await db.execute(`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_m_ledger" (
            "id" integer PRIMARY KEY,
            "name" text
        );
    `);

	console.log("Tables created successfully");
	process.exit(0);
}
main();
