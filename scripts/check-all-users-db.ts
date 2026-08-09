import { db } from "./src/server/db/index";
import { user } from "./src/server/db/schema";

async function listUsers() {
	const users = await db.query.user.findMany();
	console.log("=== TOTAL USERS IN DB:", users.length, "===");
	for (const u of users) {
		console.log(`Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`);
	}
	process.exit(0);
}

listUsers().catch((e) => {
	console.error(e);
	process.exit(1);
});
