import { db } from "./src/server/db/index";

async function main() {
	await db.execute('DROP TABLE "pg-drizzle_legacy_view_stocks" CASCADE');
	await db.execute('DROP TABLE "pg-drizzle_legacy_h_batch" CASCADE');
	console.log("Dropped tables");
	process.exit(0);
}
main();
