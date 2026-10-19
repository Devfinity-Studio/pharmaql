/**
 * User-Agent & Client Telemetry Parser
 * Extracts browser, operating system, and device form factor from HTTP User-Agent strings.
 */

export type DeviceType = "desktop" | "mobile" | "tablet";

export interface ParsedClientTelemetry {
	browser: string;
	os: string;
	deviceType: DeviceType;
	rawUserAgent?: string;
}

/**
 * Extracts normalized client IP address from request headers.
 */
export function getClientIpFromHeaders(headers: Headers | Record<string, string | string[] | undefined>): string {
	const getHeader = (key: string): string | undefined => {
		if ("get" in headers && typeof headers.get === "function") {
			return headers.get(key) || undefined;
		}
		const val = (headers as Record<string, any>)[key.toLowerCase()] || (headers as Record<string, any>)[key];
		if (Array.isArray(val)) return val[0];
		return typeof val === "string" ? val : undefined;
	};

	const forwarded = getHeader("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) return first;
	}

	const realIp = getHeader("x-real-ip");
	if (realIp?.trim()) return realIp.trim();

	const cfIp = getHeader("cf-connecting-ip");
	if (cfIp?.trim()) return cfIp.trim();

	return "127.0.0.1";
}

/**
 * Parses a raw User-Agent string into Browser, OS, and Device Form Factor.
 */
export function parseUserAgent(uaString?: string | null): ParsedClientTelemetry {
	if (!uaString || typeof uaString !== "string") {
		return {
			browser: "Unknown Browser",
			os: "Unknown OS",
			deviceType: "desktop",
		};
	}

	const ua = uaString.trim();

	// 1. Device Form Factor
	let deviceType: DeviceType = "desktop";
	const isTablet = /iPad|Tablet|(Android(?!.*Mobile))|PlayBook|Silk/i.test(ua);
	const isMobile = /Mobile|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Kindle|Opera Mini/i.test(ua);

	if (isTablet) {
		deviceType = "tablet";
	} else if (isMobile) {
		deviceType = "mobile";
	}

	// 2. Operating System
	let os = "Unknown OS";
	if (/Windows NT 10.0/i.test(ua)) os = "Windows 10/11";
	else if (/Windows NT 6.3/i.test(ua)) os = "Windows 8.1";
	else if (/Windows NT 6.1/i.test(ua)) os = "Windows 7";
	else if (/Windows/i.test(ua)) os = "Windows";
	else if (/iPhone|iPad|iPod/i.test(ua)) {
		const match = ua.match(/OS (\d+[._]\d+)/i);
		os = match ? `iOS ${match[1]?.replace("_", ".")}` : "iOS";
	} else if (/Android/i.test(ua)) {
		const match = ua.match(/Android (\d+(\.\d+)?)/i);
		os = match ? `Android ${match[1]}` : "Android";
	} else if (/Macintosh|Mac OS X/i.test(ua)) {
		const match = ua.match(/Mac OS X (\d+[._]\d+)/i);
		os = match ? `macOS ${match[1]?.replace("_", ".")}` : "macOS";
	} else if (/Linux/i.test(ua)) {
		os = "Linux";
	} else if (/CrOS/i.test(ua)) {
		os = "ChromeOS";
	}

	// 3. Browser
	let browser = "Unknown Browser";
	if (/OPR\/(\d+)/i.test(ua)) {
		const match = ua.match(/OPR\/(\d+)/i);
		browser = `Opera ${match?.[1] || ""}`.trim();
	} else if (/Edg\/(\d+)/i.test(ua)) {
		const match = ua.match(/Edg\/(\d+)/i);
		browser = `Edge ${match?.[1] || ""}`.trim();
	} else if (/SamsungBrowser\/(\d+)/i.test(ua)) {
		const match = ua.match(/SamsungBrowser\/(\d+)/i);
		browser = `Samsung Internet ${match?.[1] || ""}`.trim();
	} else if (/Chrome\/(\d+)/i.test(ua)) {
		const match = ua.match(/Chrome\/(\d+)/i);
		browser = `Chrome ${match?.[1] || ""}`.trim();
	} else if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua)) {
		const match = ua.match(/Version\/(\d+)/i);
		browser = `Safari ${match?.[1] || ""}`.trim();
	} else if (/Firefox\/(\d+)/i.test(ua)) {
		const match = ua.match(/Firefox\/(\d+)/i);
		browser = `Firefox ${match?.[1] || ""}`.trim();
	}

	return {
		browser,
		os,
		deviceType,
		rawUserAgent: ua,
	};
}
