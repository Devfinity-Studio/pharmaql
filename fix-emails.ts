import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function fixEmails() {
  try {
    await db.execute(sql`
      UPDATE "user"
      SET email = REPLACE(email, '@demo.com', '')
      WHERE email LIKE '%@%@demo.com';
    `);
    console.log("Fixed emails successfully.");
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

fixEmails();
