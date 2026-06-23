import { eq } from "drizzle-orm";
import { db } from "./src/server/db";
import { sales, user } from "./src/server/db/schema";

async function run() {
  const allSales = await db
    .select({ mrId: sales.mrId, count: sales.id })
    .from(sales);
  console.log(`Total Sales records: ${allSales.length}`);

  if (allSales.length > 0) {
    const mrMap = new Map<string, number>();
    for (const s of allSales) {
      mrMap.set(s.mrId, (mrMap.get(s.mrId) || 0) + 1);
    }
    console.log("Sales distribution by MR ID:");
    for (const [mrId, count] of mrMap.entries()) {
      console.log(`- ${mrId}: ${count} sales`);
    }

    // Check if the MRs in sales exist in the user table
    const allUsers = await db.select({ id: user.id }).from(user);
    const userIds = new Set(allUsers.map((u) => u.id));

    let missingUsers = 0;
    for (const mrId of mrMap.keys()) {
      if (!userIds.has(mrId)) {
        console.log(
          `WARNING: MR ID '${mrId}' exists in sales but NOT in user table!`,
        );
        missingUsers++;
      }
    }
    if (missingUsers === 0)
      console.log("All mrIds in sales exist in user table.");
  }

  process.exit(0);
}
run();
