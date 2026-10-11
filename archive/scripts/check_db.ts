import { count, eq, like } from "drizzle-orm";
import { db } from "./src/server/db";
import { mrManufacturers, products } from "./src/server/db/schema";

async function main() {
	const mrM = await db
		.select()
		.from(mrManufacturers)
		.where(like(mrManufacturers.manufacturer, "%AAGAM%"))
		.limit(5);
	console.log("MR Mfgs:", mrM);

	const prodM = await db
		.select()
		.from(products)
		.where(like(products.manufacturer, "%AAGAM%"))
		.limit(5);
	console.log("Prod Mfgs:", prodM);

	process.exit(0);
}
main();
