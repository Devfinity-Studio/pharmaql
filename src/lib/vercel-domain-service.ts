/**
 * Service for managing custom domains via the Vercel REST API.
 * Safely handles missing credentials, network errors, and non-blocking fallbacks.
 */

export interface VercelDomainResult {
	success: boolean;
	configured: boolean;
	verified?: boolean;
	domain?: string;
	error?: string;
	message?: string;
}

export function isVercelConfigured(): boolean {
	const token = process.env.VERCEL_API_TOKEN?.trim();
	const projectId = process.env.VERCEL_PROJECT_ID?.trim();
	return Boolean(token && projectId);
}

function getVercelApiHeaders(): Record<string, string> {
	const token = process.env.VERCEL_API_TOKEN?.trim() || "";
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
}

function getVercelProjectUrl(endpoint: string): string {
	const projectId = process.env.VERCEL_PROJECT_ID?.trim() || "";
	const teamId = process.env.VERCEL_TEAM_ID?.trim();
	const base = `https://api.vercel.com${endpoint.replace(":projectId", encodeURIComponent(projectId))}`;
	if (teamId) {
		const separator = base.includes("?") ? "&" : "?";
		return `${base}${separator}teamId=${encodeURIComponent(teamId)}`;
	}
	return base;
}

/**
 * Registers a custom domain to the Vercel project.
 */
export async function addDomainToVercel(domain: string): Promise<VercelDomainResult> {
	if (!domain) {
		return { success: false, configured: false, error: "Domain name cannot be empty" };
	}

	const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

	if (!isVercelConfigured()) {
		return {
			success: true,
			configured: false,
			domain: cleanDomain,
			message: "Vercel API credentials not configured in environment. Manual Vercel dashboard setup required.",
		};
	}

	try {
		const url = getVercelProjectUrl("/v10/projects/:projectId/domains");
		const res = await fetch(url, {
			method: "POST",
			headers: getVercelApiHeaders(),
			body: JSON.stringify({ name: cleanDomain }),
		});

		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			// Domain already assigned to this project is treated as success
			if (data?.error?.code === "domain_already_in_use" || data?.error?.message?.includes("already exists")) {
				return {
					success: true,
					configured: true,
					domain: cleanDomain,
					verified: data?.verified ?? false,
					message: "Domain is already configured in Vercel project.",
				};
			}

			return {
				success: false,
				configured: true,
				domain: cleanDomain,
				error: data?.error?.message || `Vercel API HTTP ${res.status}`,
			};
		}

		return {
			success: true,
			configured: true,
			domain: cleanDomain,
			verified: Boolean(data?.verified),
			message: data?.verified ? "Domain added and verified on Vercel." : "Domain added to Vercel. Awaiting DNS propagation.",
		};
	} catch (err: any) {
		console.warn(`[VercelDomainService] Failed to add domain ${cleanDomain}:`, err.message);
		return {
			success: false,
			configured: true,
			domain: cleanDomain,
			error: err.message || "Network error communicating with Vercel API",
		};
	}
}

/**
 * Removes a custom domain from the Vercel project.
 */
export async function removeDomainFromVercel(domain: string): Promise<VercelDomainResult> {
	if (!domain || !isVercelConfigured()) {
		return { success: true, configured: isVercelConfigured() };
	}

	const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

	try {
		const url = getVercelProjectUrl(`/v9/projects/:projectId/domains/${encodeURIComponent(cleanDomain)}`);
		const res = await fetch(url, {
			method: "DELETE",
			headers: getVercelApiHeaders(),
		});

		if (!res.ok && res.status !== 404) {
			const data = await res.json().catch(() => ({}));
			return {
				success: false,
				configured: true,
				domain: cleanDomain,
				error: data?.error?.message || `HTTP ${res.status}`,
			};
		}

		return {
			success: true,
			configured: true,
			domain: cleanDomain,
			message: "Domain removed from Vercel.",
		};
	} catch (err: any) {
		console.warn(`[VercelDomainService] Failed to remove domain ${cleanDomain}:`, err.message);
		return {
			success: false,
			configured: true,
			domain: cleanDomain,
			error: err.message,
		};
	}
}

/**
 * Checks verification status of a domain on Vercel.
 */
export async function getDomainVerification(domain: string): Promise<{
	configured: boolean;
	verified: boolean;
	misconfigured?: boolean;
	error?: string;
}> {
	if (!domain || !isVercelConfigured()) {
		return { configured: false, verified: false };
	}

	const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

	try {
		const url = getVercelProjectUrl(`/v9/projects/:projectId/domains/${encodeURIComponent(cleanDomain)}/verify`);
		const res = await fetch(url, {
			method: "POST",
			headers: getVercelApiHeaders(),
		});

		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			return {
				configured: true,
				verified: false,
				error: data?.error?.message || `HTTP ${res.status}`,
			};
		}

		return {
			configured: true,
			verified: Boolean(data?.verified),
			misconfigured: Boolean(data?.misconfigured),
		};
	} catch (err: any) {
		return {
			configured: true,
			verified: false,
			error: err.message,
		};
	}
}
