import postgres from "postgres";
import { env } from "./src/env.js";

async function main() {
  const sql = postgres(env.DATABASE_URL);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "pg-drizzle_sale" (
        "id" text PRIMARY KEY,
        "product_id" text NOT NULL REFERENCES "pg-drizzle_product"("id") ON DELETE CASCADE,
        "mr_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "quantity" integer NOT NULL,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        "updated_at" timestamp NOT NULL DEFAULT NOW()
      );
    `;
    console.log("Created pg-drizzle_sale table");
  } catch (e: any) {
    console.log("Error creating sale:", e.message);
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "pg-drizzle_mr_inventory" (
        "id" text PRIMARY KEY,
        "mr_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "product_id" text NOT NULL REFERENCES "pg-drizzle_product"("id") ON DELETE CASCADE,
        "stock" integer NOT NULL DEFAULT 0,
        "updated_at" timestamp NOT NULL DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "mr_inv_mr_id_idx" ON "pg-drizzle_mr_inventory" ("mr_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "mr_inv_product_id_idx" ON "pg-drizzle_mr_inventory" ("product_id");`;
    console.log("Created pg-drizzle_mr_inventory table");
  } catch (e: any) {
    console.log("Error creating mr_inventory:", e.message);
  }

  process.exit(0);
}

main();
