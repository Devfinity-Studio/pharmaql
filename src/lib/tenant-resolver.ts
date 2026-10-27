import { getControlPlaneSql, type TenantRecord } from "./control-plane-db";

/**
 * In-memory TTL cache for tenant records (5 minutes).
 * Edge-compatible cache avoiding database round-trips for high-frequency requests.
 */
interface CachedTenant {
	tenant: TenantRecord | null;
	cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const tenantMemoryCache = new Map<string, CachedTenant>();

/**
 * Cleans the hostname by removing port and protocol.
 */
export function normalizeHost(host: string): string {
	if (!host) return "";
	const parts = host.split(":");
	return (parts[0] ?? "").toLowerCase().trim();
}

/**
 * Checks whether the host matches the configured Developer Portal domain.
 */
export function isDevPortalHost(host: string): boolean {
	const normalized = normalizeHost(host);
	const devPortalDomain = process.env.DEV_PORTAL_DOMAIN
		? normalizeHost(process.env.DEV_PORTAL_DOMAIN)
		: "pharmaql.devfinity.net";

	return (
		normalized === devPortalDomain ||
		normalized === "devfinity.net" ||
		normalized === "localhost" ||
		normalized === "127.0.0.1"
	);
}

/**
 * Resolves a tenant by custom domain or tenant slug with 5-minute memory caching.
 * Strictly Edge-safe: executes purely via HTTP fetch (@neondatabase/serverless).
 */
export async function resolveTenantByHost(
	rawHost: string,
	options?: {
		searchParams?: URLSearchParams | Record<string, string>;
		headers?: Headers;
	},
): Promise<{ tenant: TenantRecord | null; isDevPortal: boolean }> {
	const host = normalizeHost(rawHost);
	const isDev = isDevPortalHost(host);

	// Check for developer simulation override via query param (?tenant=slug) or header (x-tenant-slug)
	let targetSlug: string | null = null;
	if (options?.searchParams) {
		if (typeof (options.searchParams as any).get === "function") {
			targetSlug = (options.searchParams as URLSearchParams).get("tenant");
		} else {
			targetSlug = (options.searchParams as Record<string, string>).tenant || null;
		}
	}
	if (!targetSlug && options?.headers) {
		targetSlug = options.headers.get("x-tenant-slug") || null;
	}

	const cacheKey = targetSlug ? `slug:${targetSlug}` : `host:${host}`;
	const cached = tenantMemoryCache.get(cacheKey);
	const now = Date.now();

	if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
		return { tenant: cached.tenant, isDevPortal: isDev };
	}

	const sql = getControlPlaneSql();

	// Offline dev fallback: if no Neon URL configured or in local development
	if (!sql) {
		const fallbackTenant: TenantRecord = {
			id: "00000000-0000-0000-0000-000000000001",
			slug: targetSlug || "asmee",
			custom_domain: host,
			is_active: true,
			display_name: "Asmee Pharma Pvt. Ltd.",
			short_name: "Asmee",
			logo_url: "/logo.png",
			address: "Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002",
			contact_phone: "+91 98765 43210",
			contact_email: "info@asmeepharma.com",
			gstin: "24AAAAA0000A1Z5",
			db_type: "api_server",
			api_server_url: process.env.API_SERVER_URL || "https://api.asmeepharma.com",
			api_server_key_encrypted: null,
		};
		return { tenant: fallbackTenant, isDevPortal: isDev };
	}

	try {
		let rows: any[] = [];

		if (targetSlug) {
			rows = await sql`
				SELECT * FROM tenants WHERE slug = ${targetSlug} AND is_active = true LIMIT 1
			`;
		} else if (isDev) {
			// On Dev Portal without explicit tenant simulation, pick default or null
			rows = await sql`
				SELECT * FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 1
			`;
		} else {
			// Match exact custom domain
			rows = await sql`
				SELECT * FROM tenants WHERE custom_domain = ${host} AND is_active = true LIMIT 1
			`;
		}

		const tenant: TenantRecord | null = rows.length > 0 ? (rows[0] as TenantRecord) : null;

		tenantMemoryCache.set(cacheKey, { tenant, cachedAt: now });
		return { tenant, isDevPortal: isDev };
	} catch (err: any) {
		console.warn(`[TenantResolver] Resolution error for ${host}:`, err.message);
		return { tenant: null, isDevPortal: isDev };
	}
}

/**
 * Flushes memory cache for a given slug, domain, or entire cache.
 */
export function invalidateTenantCache(slugOrDomain?: string): void {
	if (!slugOrDomain) {
		tenantMemoryCache.clear();
		return;
	}
	tenantMemoryCache.delete(`slug:${slugOrDomain}`);
	tenantMemoryCache.delete(`host:${normalizeHost(slugOrDomain)}`);
}
