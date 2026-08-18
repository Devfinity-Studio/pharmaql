import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";

async function main() {
	const res = await db.execute(sql`
        SELECT *
        FROM pg_class
    `);

	const tables = await db.execute(
		sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
	);
	for (const { table_name } of tables) {
		try {
			const data = await db.execute(
				sql.raw(`SELECT * FROM "${table_name}" LIMIT 5`),
			);
			console.log("TABLE", table_name, data.rows);
		} catch (e) {}
	}
	process.exit(0);
}
main();
