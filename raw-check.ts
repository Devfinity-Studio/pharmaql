import postgres from "postgres";

const DATABASE_URL = "postgresql://neondb_owner:npg_QkbOfx01lrdn@ep-divine-mud-apv9cwln-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

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
