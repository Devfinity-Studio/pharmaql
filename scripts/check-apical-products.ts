import { eq } from "drizzle-orm";
import { db } from "./src/server/db";
import { products } from "./src/server/db/schema";

async function run() {
	const prods = await db
		.select()
		.from(products)
		.where(eq(products.manufacturer, "APICAL"));

	const divisions = new Set();
	for (const p of prods) {
		divisions.add(p.division);
	}
	console.log(
		`Found ${prods.length} APICAL products across divisions:`,
		Array.from(divisions),
	);
}

run()
	.catch(console.error)
	.then(() => process.exit(0));
