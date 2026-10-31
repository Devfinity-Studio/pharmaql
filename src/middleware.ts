import { type NextRequest, NextResponse } from "next/server";
import { getClientIp, isIpAllowedForAdmin } from "@/lib/security";
import { resolveTenantByHost } from "@/lib/tenant-resolver";
import { normalizeApiUrl } from "@/lib/utils";

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
		if (tenant.primary_color) requestHeaders.set("x-tenant-primary-color", tenant.primary_color);
		if (tenant.accent_color) requestHeaders.set("x-tenant-accent-color", tenant.accent_color);
		if (tenant.address) requestHeaders.set("x-tenant-address", tenant.address);
		if (tenant.contact_phone) requestHeaders.set("x-tenant-phone", tenant.contact_phone);
		if (tenant.contact_email) requestHeaders.set("x-tenant-email", tenant.contact_email);
		if (tenant.support_email) requestHeaders.set("x-tenant-support-email", tenant.support_email);
		if (tenant.user_email_domain) requestHeaders.set("x-tenant-email-domain", tenant.user_email_domain);
		if (tenant.gstin) requestHeaders.set("x-tenant-gstin", tenant.gstin);
		requestHeaders.set("x-tenant-db-type", tenant.db_type);
		if (tenant.api_server_url) requestHeaders.set("x-tenant-api-url", normalizeApiUrl(tenant.api_server_url));
		if (tenant.api_server_key_encrypted) requestHeaders.set("x-tenant-api-key-enc", tenant.api_server_key_encrypted);
		if (tenant.legacy_db_name) requestHeaders.set("x-tenant-legacy-db", tenant.legacy_db_name);
		if (tenant.erp_software_type) requestHeaders.set("x-tenant-erp-type", tenant.erp_software_type);
		if (tenant.comp_no !== undefined && tenant.comp_no !== null) requestHeaders.set("x-tenant-comp-no", String(tenant.comp_no));
		if (tenant.loc_no !== undefined && tenant.loc_no !== null) requestHeaders.set("x-tenant-loc-no", String(tenant.loc_no));
		if (tenant.overdue_direct_block_days) requestHeaders.set("x-tenant-overdue-direct", String(tenant.overdue_direct_block_days));
		if (tenant.overdue_division_block_days) requestHeaders.set("x-tenant-overdue-division", String(tenant.overdue_division_block_days));
		if (tenant.overdue_blocking_disabled) {
			requestHeaders.set("x-tenant-overdue-blocking", "disabled");
		} else {
			requestHeaders.set("x-tenant-overdue-blocking", "enabled");
		}
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

	// 4. Dev Portal vs Client Portal Route Partitioning:
	if (isDevPortal) {
		// On Dev Portal host, root / navigates to the Dev Control Center
		if (pathname === "/") {
			const url = request.nextUrl.clone();
			url.pathname = "/admin/tenants";
			return NextResponse.redirect(url, {
				headers: { "x-request-id": requestId },
			});
		}
	} else {
		// On Client Portal host, block access to Dev Control Center
		if (pathname.startsWith("/admin/tenants")) {
			console.warn(`[Security] Blocked client host (${host}) from accessing Dev Control Center: ${pathname}`);
			const url = request.nextUrl.clone();
			url.pathname = "/tenant-not-found";
			return NextResponse.rewrite(url, {
				headers: { "x-request-id": requestId },
			});
		}
	}

	// 5. Admin Route IP Protection
	if (pathname.startsWith("/admin")) {
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
		 * - favicon.ico, favicons/*, devfinity.png
		 */
		"/((?!_next/static|_next/image|favicon.ico|favicons|devfinity.png|.*\\.png$).*)",
	],
};
