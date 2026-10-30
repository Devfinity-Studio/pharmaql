import "server-only";
import { decryptSecret } from "./crypto";
import { normalizeApiUrl } from "./utils";

const RAW_API_SERVER_URL = process.env.API_SERVER_URL;
const DEFAULT_API_SERVER_URL =
	normalizeApiUrl(RAW_API_SERVER_URL) || "https://api.asmeepharma.com";
const DEFAULT_API_SECRET_KEY = process.env.API_SECRET_KEY || "";

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	isOffline?: boolean;
	debugSql?: string;
	total?: number;
	hasMore?: boolean;
	page?: number;
	limit?: number;
}

export function isOfflineError(error: any): boolean {
	if (!error) return false;
	const msg = typeof error === "string" ? error : error.message || "";
	return (
		error.name === "TimeoutError" ||
		msg.includes("TimeoutError") ||
		msg.includes("ECONNREFUSED") ||
		msg.includes("ETIMEDOUT") ||
		msg.includes("Failed to fetch") ||
		msg.includes("API Server unreachable") ||
		msg.includes("offline")
	);
}

/**
 * Resolves the dynamic API server URL, secret key, and tenant ERP parameters.
 */
async function getDynamicApiConfig(): Promise<{
	baseUrl: string;
	secretKey: string;
	compNo?: number;
	locNo?: number;
	legacyDbName?: string;
}> {
	let baseUrl = DEFAULT_API_SERVER_URL;
	let secretKey = DEFAULT_API_SECRET_KEY;
	let compNo: number | undefined;
	let locNo: number | undefined;
	let legacyDbName: string | undefined;

	try {
		const { headers } = await import("next/headers");
		const h = await headers();
		const dynamicUrl = h.get("x-tenant-api-url");
		if (dynamicUrl) {
			const normalized = normalizeApiUrl(dynamicUrl);
			if (normalized) {
				baseUrl = normalized;
			}
		}
		const encryptedKey = h.get("x-tenant-api-key-enc");
		if (encryptedKey) {
			try {
				secretKey = decryptSecret(encryptedKey);
			} catch (err: any) {
				if (process.env.NODE_ENV === "development") {
					console.warn("[ApiClient] Failed to decrypt tenant API key:", err.message);
				}
			}
		}

		const rawComp = h.get("x-tenant-comp-no");
		if (rawComp && !isNaN(Number(rawComp))) {
			compNo = Number(rawComp);
		}

		const rawLoc = h.get("x-tenant-loc-no");
		if (rawLoc && !isNaN(Number(rawLoc))) {
			locNo = Number(rawLoc);
		}

		const rawDb = h.get("x-tenant-legacy-db");
		if (rawDb) {
			legacyDbName = rawDb;
		}
	} catch {
		// Not in active request context; fallback to environment defaults
	}

	return { baseUrl, secretKey, compNo, locNo, legacyDbName };
}

export interface ApiRequestOptions {
	ttlSeconds?: number;
	forceRefresh?: boolean;
	bypassCache?: boolean;
}

interface CacheItem<T> {
	data: ApiResponse<T>;
	expiresAt: number;
}

const serverCache = new Map<string, CacheItem<any>>();
const inFlightRequests = new Map<string, Promise<ApiResponse<any>>>();
const MAX_SERVER_CACHE = 500;

/**
 * Manually flushes cached API responses in Next.js runtime.
 */
export function invalidateApiClientCache(prefix?: string): number {
	if (!prefix) {
		const count = serverCache.size;
		serverCache.clear();
		return count;
	}
	let count = 0;
	for (const key of serverCache.keys()) {
		if (key.startsWith(prefix)) {
			serverCache.delete(key);
			count++;
		}
	}
	return count;
}

