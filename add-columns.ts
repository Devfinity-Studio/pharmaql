import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function main() {
  console.log("Adding can_view_party_wise...");
  try {
    await db.execute(
      sql`ALTER TABLE "user" ADD COLUMN can_view_party_wise boolean NOT NULL DEFAULT true;`,
    );
  } catch (e: any) {
    console.log("Column might already exist:", e.message);
  }

  console.log("Adding can_view_product_wise...");
  try {
    await db.execute(
      sql`ALTER TABLE "user" ADD COLUMN can_view_product_wise boolean NOT NULL DEFAULT true;`,
    );
  } catch (e: any) {
    console.log("Column might already exist:", e.message);
  }

  console.log("Done.");
  process.exit(0);
}

main();
