import { db } from "../src/server/db/index";
import { user } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const account = await db.select().from(user).where(eq(user.email, 'hemang2009uppl@gmail.com'));
  console.log("Account:", account);
}
run().then(() => process.exit(0)).catch(console.error);