function getHeaders(secretKey: string, forceRefresh?: boolean): HeadersInit {
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${secretKey}`,
		...(forceRefresh ? { "x-bypass-cache": "true" } : {}),
	};
}

export async function apiGet<T>(
	path: string,
	queryParams?: Record<string, string | number | undefined | null>,
	options?: ApiRequestOptions,
): Promise<ApiResponse<T>> {
	try {
		const { baseUrl: rawBase, secretKey, compNo, locNo, legacyDbName } = await getDynamicApiConfig();
		const baseUrl = normalizeApiUrl(rawBase) || DEFAULT_API_SERVER_URL;
		const cleanPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(cleanPath, baseUrl);

		// Merge injected tenant defaults with explicit query params
		const mergedParams: Record<string, string | number | undefined | null> = {
			...(compNo !== undefined ? { compNo } : {}),
			...(locNo !== undefined ? { locNo } : {}),
			...(legacyDbName ? { dbName: legacyDbName } : {}),
			...queryParams,
		};

		Object.entries(mergedParams).forEach(([key, val]) => {
			if (val !== undefined && val !== null && val !== "") {
				url.searchParams.set(key, String(val));
			}
		});

		const fullUrl = url.toString();
		const cacheKey = `GET:${fullUrl}`;
		const now = Date.now();
		const effectiveTtl = options?.ttlSeconds ?? 60; // 60s default cache for GET queries

		// 1. Serve from in-memory Tier-2 cache if valid and not forcing refresh
		if (!options?.forceRefresh && !options?.bypassCache) {
			const cached = serverCache.get(cacheKey);
			if (cached && cached.expiresAt > now) {
				return cached.data;
			}
		}

		// 2. In-flight promise deduplication: join existing request if identical query is in-flight
		if (!options?.forceRefresh && inFlightRequests.has(cacheKey)) {
			return await inFlightRequests.get(cacheKey)!;
		}

		const fetchPromise = (async (): Promise<ApiResponse<T>> => {
			try {
				const response = await fetch(fullUrl, {
					method: "GET",
					headers: getHeaders(secretKey, options?.forceRefresh),
					cache: "no-store",
					signal: AbortSignal.timeout(6000),
				});

				if (!response.ok) {
					const errText = await response.text();
					const offline = response.status >= 502 && response.status <= 504;
					return {
						success: false,
						isOffline: offline,
						error: offline
							? "On-premise ERP bridge is currently offline or unreachable."
							: `API Server HTTP ${response.status}: ${errText}`,
					};
				}

				const json = await response.json();
				const result: ApiResponse<T> =
					json && typeof json === "object" && "success" in json ? json : { success: true, data: json };

				// Cache successful responses
				if (result.success && !options?.bypassCache && effectiveTtl > 0) {
					if (serverCache.size >= MAX_SERVER_CACHE) {
						const oldest = serverCache.keys().next().value;
						if (oldest) serverCache.delete(oldest);
					}
					serverCache.set(cacheKey, {
						data: result,
						expiresAt: Date.now() + effectiveTtl * 1000,
					});
				}

				return result;
			} catch (error: any) {
				console.error(`[API Client GET Error] ${path}:`, error.message);
				const offline = isOfflineError(error);
				return {
					success: false,
					isOffline: offline,
					error: offline
						? "On-premise ERP bridge is unreachable or connection timed out after 6000ms."
						: error.message || "Failed to communicate with Database API",
				};
			} finally {
				inFlightRequests.delete(cacheKey);
			}
		})();

		inFlightRequests.set(cacheKey, fetchPromise);
		return await fetchPromise;
	} catch (error: any) {
		console.error(`[API Client GET Setup Error] ${path}:`, error.message);
		return {
			success: false,
			error: error.message || "Failed to configure database query",
		};
	}
}

export async function apiPost<T>(
	path: string,
	body: any,
	options?: ApiRequestOptions,
): Promise<ApiResponse<T>> {
	try {
		const { baseUrl: rawBase, secretKey, compNo, locNo, legacyDbName } = await getDynamicApiConfig();
		const baseUrl = normalizeApiUrl(rawBase) || DEFAULT_API_SERVER_URL;
		const cleanPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(cleanPath, baseUrl);

		// Automatically inject tenant ERP parameters if body is an object
		let finalBody = body;
		if (body && typeof body === "object" && !Array.isArray(body)) {
			finalBody = {
				...(compNo !== undefined ? { compNo } : {}),
				...(locNo !== undefined ? { locNo } : {}),
				...(legacyDbName ? { dbName: legacyDbName } : {}),
				...body,
			};
		}

		const fullUrl = url.toString();
		const bodyString = JSON.stringify(finalBody);
		const cacheKey = `POST:${fullUrl}:${bodyString}`;
		const now = Date.now();

		// Reports and master reads are cacheable; mutations/auth bypass by default
		const isReportEndpoint = cleanPath.startsWith("/api/reports") || cleanPath.startsWith("/api/master");
		const shouldCache =
			!options?.bypassCache && (options?.ttlSeconds !== undefined ? options.ttlSeconds > 0 : isReportEndpoint);
		const effectiveTtl = options?.ttlSeconds ?? (isReportEndpoint ? 60 : 0);

		// 1. Check in-memory cache
		if (shouldCache && !options?.forceRefresh) {
			const cached = serverCache.get(cacheKey);
			if (cached && cached.expiresAt > now) {
				return cached.data;
			}
		}

		// 2. In-flight request deduplication
		if (shouldCache && !options?.forceRefresh && inFlightRequests.has(cacheKey)) {
			return await inFlightRequests.get(cacheKey)!;
		}

		const fetchPromise = (async (): Promise<ApiResponse<T>> => {
			try {
				const response = await fetch(fullUrl, {
					method: "POST",
					headers: getHeaders(secretKey, options?.forceRefresh),
					body: bodyString,
					cache: "no-store",
					signal: AbortSignal.timeout(6000),
				});

				if (!response.ok) {
					const errText = await response.text();
					const offline = response.status >= 502 && response.status <= 504;
					return {
						success: false,
						isOffline: offline,
						error: offline
							? "On-premise ERP bridge is currently offline or unreachable."
							: `API Server HTTP ${response.status}: ${errText}`,
					};
				}

				const json = await response.json();
				const result: ApiResponse<T> =
					json && typeof json === "object" && "success" in json ? json : { success: true, data: json };

				// Cache successful idempotent responses
				if (result.success && shouldCache && effectiveTtl > 0) {
					if (serverCache.size >= MAX_SERVER_CACHE) {
						const oldest = serverCache.keys().next().value;
						if (oldest) serverCache.delete(oldest);
					}
					serverCache.set(cacheKey, {
						data: result,
						expiresAt: Date.now() + effectiveTtl * 1000,
					});
				}

				return result;
			} catch (error: any) {
				console.error(`[API Client POST Error] ${path}:`, error.message);
				const offline = isOfflineError(error);
				return {
					success: false,
					isOffline: offline,
					error: offline
						? "On-premise ERP bridge is unreachable or connection timed out after 6000ms."
						: error.message || "Failed to communicate with Database API",
				};
			} finally {
				inFlightRequests.delete(cacheKey);
			}
		})();

		if (shouldCache) {
			inFlightRequests.set(cacheKey, fetchPromise);
		}
		return await fetchPromise;
	} catch (error: any) {
		console.error(`[API Client POST Setup Error] ${path}:`, error.message);
		return {
			success: false,
			error: error.message || "Failed to configure database query",
		};
	}
}


