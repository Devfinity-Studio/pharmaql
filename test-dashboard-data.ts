import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "./src/server/db";
import {
	mrManufacturers,
	outstanding,
	products,
	sales,
	user,
} from "./src/server/db/schema";

async function test() {
	const email = "mr@mr.com";
	const u = await db.select().from(user).where(eq(user.email, email)).limit(1);
	if (!u[0]) return console.log("User not found");
	const mrId = u[0].id;

	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));
	console.log("Assigned:", assigned);

	const productConditionList = assigned.map((d) => {
		const conditions = [eq(products.manufacturer, d.manufacturer)];
		if (d.division) conditions.push(eq(products.division, d.division));
		return and(...conditions);
	});

	const accessibleProducts =
		productConditionList.length > 0
			? await db
					.select()
					.from(products)
					.where(or(...productConditionList))
			: [];
	console.log("Accessible Products Count:", accessibleProducts.length);

	const productIds = accessibleProducts.map((p) => p.id);
	console.log("Product IDs:", productIds);

	const salesCondition =
		productIds.length > 0
			? and(inArray(sales.productId, productIds), eq(sales.mrId, mrId))
			: undefined;

	const accessibleSales = salesCondition
		? await db
				.select({
					productId: sales.productId,
					productName: products.name,
					quantity: sales.quantity,
					date: sales.date,
				})
				.from(sales)
				.innerJoin(products, eq(sales.productId, products.id))
				.where(salesCondition)
		: [];
	console.log("Accessible Sales Count:", accessibleSales.length);
	if (accessibleSales.length > 0) {
		console.log("Sample sale:", accessibleSales[0]);
	}

	// also what about invoices table?
}
test();
