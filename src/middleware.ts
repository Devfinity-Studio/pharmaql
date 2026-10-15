import { type NextRequest, NextResponse } from "next/server";
import { getClientIp, isIpAllowedForAdmin } from "@/lib/security";

export function middleware(request: NextRequest) {
	const requestHeaders = new Headers(request.headers);

	// 1. Assign unique Correlation ID for request tracing
	const requestId = crypto.randomUUID();
	requestHeaders.set("x-request-id", requestId);

	// 2. Extract and forward normalized client IP
	const clientIp = getClientIp(request.headers);
	requestHeaders.set("x-client-ip", clientIp);

	const pathname = request.nextUrl.pathname;

	// 3. Admin Route IP Protection
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

	// 4. Protect /api/debug in production environments
	if (pathname.startsWith("/api/debug")) {
		if (process.env.NODE_ENV === "production") {
			// Require session cookie or deny
			const sessionCookie = request.cookies.get("pharmaql_session");
			if (!sessionCookie?.value) {
				return new NextResponse(
					JSON.stringify({ error: "Forbidden: Debug endpoint disabled in production." }),
					{
						status: 403,
						headers: { "Content-Type": "application/json", "x-request-id": requestId },
					},
				);
			}
		}
	}

	const response = NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});

	response.headers.set("x-request-id", requestId);
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
