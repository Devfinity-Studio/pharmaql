import { eq, inArray } from "drizzle-orm";
import { db } from "./src/server/db";
import { mrInventory, products, sales } from "./src/server/db/schema";

async function run() {
  const missingProds = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, ["10352", "10349"]));
  console.log("Found specific products:", missingProds.length);

  const salesWithMissing = await db
    .select()
    .from(sales)
    .leftJoin(products, eq(sales.productId, products.id))
    .where(eq(sales.mrId, "mediricalifescience@gmail.com"));

  let nullProducts = 0;
  for (const s of salesWithMissing) {
    if (!s.product) nullProducts++;
  }
  console.log("Sales with NO matching product:", nullProducts);
  process.exit(0);
}
run();
