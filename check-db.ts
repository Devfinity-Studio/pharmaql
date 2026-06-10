import { db } from "./src/server/db";
import { user, session } from "./src/server/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const users = await db.select().from(user);
    console.log("Users in `user` table:", users.length);
    if (users.length > 0) console.log(users);

    const sessions = await db.select().from(session);
    console.log("Sessions in `session` table:", sessions.length);
    if (sessions.length > 0) console.log(sessions);
  } catch (e: any) {
    console.error(e);
  }
  process.exit(0);
}

main();
