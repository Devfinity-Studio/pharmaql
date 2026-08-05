import { db } from "./src/server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Creating legacy_h_batch table...");
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_h_batch" (
            "id" text PRIMARY KEY NOT NULL,
            "item_id" text,
            "batch_no" text,
            "prate" numeric,
            "ptr" numeric,
            "mrp" numeric,
            "cost_rate" numeric
        );
    `);
    
    console.log("Creating legacy_view_stocks table...");
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_view_stocks" (
            "id" text PRIMARY KEY NOT NULL,
            "cmp_no" text,
            "loc_no" text,
            "t_date" timestamp,
            "item_id" text,
            "batch_id" text,
            "opening" integer DEFAULT 0,
            "inward" integer DEFAULT 0,
            "s_ret_inward" integer DEFAULT 0,
            "add_stock_adj" integer DEFAULT 0,
            "outward" integer DEFAULT 0,
            "sale_qty" integer DEFAULT 0,
            "sale_f_qty" integer DEFAULT 0,
            "less_stock_adj" integer DEFAULT 0,
            "qty" integer DEFAULT 0
        );
    `);

    console.log("Creating indexes...");
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "legacy_hb_id_idx" ON "pg-drizzle_legacy_h_batch" USING btree ("id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "legacy_hb_item_idx" ON "pg-drizzle_legacy_h_batch" USING btree ("item_id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "legacy_vs_item_idx" ON "pg-drizzle_legacy_view_stocks" USING btree ("item_id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "legacy_vs_loc_idx" ON "pg-drizzle_legacy_view_stocks" USING btree ("loc_no");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "legacy_vs_date_idx" ON "pg-drizzle_legacy_view_stocks" USING btree ("t_date");`);

    console.log("Legacy tables created successfully.");
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
