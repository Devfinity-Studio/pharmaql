import postgres from "postgres";
import { env } from "./src/env.js";

async function main() {
  const sql = postgres(env.DATABASE_URL);
  try {
    await sql`DROP TABLE IF EXISTS "pg-drizzle_order" CASCADE;`;
    console.log("Dropped orders table");
  } catch (e: any) {
    console.log("Error dropping orders:", e.message);
  }

  try {
    await sql`ALTER TABLE "pg-drizzle_sale" DROP COLUMN IF EXISTS "mr_id" CASCADE;`;
    console.log("Dropped mrId from sales");
  } catch (e: any) {
    console.log("Error dropping mrId from sales:", e.message);
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "pg-drizzle_mr_manufacturer" (
        "id" text PRIMARY KEY,
        "mr_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "manufacturer" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "mr_mfg_mr_id_idx" ON "pg-drizzle_mr_manufacturer" ("mr_id");`;
    console.log("Created mr_manufacturer table");
  } catch (e: any) {
    console.log("Error creating mr_manufacturer:", e.message);
  }

  process.exit(0);
}

main();
