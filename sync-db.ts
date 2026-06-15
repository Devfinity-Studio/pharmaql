import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function syncDb() {
	console.log("Syncing database schema...");

	try {
		await db.execute(sql`
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "loc_no" text;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "rank" text;
      
      ALTER TABLE "pg-drizzle_product" ADD COLUMN IF NOT EXISTS "firm_no" text;
      ALTER TABLE "pg-drizzle_product" ADD COLUMN IF NOT EXISTS "code" text;
      ALTER TABLE "pg-drizzle_product" ADD COLUMN IF NOT EXISTS "division" text;
      
      ALTER TABLE "pg-drizzle_sale" ADD COLUMN IF NOT EXISTS "date" timestamp;
      ALTER TABLE "pg-drizzle_sale" ADD COLUMN IF NOT EXISTS "dealer" text;
      ALTER TABLE "pg-drizzle_sale" ADD COLUMN IF NOT EXISTS "area" text;
      ALTER TABLE "pg-drizzle_sale" ADD COLUMN IF NOT EXISTS "free_qty" integer;
      ALTER TABLE "pg-drizzle_sale" ADD COLUMN IF NOT EXISTS "amount" numeric;
      
      ALTER TABLE "pg-drizzle_mr_manufacturer" ADD COLUMN IF NOT EXISTS "firm_no" text;
      ALTER TABLE "pg-drizzle_mr_manufacturer" ADD COLUMN IF NOT EXISTS "division" text;
      ALTER TABLE "pg-drizzle_mr_manufacturer" ADD COLUMN IF NOT EXISTS "company" text;
      
      ALTER TABLE "pg-drizzle_mr_inventory" ADD COLUMN IF NOT EXISTS "date" timestamp;
      ALTER TABLE "pg-drizzle_mr_inventory" ADD COLUMN IF NOT EXISTS "opening" integer;
      ALTER TABLE "pg-drizzle_mr_inventory" ADD COLUMN IF NOT EXISTS "inward" integer;
      ALTER TABLE "pg-drizzle_mr_inventory" ADD COLUMN IF NOT EXISTS "outward" integer;
      ALTER TABLE "pg-drizzle_mr_inventory" ADD COLUMN IF NOT EXISTS "ptr" numeric;
      ALTER TABLE "pg-drizzle_mr_inventory" ADD COLUMN IF NOT EXISTS "mrp" numeric;

      CREATE TABLE IF NOT EXISTS "pg-drizzle_invoice" (
        "id" text PRIMARY KEY NOT NULL,
        "mr_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "date" timestamp,
        "inw_dt" timestamp,
        "inv_no" text,
        "inv_amt" numeric,
        "inv_type" text,
        "manufacturer_code" text,
        "created_at" timestamp NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "pg-drizzle_outstanding" (
        "id" text PRIMARY KEY NOT NULL,
        "mr_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "doctor" text,
        "city" text,
        "inv_no" text,
        "inv_dt" timestamp,
        "inv_amt" numeric,
        "manufacturer_code" text,
        "division" text,
        "created_at" timestamp NOT NULL
      );
    `);
		console.log("Database schema synced successfully.");
	} catch (err) {
		console.error("Error syncing db:", err);
	}
	process.exit(0);
}

syncDb();
