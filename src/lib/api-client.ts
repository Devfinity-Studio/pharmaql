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
 * Resolves the dynamic API server URL and secret key for the active tenant.
 */
async function getDynamicApiConfig(): Promise<{ baseUrl: string; secretKey: string }> {
	let baseUrl = DEFAULT_API_SERVER_URL;
	let secretKey = DEFAULT_API_SECRET_KEY;

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
				console.warn("[ApiClient] Failed to decrypt tenant API key:", err.message);
			}
		}
	} catch {
		// Not in active request context; fallback to environment defaults
	}

	return { baseUrl, secretKey };
}

function getHeaders(secretKey: string): HeadersInit {
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${secretKey}`,
	};
}

export async function apiGet<T>(
	path: string,
	queryParams?: Record<string, string | number | undefined | null>,
): Promise<ApiResponse<T>> {
	try {
		const { baseUrl: rawBase, secretKey } = await getDynamicApiConfig();
		const baseUrl = normalizeApiUrl(rawBase) || DEFAULT_API_SERVER_URL;
		const cleanPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(cleanPath, baseUrl);
		if (queryParams) {
			Object.entries(queryParams).forEach(([key, val]) => {
				if (val !== undefined && val !== null && val !== "") {
					url.searchParams.set(key, String(val));
				}
			});
		}

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: getHeaders(secretKey),
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
		if (json && typeof json === "object" && "success" in json) {
			return json;
		}
		return { success: true, data: json };
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
	}
}

export async function apiPost<T>(
	path: string,
	body: any,
): Promise<ApiResponse<T>> {
	try {
		const { baseUrl: rawBase, secretKey } = await getDynamicApiConfig();
		const baseUrl = normalizeApiUrl(rawBase) || DEFAULT_API_SERVER_URL;
		const cleanPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(cleanPath, baseUrl);
		const response = await fetch(url.toString(), {
			method: "POST",
			headers: getHeaders(secretKey),
			body: JSON.stringify(body),
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
		if (json && typeof json === "object" && "success" in json) {
			return json;
		}
		return { success: true, data: json };
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
	}
}
