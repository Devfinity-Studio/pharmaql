import { getControlPlaneSql, type TenantRecord } from "./control-plane-db";
import staticTenants from "../../data/tenants.json";

/**
 * In-memory TTL cache for tenant records (5 minutes).
 * Negative hits (null) are cached for only 2 seconds to avoid stale 404s after tenant creation.
 */
interface CachedTenant {
	tenant: TenantRecord | null;
	cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for positive hits
const NEGATIVE_CACHE_TTL_MS = 2 * 1000; // 2 seconds for negative (null) hits
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
 * - Localhost: `localhost:3000` and `127.0.0.1` are the Dev Portal.
 * - Subdomains: `<slug>.localhost:3000` are CLIENT portals (returns false).
 * - Production: `pharmaql.devfinity.net` / `DEV_PORTAL_DOMAIN` are the Dev Portal.
 */
export function isDevPortalHost(host: string): boolean {
	const normalized = normalizeHost(host);

	// If host is a subdomain of localhost (e.g. asmee.localhost), it is a CLIENT portal!
	if (normalized.endsWith(".localhost")) {
		return false;
	}

	const devPortalDomain = process.env.DEV_PORTAL_DOMAIN
		? normalizeHost(process.env.DEV_PORTAL_DOMAIN)
		: "pharmaql.devfinity.net";

	const vercelUrl = process.env.VERCEL_URL ? normalizeHost(process.env.VERCEL_URL) : "";
	const vercelBranchUrl = process.env.VERCEL_BRANCH_URL ? normalizeHost(process.env.VERCEL_BRANCH_URL) : "";

	return (
		normalized === devPortalDomain ||
		normalized === "devfinity.net" ||
		normalized === "localhost" ||
		normalized === "127.0.0.1" ||
		(Boolean(vercelUrl) && normalized === vercelUrl) ||
		(Boolean(vercelBranchUrl) && normalized === vercelBranchUrl) ||
		normalized.endsWith(".vercel.app")
	);
}

/**
 * Finds a tenant in the bundled static JSON dataset.
 */
function findStaticTenant(targetSlug: string | null, host: string, strippedHost: string, rootDomain: string, firstSub: string | null): TenantRecord | null {
	const match = (staticTenants as any[]).find((t) => {
		if (!t.is_active) return false;
		if (targetSlug && t.slug.toLowerCase() === targetSlug.toLowerCase()) return true;
		if (t.custom_domain) {
			const cleanCustom = t.custom_domain.toLowerCase().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
			if (cleanCustom === host || cleanCustom === strippedHost || cleanCustom === rootDomain) return true;
			if (`portal.${cleanCustom}` === host || `www.${cleanCustom}` === host) return true;
		}
		if (firstSub && t.slug.toLowerCase() === firstSub.toLowerCase()) return true;
		return false;
	});
	return match ? (match as unknown as TenantRecord) : null;
}

/**
 * Resolves a tenant by custom domain or tenant slug with memory caching.
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

	// Extract slug if host is <slug>.localhost (e.g. asmee.localhost:3000 -> asmee)
	let slugFromHost: string | null = null;
	if (host.endsWith(".localhost")) {
		slugFromHost = host.replace(/\.localhost$/, "").trim();
	}

	// Check for developer simulation override via query param (?tenant=slug) or header (x-tenant-slug)
	let targetSlug: string | null = slugFromHost;
	if (!targetSlug && options?.searchParams) {
		if (typeof (options.searchParams as any).get === "function") {
			targetSlug = (options.searchParams as URLSearchParams).get("tenant");
		} else {
			targetSlug = (options.searchParams as Record<string, string>).tenant || null;
		}
	}
	if (!targetSlug && options?.headers) {
		targetSlug = options.headers.get("x-tenant-slug") || null;
	}

	// If explicit targetSlug is provided (e.g. ?tenant=asmee or asmee.localhost), this is a CLIENT portal request
	const isDev = !targetSlug && isDevPortalHost(host);

	const cacheKey = targetSlug ? `slug:${targetSlug.toLowerCase()}` : `host:${host}`;
	const cached = tenantMemoryCache.get(cacheKey);
	const now = Date.now();

	if (cached) {
		const ttl = cached.tenant ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
		if (now - cached.cachedAt < ttl) {
			return { tenant: cached.tenant, isDevPortal: isDev };
		}
	}

	// Subdomain & root domain extraction for flexible matching
	const hostParts = host.split(".");
	const firstSubdomain = hostParts.length > 2 ? (hostParts[0] ?? null) : null;
	const strippedHost = host.replace(/^(portal|www|app)\./i, "");
	const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join(".") : host;

	const sql = getControlPlaneSql();

	// If no Neon URL configured or in offline local environment
	if (!sql) {
		if (isDev && !targetSlug) {
			return { tenant: null, isDevPortal: true };
		}
		const fallback = findStaticTenant(targetSlug, host, strippedHost, rootDomain, firstSubdomain);
		tenantMemoryCache.set(cacheKey, { tenant: fallback, cachedAt: now });
		return { tenant: fallback, isDevPortal: isDev };
	}

	try {
		let rows: any[] = [];

		if (targetSlug) {
			rows = await sql`
				SELECT * FROM tenants WHERE slug = ${targetSlug.toLowerCase()} AND is_active = true LIMIT 1
			`;
		} else if (isDev) {
			return { tenant: null, isDevPortal: true };
		} else {
			// Flexible custom domain matching (exact, stripped portal/www, root domain, or subdomain matching slug)
			rows = await sql`
				SELECT * FROM tenants 
				WHERE is_active = true 
				  AND (
				    custom_domain = ${host}
				    OR custom_domain = ${strippedHost}
				    OR custom_domain = ${rootDomain}
				    OR ('portal.' || custom_domain) = ${host}
				    OR ('www.' || custom_domain) = ${host}
				    OR slug = ${firstSubdomain || ""}
				  )
				LIMIT 1
			`;
		}

		let tenant: TenantRecord | null = rows.length > 0 ? (rows[0] as TenantRecord) : null;

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
	const clean = slugOrDomain.toLowerCase().trim();
	tenantMemoryCache.delete(`slug:${clean}`);
	tenantMemoryCache.delete(`host:${normalizeHost(clean)}`);
}
