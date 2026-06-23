import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function main() {
  try {
    await db.execute(
      sql`ALTER TABLE "pg-drizzle_product" ADD COLUMN "manufacturer" text DEFAULT 'Unknown' NOT NULL;`,
    );
    console.log("Column added successfully");
  } catch (e: any) {
    if (e.message.includes("already exists")) {
      console.log("Column already exists");
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}

main();
