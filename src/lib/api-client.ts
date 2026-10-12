import "server-only";

const API_SERVER_URL = process.env.API_SERVER_URL || "http://127.0.0.1:9443";
const API_SECRET_KEY = process.env.API_SECRET_KEY;

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

function getHeaders(): HeadersInit {
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${API_SECRET_KEY}`,
	};
}

export async function apiGet<T>(
	path: string,
	queryParams?: Record<string, string | number | undefined | null>,
): Promise<ApiResponse<T>> {
	try {
		const url = new URL(path, API_SERVER_URL);
		if (queryParams) {
			Object.entries(queryParams).forEach(([key, val]) => {
				if (val !== undefined && val !== null && val !== "") {
					url.searchParams.set(key, String(val));
				}
			});
		}

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: getHeaders(),
			cache: "no-store",
		});

		if (!response.ok) {
			const errText = await response.text();
			return {
				success: false,
				error: `API Server HTTP ${response.status}: ${errText}`,
			};
		}

		return await response.json();
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
		const url = new URL(path, API_SERVER_URL);
		const response = await fetch(url.toString(), {
			method: "POST",
			headers: getHeaders(),
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

		return await response.json();
	} catch (error: any) {
		console.error(`[API Client POST Error] ${path}:`, error.message);
		return {
			success: false,
			error: error.message || "Failed to communicate with Database API",
		};
	}
}
