import { db } from "./src/server/db";
import { sql } from "drizzle-orm";

async function addColumn() {
  try {
    await db.execute(
      sql`ALTER TABLE "pg-drizzle_product" ADD COLUMN "ingredients" text;`,
    );
    console.log("Column 'ingredients' added successfully.");
  } catch (error) {
    console.error("Error adding column:", error);
  }
  process.exit(0);
}

addColumn();
