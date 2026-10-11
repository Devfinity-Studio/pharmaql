import { eq } from "drizzle-orm";
import { db } from "./src/server/db/index";
import {
	invoices,
	mrInventory,
	outstanding,
	sales,
	user,
} from "./src/server/db/schema.ts";

async function traceUser() {
	const email = "087@gmail.com";
	const u = await db.query.user.findFirst({ where: eq(user.email, email) });
	console.log("--- USER OBJECT ---");
	console.log(u);

	const uSales = await db.query.sales.findMany({
		where: eq(sales.mrId, email),
		limit: 5,
	});
	console.log("--- SAMPLE SALES (Count:", uSales.length, ") ---");
	console.log(uSales);

	const uInv = await db.query.mrInventory.findMany({
		where: eq(mrInventory.mrId, email),
		limit: 5,
	});
	console.log("--- SAMPLE INVENTORY (Count:", uInv.length, ") ---");
	console.log(uInv);

	process.exit(0);
}

traceUser().catch((e) => {
	console.error(e);
	process.exit(1);
});
