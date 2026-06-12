import postgres from "postgres";
import { env } from "./src/env.js";

async function main() {
  const sql = postgres(env.DATABASE_URL);

  try {
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_blocked" boolean NOT NULL DEFAULT false;`;
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "can_view_free_scheme" boolean NOT NULL DEFAULT true;`;
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "can_view_stock" boolean NOT NULL DEFAULT true;`;
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "can_view_sales" boolean NOT NULL DEFAULT true;`;
    console.log("Added new columns to user table");
  } catch (e: any) {
    console.log("Error altering user:", e.message);
  }

  process.exit(0);
}

main();
