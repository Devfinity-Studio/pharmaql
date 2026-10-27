import { type NextRequest, NextResponse } from "next/server";
import { getClientIp, isIpAllowedForAdmin } from "@/lib/security";
import { resolveTenantByHost } from "@/lib/tenant-resolver";

export async function middleware(request: NextRequest) {
	const requestHeaders = new Headers(request.headers);
	const pathname = request.nextUrl.pathname;

	// 1. Assign unique Correlation ID for request tracing
	const requestId = crypto.randomUUID();
	requestHeaders.set("x-request-id", requestId);

	// 2. Extract and forward normalized client IP
	const clientIp = getClientIp(request.headers);
	requestHeaders.set("x-client-ip", clientIp);

	// 3. Resolve Tenant from Host Header (Edge Safe HTTP fetch)
	const host = request.headers.get("host") || "";
	const { tenant, isDevPortal } = await resolveTenantByHost(host, {
		searchParams: request.nextUrl.searchParams,
		headers: request.headers,
	});

	if (isDevPortal) {
		requestHeaders.set("x-is-dev-portal", "true");
	}

	if (tenant) {
		requestHeaders.set("x-tenant-id", tenant.id);
		requestHeaders.set("x-tenant-slug", tenant.slug);
		requestHeaders.set("x-tenant-name", tenant.display_name);
		requestHeaders.set("x-tenant-short-name", tenant.short_name || tenant.display_name);
		requestHeaders.set("x-tenant-domain", tenant.custom_domain || host);
		if (tenant.logo_url) requestHeaders.set("x-tenant-logo", tenant.logo_url);
		if (tenant.address) requestHeaders.set("x-tenant-address", tenant.address);
		if (tenant.contact_phone) requestHeaders.set("x-tenant-phone", tenant.contact_phone);
		if (tenant.contact_email) requestHeaders.set("x-tenant-email", tenant.contact_email);
		if (tenant.gstin) requestHeaders.set("x-tenant-gstin", tenant.gstin);
		requestHeaders.set("x-tenant-db-type", tenant.db_type);
		if (tenant.api_server_url) requestHeaders.set("x-tenant-api-url", tenant.api_server_url);
		if (tenant.api_server_key_encrypted) requestHeaders.set("x-tenant-api-key-enc", tenant.api_server_key_encrypted);
	} else if (!isDevPortal && !pathname.startsWith("/tenant-not-found") && !pathname.startsWith("/api/health")) {
		// Domain is unmapped / unknown and not dev portal: rewrite to 404 tenant not found
		const url = request.nextUrl.clone();
		url.pathname = "/tenant-not-found";
		return NextResponse.rewrite(url, {
			headers: {
				"x-request-id": requestId,
			},
		});
	}

	// 4. Dev Portal Root Navigation: Redirect / on Dev Portal domain directly to /admin/tenants
	if (isDevPortal && pathname === "/") {
		const url = request.nextUrl.clone();
		url.pathname = "/admin/tenants";
		return NextResponse.redirect(url, {
			headers: { "x-request-id": requestId },
		});
	}

	// 5. Admin Route & Dev Portal Protection
	if (pathname.startsWith("/admin")) {
		// Strict isolation: Client domains CANNOT access /admin
		if (!isDevPortal) {
			console.warn(`[Security] Blocked non-dev-portal host (${host}) from accessing admin route: ${pathname}`);
			const url = request.nextUrl.clone();
			url.pathname = "/tenant-not-found";
			return NextResponse.rewrite(url, {
				headers: { "x-request-id": requestId },
			});
		}

		if (!isIpAllowedForAdmin(clientIp)) {
			console.warn(`[Security] Blocked unauthorized IP access to ${pathname}: ${clientIp}`);
			return new NextResponse(
				JSON.stringify({
					error: "Forbidden",
					message: "Access restricted by IP authorization policy.",
				}),
				{
					status: 403,
					headers: { "Content-Type": "application/json", "x-request-id": requestId },
				},
			);
		}
	}

	// 5. Protect /api/debug in production environments
	if (pathname.startsWith("/api/debug")) {
		if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEBUG_ENDPOINT !== "true") {
			return new NextResponse(
				JSON.stringify({ error: "Forbidden: Debug endpoint disabled in production." }),
				{
					status: 403,
					headers: { "Content-Type": "application/json", "x-request-id": requestId },
				},
			);
		}
	}

	const response = NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});

	response.headers.set("x-request-id", requestId);
	if (tenant) {
		response.headers.set("x-tenant-slug", tenant.slug);
	}
	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, favicons/*, logo.png
		 */
		"/((?!_next/static|_next/image|favicon.ico|favicons|logo.png|.*\\.png$).*)",
	],
};
