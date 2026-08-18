import { sql } from "drizzle-orm";
import { db } from "./src/server/db/index";
import { outstanding, sales } from "./src/server/db/schema";

async function main() {
	const s = await db.select().from(sales).limit(5);
	console.log(
		"SALES:",
		s.map((r) => ({ dealer: r.dealer, area: r.area })),
	);

	const o = await db.select().from(outstanding).limit(5);
	console.log(
		"OUTSTANDING:",
		o.map((r) => ({ doctor: r.doctor, city: r.city })),
	);
	process.exit(0);
}
main();
