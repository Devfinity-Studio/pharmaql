import "server-only";
import { decryptSecret } from "./crypto";

const RAW_API_SERVER_URL = process.env.API_SERVER_URL;
const DEFAULT_API_SERVER_URL =
	(RAW_API_SERVER_URL
		? RAW_API_SERVER_URL.trim().replace(/^["']|["']$/g, "")
		: "") || "https://api.asmeepharma.com";
const DEFAULT_API_SECRET_KEY = process.env.API_SECRET_KEY || "";

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	debugSql?: string;
	total?: number;
	hasMore?: boolean;
	page?: number;
	limit?: number;
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
			baseUrl = dynamicUrl.trim().replace(/^["']|["']$/g, "");
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
		const { baseUrl, secretKey } = await getDynamicApiConfig();
		const url = new URL(path, baseUrl);
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
		});

		if (!response.ok) {
			const errText = await response.text();
			return {
				success: false,
				error: `API Server HTTP ${response.status}: ${errText}`,
			};
		}

		const json = await response.json();
		if (json && typeof json === "object" && "success" in json) {
			return json;
		}
		return { success: true, data: json };
	} catch (error: any) {
		console.error(`[API Client GET Error] ${path}:`, error.message);
		return {
			success: false,
			error: error.message || "Failed to communicate with Database API",
		};
	}
}

export async function apiPost<T>(
	path: string,
	body: any,
): Promise<ApiResponse<T>> {
	try {
		const { baseUrl, secretKey } = await getDynamicApiConfig();
		const url = new URL(path, baseUrl);
		const response = await fetch(url.toString(), {
			method: "POST",
			headers: getHeaders(secretKey),
			body: JSON.stringify(body),
			cache: "no-store",
		});

		if (!response.ok) {
			const errText = await response.text();
			return {
				success: false,
				error: `API Server HTTP ${response.status}: ${errText}`,
			};
		}

		const json = await response.json();
		if (json && typeof json === "object" && "success" in json) {
			return json;
		}
		return { success: true, data: json };
	} catch (error: any) {
		console.error(`[API Client POST Error] ${path}:`, error.message);
		return {
			success: false,
			error: error.message || "Failed to communicate with Database API",
		};
	}
}
