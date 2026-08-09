import { db } from "./src/server/db";
import { user, mrManufacturers } from "./src/server/db/schema";
import { eq, like } from "drizzle-orm";

async function run() {
	const users = await db.select().from(user).where(like(user.name, "%RAJESH%"));
	console.log("Found Users:", users);
	
	if (users.length > 0) {
		for (const u of users) {
			const assignments = await db.select().from(mrManufacturers).where(eq(mrManufacturers.mrId, u.id));
			console.log(`Assignments for ${u.id}:`, assignments);
		}
	}
}

run().catch(console.error).then(() => process.exit(0));
