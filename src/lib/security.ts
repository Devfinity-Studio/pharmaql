/**
 * Security & Network Utilities
 * Handles IP extraction, network normalization, and admin allowlist authorization.
 */

/**
 * Extracts normalized client IP address from request headers.
 * Prioritizes trusted cloud proxy headers over generic user-supplied headers.
 */
export function getClientIp(headers: Headers): string {
	// 1. Cloudflare connecting IP (trustworthy when traffic is routed via Cloudflare)
	const cfIp = headers.get("cf-connecting-ip");
	if (cfIp) return cfIp.trim();

	// 2. Direct upstream reverse proxy real IP (e.g., Caddy, Nginx, or Vercel proxy)
	const realIp = headers.get("x-real-ip");
	if (realIp) return realIp.trim();

	// 3. Vercel / Platform forwarded IP
	const vercelIp = headers.get("x-vercel-forwarded-for");
	if (vercelIp) {
		const ip = vercelIp.split(",")[0]?.trim();
		if (ip) return ip;
	}

	// 4. Explicitly injected header from internal middleware
	const middlewareIp = headers.get("x-client-ip");
	if (middlewareIp) return middlewareIp.trim();

	// 5. Standard X-Forwarded-For
	// In reverse-proxy chains, the leftmost IP is the client (or untrusted client-supplied header),
	// whereas right-hand IPs are added by trusted proxies. If multiple hops exist, sanitize.
	const forwardedFor = headers.get("x-forwarded-for");
	if (forwardedFor) {
		const hops = forwardedFor
			.split(",")
			.map((h) => h.trim())
			.filter(Boolean);
		if (hops.length > 0) {
			return hops[0]!;
		}
	}

	// 6. Custom forwarded or fallback
	const forwarded = headers.get("forwarded");
	if (forwarded) {
		const match = forwarded.match(/for="?([^;,\s"]+)"?/i);
		if (match?.[1]) return match[1].trim();
	}

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
 * In production, loopback (127.0.0.1) is only allowed if explicitly specified in ADMIN_ALLOWED_IPS.
 */
export function isIpAllowedForAdmin(clientIp: string): boolean {
	const allowedEnv = process.env.ADMIN_ALLOWED_IPS?.trim();
	if (!allowedEnv) {
		return true; // No restriction configured
	}

	// In development/test environments, allow local loopback
	if (process.env.NODE_ENV !== "production") {
		if (clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost") {
			return true;
		}
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
