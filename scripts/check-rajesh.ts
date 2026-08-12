import { eq } from "drizzle-orm";
import { db } from "./src/server/db/index";
import { mrManufacturers } from "./src/server/db/schema";

async function run() {
	try {
		const res = await db
			.select()
			.from(mrManufacturers)
			.where(eq(mrManufacturers.mrId, "rajesh.giri6@gmail.com"));
		console.log("Assignments:", res);
	} catch (e) {
		console.error(e);
	}
	process.exit(0);
}
run();
