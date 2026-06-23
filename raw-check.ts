import postgres from "postgres";
import { env } from "./src/env.js";

const DATABASE_URL = env.DATABASE_URL;

async function main() {
  const sql = postgres(DATABASE_URL);
  try {
    const users = await sql`SELECT * FROM "user"`;
    console.log("Users in table 'user':", users.length);
    if (users.length > 0) {
      console.log(users.map((u: any) => ({ email: u.email, id: u.id })));
    }
  } catch (e: any) {
    console.error("Error querying 'user':", e.message);
  }

  try {
    const pusers = await sql`SELECT * FROM "pg-drizzle_user"`;
    console.log("Users in table 'pg-drizzle_user':", pusers.length);
  } catch (e: any) {
    console.error("Error querying 'pg-drizzle_user':", e.message);
  }

  process.exit(0);
}

main();
