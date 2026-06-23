import { eq } from "drizzle-orm";
import { db } from "./src/server/db";
import { products } from "./src/server/db/schema";

async function check() {
  const p = await db.select().from(products).where(eq(products.id, "10346"));
  console.log("Product 10346:", p);
  const count = await db.select({ id: products.id }).from(products);
  console.log("Total Products:", count.length);
  process.exit(0);
}
check();
