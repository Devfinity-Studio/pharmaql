import { ilike } from "drizzle-orm";
import { db } from "./src/server/db/index.ts";
import { user } from "./src/server/db/schema.ts";

async function checkDevansh() {
	const dev = await db.query.user.findFirst({
		where: ilike(user.name, "%devansh%"),
	});
	console.log("--- DEVANSH USER OBJECT ---");
	console.log(dev);
	process.exit(0);
}

checkDevansh().catch((e) => {
	console.error(e);
	process.exit(1);
});
