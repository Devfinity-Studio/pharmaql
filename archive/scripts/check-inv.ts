import { eq } from "drizzle-orm";
import { db } from "./src/server/db/index";
import { mrInventory } from "./src/server/db/schema";

async function main() {
	const invs = await db.select().from(mrInventory).limit(5);
	console.log(invs);
}
main();
