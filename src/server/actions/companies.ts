"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { companies } from "@/server/db/schema";

export async function toggleCompanyStatus(name: string, isActive: boolean) {
	const existing = await db
		.select()
		.from(companies)
		.where(eq(companies.name, name));

	if (existing.length > 0) {
		await db
			.update(companies)
			.set({ isActive, updatedAt: new Date() })
			.where(eq(companies.name, name));
	} else {
		await db.insert(companies).values({
			name,
			isActive,
		});
	}

	revalidatePath("/admin/companies");
	revalidatePath("/products");
	revalidatePath("/dashboard");
}
