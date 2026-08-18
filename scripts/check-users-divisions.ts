import { eq } from "drizzle-orm";
import { db } from "./src/server/db/index";
import { user } from "./src/server/db/schema";

async function main() {
	const res = await db.select().from(user);
	console.log(res);
}
main();
