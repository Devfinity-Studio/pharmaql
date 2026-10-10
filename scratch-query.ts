import postgres from 'postgres';

async function run() {
    const sql = postgres('postgresql://neondb_owner:npg_0moVxqFMbDZ4@ep-long-feather-aps13uar-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require');
	try {
        await sql`
            CREATE TABLE IF NOT EXISTS "pg-drizzle_notice" (
                "id" text PRIMARY KEY,
                "content" text NOT NULL,
                "is_active" boolean DEFAULT true NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `;
        console.log("Table created successfully");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
