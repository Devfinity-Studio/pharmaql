import postgres from 'postgres';

async function run() {
    const sql = postgres('postgresql://neondb_owner:npg_0moVxqFMbDZ4@ep-long-feather-aps13uar-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require');
	try {
        await sql`ALTER TABLE "pg-drizzle_notice" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;`;
        console.log("Table altered successfully (added expires_at)");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
