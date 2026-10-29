import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Normalizes an API Server URL to ensure it is valid with a leading protocol.
 * E.g.:
 *  "api.asmeepharma.com" -> "https://api.asmeepharma.com"
 *  "192.168.1.100:8000"  -> "http://192.168.1.100:8000"
 *  "localhost:8000"      -> "http://localhost:8000"
 *  "https://api.foo.com" -> "https://api.foo.com"
 */
export function normalizeApiUrl(rawUrl?: string | null): string {
	if (!rawUrl) return "";
	let clean = rawUrl.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
	if (!clean) return "";

	if (!/^https?:\/\//i.test(clean)) {
		if (
			clean.startsWith("localhost") ||
			clean.startsWith("127.0.0.1") ||
			/^\d+\.\d+\.\d+\.\d+/.test(clean)
		) {
			clean = `http://${clean}`;
		} else {
			clean = `https://${clean}`;
		}
	}

	return clean;
}
