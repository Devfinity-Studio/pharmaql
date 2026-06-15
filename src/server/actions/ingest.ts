"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
	mrInventory,
	mrManufacturers,
	products,
	sales,
	user,
} from "@/server/db/schema";

export async function ingestCSV(formData: FormData) {
	// 1. Verify Admin Role
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		return { success: false, error: "Unauthorized. Admin access required." };
	}

	// 2. Extract Data
	const file = formData.get("file") as File;

	if (!file) {
		return { success: false, error: "No file provided" };
	}

	try {
		const text = await file.text();
		const rows = text
			.split("\n")
			.map((r) => r.trim())
			.filter(Boolean);

		// Assume columns: Manufacturer, Product Name, Stock, MR Email
		// Skip header row
		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;
			const columns = row.split(",");
			if (columns.length < 4) continue; // Need 4 columns now

			const manufacturer = columns[0]?.trim() || "Unknown";
			const productName = columns[1]?.trim() || "";
			const stockStr = columns[2]?.trim() || "0";
			const mrEmail = columns[3]?.trim() || "";

			const newStock = parseInt(stockStr, 10) || 0;

			if (!productName || !mrEmail) continue;

			// Find MR
			const mrResults = await db
				.select()
				.from(user)
				.where(eq(user.email, mrEmail))
				.limit(1);
			const mr = mrResults[0];
			if (!mr) {
				console.log(`Skipping row ${i}: MR not found with email ${mrEmail}`);
				continue;
			}

			// Ensure MR is assigned to this manufacturer
			const existingAssignment = await db
				.select()
				.from(mrManufacturers)
				.where(
					and(
						eq(mrManufacturers.mrId, mr.id),
						eq(mrManufacturers.manufacturer, manufacturer),
					),
				)
				.limit(1);

			if (existingAssignment.length === 0) {
				await db.insert(mrManufacturers).values({
					id: crypto.randomUUID(),
					mrId: mr.id,
					manufacturer,
				});
				console.log(
					`Auto-assigned manufacturer ${manufacturer} to MR ${mr.name}`,
				);
			}

			// Find existing product
			let productId = "";
			const existingProducts = await db
				.select()
				.from(products)
				.where(eq(products.name, productName))
				.limit(1);

			const existingProduct = existingProducts[0];
			if (existingProduct) {
				productId = existingProduct.id;
				// Optionally update manufacturer if changed
			} else {
				productId = crypto.randomUUID();
				await db.insert(products).values({
					id: productId,
					name: productName,
					manufacturer,
					freeScheme: "N/A",
				});
			}

			// Find existing inventory for this MR
			const inventoryResults = await db
				.select()
				.from(mrInventory)
				.where(
					and(
						eq(mrInventory.mrId, mr.id),
						eq(mrInventory.productId, productId),
					),
				)
				.limit(1);

			const currentInventory = inventoryResults[0];

			if (currentInventory) {
				// Calculate Sales based on stock reduction for this MR
				if (newStock < currentInventory.stock) {
					const soldQuantity = currentInventory.stock - newStock;
					await db.insert(sales).values({
						id: crypto.randomUUID(),
						productId,
						mrId: mr.id,
						quantity: soldQuantity,
						notes: "Auto-calculated from MR stock ingestion",
					});
				}

				// Update MR inventory
				await db
					.update(mrInventory)
					.set({ stock: newStock })
					.where(eq(mrInventory.id, currentInventory.id));
			} else {
				// New inventory record for this MR
				await db.insert(mrInventory).values({
					id: crypto.randomUUID(),
					mrId: mr.id,
					productId,
					stock: newStock,
				});
			}
		}

		revalidatePath("/admin/dashboard");
		revalidatePath("/admin/mrs");
		return { success: true, message: "CSV stock data ingested successfully" };
	} catch (error) {
		console.error("Ingestion error:", error);
		return { success: false, error: "Failed to parse and ingest CSV" };
	}
}
