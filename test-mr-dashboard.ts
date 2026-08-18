import { db } from './src/server/db/index';
import { mrManufacturers, products, sales, outstanding, invoices } from './src/server/db/schema';
import { eq, or, and, count, inArray } from 'drizzle-orm';

async function run() {
  const mrId = 'hemang2009uppl@gmail.com';
  console.log('starting...');
  
  const selectedAssignments = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));
  console.log('assignments:', selectedAssignments.length);

  let invoiceCondition = and(
			inArray(
				invoices.manufacturerCode,
				selectedAssignments.map((d) => d.manufacturer),
			),
			eq(invoices.mrId, mrId),
		);

  const accessibleInvoices = invoiceCondition
			? await db.select().from(invoices).where(invoiceCondition)
			: [];
  console.log('accessibleInvoices:', accessibleInvoices.length);

  const outstandingConditionList = selectedAssignments.map((d) => {
			const conditions = [eq(outstanding.manufacturerCode, d.manufacturer)];
			if (d.division) {
				conditions.push(eq(outstanding.division, d.division));
			}
			return and(...conditions);
		});

  let outstandingCondition = and(
			eq(outstanding.mrId, mrId),
			or(...outstandingConditionList),
		);

  const accessibleOutstanding = outstandingCondition
			? await db.select().from(outstanding).where(outstandingCondition)
			: [];
  console.log('accessibleOutstanding:', accessibleOutstanding.length);

  process.exit(0);
}
run();
