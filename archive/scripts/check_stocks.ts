import { db } from "./src/server/db/index";

async function main() {
	const res = await db.execute(
		"SELECT column_name FROM information_schema.columns WHERE table_name = 'pg-drizzle_legacy_view_stocks'",
	);
	console.log(res);
	process.exit(0);
}
main();
