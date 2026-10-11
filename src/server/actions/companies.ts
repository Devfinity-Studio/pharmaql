"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

const DATA_FILE = path.join(process.cwd(), "data", "companies_status.json");

async function getOverrides(): Promise<Record<string, boolean>> {
	try {
		const raw = await fs.readFile(DATA_FILE, "utf-8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function saveOverrides(overrides: Record<string, boolean>) {
	await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
	await fs.writeFile(DATA_FILE, JSON.stringify(overrides, null, 2), "utf-8");
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
