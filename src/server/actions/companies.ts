"use server";

import { revalidatePath } from "next/cache";
import { readServerJson, writeServerJson } from "@/lib/server-storage";

async function getOverrides(): Promise<Record<string, boolean>> {
	const data = await readServerJson<Record<string, boolean>>("companies_status.json", {});
	return data && typeof data === "object" ? data : {};
}

async function saveOverrides(overrides: Record<string, boolean>) {
	await writeServerJson("companies_status.json", overrides);
}

export async function getCompanyOverrides(): Promise<Record<string, boolean>> {
	return await getOverrides();
}

export async function toggleCompanyStatus(name: string, isActive: boolean) {
	const overrides = await getOverrides();
	overrides[name] = isActive;
	await saveOverrides(overrides);

	revalidatePath("/admin/companies");
	revalidatePath("/products");
	revalidatePath("/dashboard");
}
