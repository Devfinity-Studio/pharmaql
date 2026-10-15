/**
 * Security & Network Utilities
 * Handles IP extraction, network normalization, and admin allowlist authorization.
 */

/**
 * Extracts normalized client IP address from standard request headers.
 */
export function getClientIp(headers: Headers): string {
	// 1. Cloudflare connecting IP
	const cfIp = headers.get("cf-connecting-ip");
	if (cfIp) return cfIp.trim();

	// 2. Standard X-Forwarded-For (first entry in comma-separated list is client)
	const forwardedFor = headers.get("x-forwarded-for");
	if (forwardedFor) {
		const clientIp = forwardedFor.split(",")[0]?.trim();
		if (clientIp) return clientIp;
	}

	// 3. X-Real-IP
	const realIp = headers.get("x-real-ip");
	if (realIp) return realIp.trim();

	// 4. Custom forwarded or fallback
	const forwarded = headers.get("forwarded");
	if (forwarded) {
		const match = forwarded.match(/for="?([^;,\s"]+)"?/i);
		if (match?.[1]) return match[1].trim();
	}

	// 5. Explicitly injected header from middleware
	const middlewareIp = headers.get("x-client-ip");
	if (middlewareIp) return middlewareIp.trim();

	return "127.0.0.1";
}

/**
 * Extracts User-Agent string from headers.
 */
export function getClientUserAgent(headers: Headers): string {
	return headers.get("user-agent")?.trim() || "Unknown";
}

/**
 * Checks whether an IP is in the configured ADMIN_ALLOWED_IPS list.
 * If ADMIN_ALLOWED_IPS is not set or empty, allow all by default.
 */
export function isIpAllowedForAdmin(clientIp: string): boolean {
	const allowedEnv = process.env.ADMIN_ALLOWED_IPS?.trim();
	if (!allowedEnv) {
		return true; // No restriction configured
	}

	// Always allow local loopback
	if (clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost") {
		return true;
	}

	const allowedList = allowedEnv
		.split(",")
		.map((ip) => ip.trim())
		.filter(Boolean);

	if (allowedList.length === 0) return true;

	for (const allowed of allowedList) {
		if (allowed === clientIp) return true;

		// Simple wildcard support, e.g. 192.168.1.*
		if (allowed.endsWith(".*")) {
			const prefix = allowed.slice(0, -2);
			if (clientIp.startsWith(prefix)) return true;
		}

		// Simple CIDR /24 check
		if (allowed.includes("/24")) {
			const subnet = allowed.split("/24")[0]!.split(".").slice(0, 3).join(".");
			if (clientIp.startsWith(`${subnet}.`)) return true;
		}
	}

	return false;
}
