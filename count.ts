import { db } from './src/server/db/index';
import { mrManufacturers, products, sales, outstanding } from './src/server/db/schema';
import { eq, or, and, count } from 'drizzle-orm';

async function run() {
  const m = await db.select().from(mrManufacturers).where(eq(mrManufacturers.mrId, 'hemang2009uppl@gmail.com'));
  const conditions = m.map(d => {
     const c = [eq(products.manufacturer, d.manufacturer)];
     if (d.division) c.push(eq(products.division, d.division));
     return and(...c);
  });
  
  if (conditions.length === 0) { console.log('0 products'); process.exit(0); }
  
  const pCount = await db.select({ value: count() }).from(products).where(or(...conditions));
  console.log('Product Count:', pCount[0].value);
  
  const sCount = await db.select({ value: count() }).from(sales).where(eq(sales.mrId, 'hemang2009uppl@gmail.com'));
  console.log('Sales Count:', sCount[0].value);
  
  const oCount = await db.select({ value: count() }).from(outstanding).where(eq(outstanding.mrId, 'hemang2009uppl@gmail.com'));
  console.log('Outstanding Count:', oCount[0].value);
  
  process.exit(0);
}
run();
