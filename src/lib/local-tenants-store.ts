import fs from "fs/promises";
import os from "os";
import path from "path";
import type { TenantRecord } from "./control-plane-db";

const BUNDLED_DATA_DIR = path.join(process.cwd(), "data");
const BUNDLED_TENANTS_FILE = path.join(BUNDLED_DATA_DIR, "tenants.json");

// On Vercel / AWS Lambda, only /tmp is writable
const TMP_DATA_DIR = path.join(os.tmpdir(), "pharmaql-data");
const TMP_TENANTS_FILE = path.join(TMP_DATA_DIR, "tenants.json");

// In-memory cache for fast read/writes within serverless execution contexts
let localTenantsMemoryCache: TenantRecord[] | null = null;

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
	admin_email: "asmeepharma2022@gmail.com",
	admin_password_encrypted: null,
	smtp_host: null,
	smtp_port: 465,
	smtp_secure: true,
	smtp_user: null,
	smtp_password_encrypted: null,
	smtp_from_name: null,
	smtp_from_email: null,
	created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
	updated_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

/**
 * Safely writes tenant records to disk with EROFS /tmp fallback.
 */
async function writeTenantsFile(records: TenantRecord[]): Promise<void> {
	localTenantsMemoryCache = records;
	const payload = JSON.stringify(records, null, 2);

	const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

	// In serverless environments, write directly to /tmp
	if (isServerless) {
		try {
			await fs.mkdir(TMP_DATA_DIR, { recursive: true });
			await fs.writeFile(TMP_TENANTS_FILE, payload, "utf-8");
			return;
		} catch (err: any) {
			console.warn("[LocalTenantsStore] /tmp write warning:", err.message);
			return;
		}
	}

	// In local dev, try writing to project root data directory first
	try {
		await fs.mkdir(BUNDLED_DATA_DIR, { recursive: true });
		await fs.writeFile(BUNDLED_TENANTS_FILE, payload, "utf-8");
	} catch (err: any) {
		// If EROFS or permission denied, fallback to /tmp
		if (err?.code === "EROFS" || err?.code === "EACCES" || err?.code === "EPERM") {
			try {
				await fs.mkdir(TMP_DATA_DIR, { recursive: true });
				await fs.writeFile(TMP_TENANTS_FILE, payload, "utf-8");
			} catch (tmpErr: any) {
				console.warn("[LocalTenantsStore] /tmp fallback write warning:", tmpErr.message);
			}
			return;
		}
		console.warn("[LocalTenantsStore] Write warning:", err?.message || err);
	}
}

/**
 * Reads tenants from disk or in-memory cache.
 * Checks in-memory cache -> /tmp -> bundled data/tenants.json.
 */
export async function getLocalTenants(): Promise<TenantRecord[]> {
	if (localTenantsMemoryCache && localTenantsMemoryCache.length > 0) {
		return localTenantsMemoryCache;
	}

	// 1. Try reading from /tmp (most recent modifications in serverless)
	try {
		const tmpContent = await fs.readFile(TMP_TENANTS_FILE, "utf-8");
		const parsedTmp = JSON.parse(tmpContent);
		if (Array.isArray(parsedTmp) && parsedTmp.length > 0) {
			localTenantsMemoryCache = parsedTmp as TenantRecord[];
			return localTenantsMemoryCache;
		}
	} catch {
		// Ignore /tmp missing
	}

	// 2. Try reading from bundled project file
	try {
		const bundledContent = await fs.readFile(BUNDLED_TENANTS_FILE, "utf-8");
		const parsedBundled = JSON.parse(bundledContent);
		if (Array.isArray(parsedBundled) && parsedBundled.length > 0) {
			localTenantsMemoryCache = parsedBundled as TenantRecord[];
			return localTenantsMemoryCache;
		}
	} catch {
		// Ignore bundled missing
	}

	// 3. Seed default tenant
	const initial = [DEFAULT_ASMEE_TENANT];
	await writeTenantsFile(initial).catch(() => {});
	return initial;
}

/**
 * Saves or updates a tenant in local store.
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

	await writeTenantsFile(current);
	return savedTenant;
}

/**
 * Toggles a tenant's active status.
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

	await writeTenantsFile(current);
	return true;
}

/**
 * Deletes a tenant by ID.
 */
export async function deleteLocalTenant(id: string): Promise<boolean> {
	const current = await getLocalTenants();
	const filtered = current.filter((t) => t.id !== id);
	if (filtered.length === current.length) return false;

	await writeTenantsFile(filtered);
	return true;
}

/**
 * Gets a single tenant by ID.
 */
export async function getLocalTenantById(id: string): Promise<TenantRecord | null> {
	const current = await getLocalTenants();
	return current.find((t) => t.id === id) || null;
}

/**
 * Gets a single tenant by slug.
 */
export async function getLocalTenantBySlug(slug: string): Promise<TenantRecord | null> {
	const current = await getLocalTenants();
	const clean = slug.toLowerCase().trim();
	return current.find((t) => t.slug.toLowerCase().trim() === clean) || null;
}

