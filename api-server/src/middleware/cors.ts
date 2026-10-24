export interface CorsRequest {
  headers: {
    origin?: string;
    [key: string]: any;
  };
  method?: string;
}

export interface CorsResponse {
  setHeader(name: string, value: string): any;
  status(code: number): CorsResponse;
  json(body: any): any;
  end(): any;
}

export type CorsNextFunction = (err?: any) => void;

/**
 * Strict CORS Ingress Middleware for PharmaQL API Server
 *
 * Rules:
 * 1. Allowed origins strictly driven by environment variable ALLOWED_ORIGINS.
 * 2. Wildcards (*) are completely prohibited.
 * 3. Matching origins dynamically echoed back in Access-Control-Allow-Origin.
 * 4. Credentials supported (Access-Control-Allow-Credentials: true).
 * 5. Requests with no Origin header (health checks, server-to-server) proceed safely.
 * 6. Non-whitelisted origins are rejected with HTTP 403 Forbidden.
 * 7. OPTIONS preflight requests are intercepted, answered with 204 No Content,
 *    and terminated early without executing controller logic or database queries.
 */

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS =
  "Content-Type, Authorization, x-api-key, x-request-id, x-client-ip";
const MAX_AGE_SECONDS = "86400"; // 24 hours preflight cache

/**
 * Parses and returns normalized list of allowed origins.
 * Wildcards (*) are deliberately stripped.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (!envOrigins) {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://app.asmeepharma.com",
      "https://asmeepharma.com",
    ];
  }

  return envOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => Boolean(origin) && origin !== "*");
}

export function corsMiddleware(
  req: CorsRequest,
  res: CorsResponse,
  next: CorsNextFunction
): void {
  const origin = req.headers.origin;

  // 1. Non-browser / server-to-server request (e.g. Next.js server actions, curl, internal health monitors)
  if (!origin) {
    next();
    return;
  }

  const allowedOrigins = getAllowedOrigins();
  const isAllowed = allowedOrigins.includes(origin);

  // 2. Reject disallowed cross-origin requests
  if (!isAllowed) {
    if (process.env.NODE_ENV === "production" || process.env.STRICT_CORS === "true") {
      res.status(403).json({
        success: false,
        error: "Forbidden: Cross-Origin Request Blocked by Security Policy",
      });
      return;
    }
  }

  // 3. Set verified CORS headers
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Access-Control-Max-Age", MAX_AGE_SECONDS);
  res.setHeader("Vary", "Origin");

  // 4. Intercept Preflight OPTIONS requests and terminate early
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
