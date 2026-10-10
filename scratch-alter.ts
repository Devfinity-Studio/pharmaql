import postgres from 'postgres';

async function run() {
    const sql = postgres('postgresql://neondb_owner:npg_0moVxqFMbDZ4@ep-long-feather-aps13uar-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require');
	try {
        await sql`ALTER TABLE "pg-drizzle_notice" ADD COLUMN IF NOT EXISTS "title" text DEFAULT 'Notice' NOT NULL;`;
        await sql`ALTER TABLE "pg-drizzle_notice" ADD COLUMN IF NOT EXISTS "variant" text DEFAULT 'info' NOT NULL;`;
        console.log("Table altered successfully");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
