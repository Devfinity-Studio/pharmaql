import fs from "fs/promises";
import path from "path";
import type { TenantRecord } from "./control-plane-db";

const DATA_DIR = path.join(process.cwd(), "data");
const TENANTS_FILE = path.join(DATA_DIR, "tenants.json");

const DEFAULT_ASMEE_TENANT: TenantRecord = {
	id: "00000000-0000-0000-0000-000000000001",
	slug: "asmee",
	custom_domain: "portal.asmeepharma.com",
	is_active: true,
	display_name: "Asmee Pharma Pvt. Ltd.",
	short_name: "Asmee",
	logo_url: "/logo.png",
	primary_color: "#0B2545",
	accent_color: "#134074",
	address: "Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002",
	contact_phone: "+91 98765 43210",
	contact_email: "info@asmeepharma.com",
	support_email: "asmeepharma2022@gmail.com",
	user_email_domain: "@asmeepharma.com",
	gstin: "24AAAAA0000A1Z5",
	db_type: "api_server",
	db_connection_encrypted: null,
	api_server_url: process.env.API_SERVER_URL || "https://api.asmeepharma.com",
	api_server_key_encrypted: null,
	legacy_db_name: "pdyasvmaster",
	erp_software_type: "Technomax",
	comp_no: 11,
	loc_no: 11,
	overdue_direct_block_days: 90,
	overdue_division_block_days: 95,
	created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
	updated_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

/**
 * Reads tenants from data/tenants.json.
 * If file does not exist, seeds it with DEFAULT_ASMEE_TENANT and returns it.
 */
export async function getLocalTenants(): Promise<TenantRecord[]> {
	try {
		await fs.mkdir(DATA_DIR, { recursive: true });
		const content = await fs.readFile(TENANTS_FILE, "utf-8");
		const parsed = JSON.parse(content);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return parsed as TenantRecord[];
		}
	} catch (err: any) {
		// File missing or invalid JSON: write default seed
	}

	const initial = [DEFAULT_ASMEE_TENANT];
	try {
		await fs.writeFile(TENANTS_FILE, JSON.stringify(initial, null, 2), "utf-8");
	} catch {
		// ignore write failure in read-only environments
	}
	return initial;
}

/**
 * Saves or updates a tenant in data/tenants.json.
 */
export async function saveLocalTenant(tenant: TenantRecord): Promise<TenantRecord> {
	const current = await getLocalTenants();
	const now = new Date().toISOString();

	const existingIndex = current.findIndex(
		(t) => t.id === tenant.id || t.slug.toLowerCase() === tenant.slug.toLowerCase(),
	);

	let savedTenant: TenantRecord;

	if (existingIndex >= 0) {
		const existing = current[existingIndex]!;
		savedTenant = {
			...existing,
			...tenant,
			id: existing.id,
			slug: tenant.slug.toLowerCase().trim(),
			updated_at: now,
		};
		current[existingIndex] = savedTenant;
	} else {
		savedTenant = {
			...tenant,
			id: tenant.id || crypto.randomUUID(),
			slug: tenant.slug.toLowerCase().trim(),
			created_at: now,
			updated_at: now,
		};
		current.unshift(savedTenant);
	}

	await fs.writeFile(TENANTS_FILE, JSON.stringify(current, null, 2), "utf-8");
	return savedTenant;
}

/**
 * Toggles a tenant's active status in data/tenants.json.
 */
export async function toggleLocalTenantStatus(
	id: string,
	isActive: boolean,
): Promise<boolean> {
	const current = await getLocalTenants();
	const index = current.findIndex((t) => t.id === id);
	if (index === -1) return false;

	const target = current[index];
	if (target) {
		target.is_active = isActive;
		target.updated_at = new Date().toISOString();
	}

	await fs.writeFile(TENANTS_FILE, JSON.stringify(current, null, 2), "utf-8");
	return true;
}

/**
 * Deletes a tenant by ID from data/tenants.json.
 */
export async function deleteLocalTenant(id: string): Promise<boolean> {
	const current = await getLocalTenants();
	const filtered = current.filter((t) => t.id !== id);
	if (filtered.length === current.length) return false;

	await fs.writeFile(TENANTS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
	return true;
}
