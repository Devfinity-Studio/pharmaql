import { eq } from "drizzle-orm";
import { auth } from "./src/server/auth.js";
import { db } from "./src/server/db/index.js";
import {
	mrInventory,
	mrManufacturers,
	products,
	sales,
	user,
} from "./src/server/db/schema.js";

async function main() {
	console.log("Seeding all data with MR specific sales and inventory...");

	// 1. Create Admin
	const adminEmail = "admin@admin.com";
	console.log("Checking Admin...");
	const existingAdmin = await db
		.select()
		.from(user)
		.where(eq(user.email, adminEmail));
	if (existingAdmin.length === 0) {
		console.log("Creating Admin...");
		await auth.api.signUpEmail({
			body: {
				email: adminEmail,
				password: "Admin123",
				name: "Super Admin",
				role: "ADMIN",
			},
			asResponse: false,
		});
		console.log("Created Admin.");
	} else {
		console.log("Admin already exists.");
	}

	// 2. Create Default MR
	const mrEmail = "mr@mr.com";
	console.log("Checking Default MR...");
	const existingDefaultMr = await db
		.select()
		.from(user)
		.where(eq(user.email, mrEmail));
	if (existingDefaultMr.length === 0) {
		console.log("Creating Default MR...");
		await auth.api.signUpEmail({
			body: {
				email: mrEmail,
				password: "Password123",
				name: "Demo MR",
				role: "MR",
			},
			asResponse: false,
		});
		console.log("Created Default MR.");
	}

	// 3. Create Fake MRs
	const fakeMRs = [
		{ email: "john@mr.com", name: "John Doe", password: "Password123" },
		{ email: "sarah@mr.com", name: "Sarah Smith", password: "Password123" },
		{ email: "alex@mr.com", name: "Alex Jones", password: "Password123" },
	];

	const mrIds: string[] = [];

	for (const mr of fakeMRs) {
		console.log(`Checking MR: ${mr.name}...`);
		const existing = await db
			.select()
			.from(user)
			.where(eq(user.email, mr.email));
		if (existing.length === 0) {
			console.log(`Creating MR ${mr.name}...`);
			await auth.api.signUpEmail({
				body: {
					email: mr.email,
					password: mr.password,
					name: mr.name,
					role: "MR",
				},
				asResponse: false,
			});
			console.log(`Created MR: ${mr.name}`);
			const newlyCreated = await db
				.select()
				.from(user)
				.where(eq(user.email, mr.email));
			if (newlyCreated.length > 0) mrIds.push(newlyCreated[0]!.id);
		} else {
			mrIds.push(existing[0]!.id);
		}
	}

	// 4. Create Fake Products with Manufacturers
	console.log("Creating products...");
	const fakeProducts = [
		{ name: "Aspirin 500mg", manufacturer: "PharmaCorp Inc." },
		{ name: "Ibuprofen 400mg", manufacturer: "PharmaCorp Inc." },
		{ name: "Amoxicillin 250mg", manufacturer: "MediLife Labs" },
		{ name: "Cetirizine 10mg", manufacturer: "MediLife Labs" },
		{ name: "Omeprazole 20mg", manufacturer: "HealthPlus Biotech" },
		{ name: "Lisinopril 10mg", manufacturer: "HealthPlus Biotech" },
	];

	const pIds: string[] = [];

	for (const p of fakeProducts) {
		const existingP = await db
			.select()
			.from(products)
			.where(eq(products.name, p.name));
		let id;
		if (existingP.length === 0) {
			id = crypto.randomUUID();
			await db.insert(products).values({
				id,
				name: p.name,
				manufacturer: p.manufacturer,
				freeScheme: "N/A",
			});
			console.log(`Created product: ${p.name}`);
		} else {
			id = existingP[0]!.id;
			console.log(`Product ${p.name} exists.`);
		}
		pIds.push(id);
	}

	// 5. Generate MR Inventory and MR Sales
	console.log("Generating fake inventory and sales per MR...");

	for (const mrId of mrIds) {
		for (const productId of pIds) {
			// Add inventory record for this product for this MR
			await db.insert(mrInventory).values({
				id: crypto.randomUUID(),
				mrId,
				productId,
				stock: Math.floor(Math.random() * 500) + 100, // Current random stock
			});

			// Generate 15 fake sales randomly spanning the last year for each product per MR
			for (let s = 0; s < 15; s++) {
				const quantity = Math.floor(Math.random() * 90) + 10;
				const date = new Date();
				date.setMonth(date.getMonth() - Math.floor(Math.random() * 12));
				date.setDate(Math.floor(Math.random() * 28) + 1);

				await db.insert(sales).values({
					id: crypto.randomUUID(),
					mrId,
					productId,
					quantity,
					notes: "Seeded sale",
					createdAt: date,
					updatedAt: date,
				});
			}
		}
	}

	console.log("Done seeding MR-specific data!");
	process.exit(0);
}

main().catch((e) => {
	console.error("Failed:", e);
	process.exit(1);
});
