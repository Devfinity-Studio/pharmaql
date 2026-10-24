# Phase 32: Strict CORS Ingress Protection & API Security Hardening - Plan

## Objective
Harden the on-premise Express API server against unauthorized cross-origin requests by implementing strict origin whitelisting via environment variables, completely disallowing wildcards, catching preflight `OPTIONS` requests before execution, strictly whitelisting headers and methods, and supporting both browser clients with credentials and non-browser server-to-server calls safely.

---

## Detailed Task Breakdown

### Task 1: Dedicated CORS Ingress Middleware (`api-server/src/middleware/cors.ts`)
- **Files**: `api-server/src/middleware/cors.ts`
- **Actions**:
  1. Create a dedicated CORS configuration module `api-server/src/middleware/cors.ts`.
  2. Implement origin parsing from `process.env.ALLOWED_ORIGINS`:
     - Split on commas, trim whitespace, filter empty values.
     - Fallback for local development (`http://localhost:3000`, `http://127.0.0.1:3000`) if not defined.
     - **Explicitly reject `*` (wildcards)**: if `*` is present or attempted, ignore it and enforce exact origin matching.
  3. Validate incoming `Origin` headers:
     - If request has **no `Origin` header** (e.g. server-to-server Next.js fetch, internal curl, health checks): **Allow** the request to proceed (no CORS headers needed on non-browser calls).
     - If request has an `Origin` header:
       - Match against `ALLOWED_ORIGINS` whitelist.
       - If matched: Set `Access-Control-Allow-Origin` dynamically to the request's exact origin.
       - If not matched: In production, return **HTTP 403 Forbidden** (`{ success: false, error: "CORS origin forbidden: Domain unauthorized." }`) or immediately terminate the request without CORS headers so the browser enforces the cross-origin block.
  4. Whitelist allowed HTTP methods:
     - `GET, POST, PUT, PATCH, DELETE, OPTIONS`
  5. Whitelist allowed headers:
     - `Content-Type, Authorization, x-api-key, x-request-id, x-client-ip`
  6. Set `Access-Control-Allow-Credentials: true` and `Access-Control-Max-Age: 86400` (cache preflight for 24h).
  7. **Early Preflight (`OPTIONS`) Termination**:
     - Catch `req.method === "OPTIONS"` directly within the middleware.
     - Send HTTP 204 No Content with all Access-Control headers.
     - Return immediately without executing downstream authentication middleware, controller logic, or database pool queries.

### Task 2: Server Entry Point Integration (`api-server/src/index.ts`)
- **Files**: `api-server/src/index.ts`
- **Actions**:
  1. Import the newly created `corsMiddleware` from `./middleware/cors`.
  2. Mount `corsMiddleware` at the top of the middleware pipeline in `api-server/src/index.ts` before body parsers and authentication.
  3. Ensure that `/health` remains accessible both to browser and non-browser monitors.
  4. Preserve all existing security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`).

### Task 3: Environment Configuration & Documentation
- **Files**: `api-server/.env.example`, `api-server/.env`
- **Actions**:
  1. Update `api-server/.env.example` with clear documentation and sample configurations for `ALLOWED_ORIGINS`:
     ```env
     # Comma-separated allowed frontend origins (NO wildcards allowed)
     ALLOWED_ORIGINS=https://app.asmeepharma.com,https://asmeepharma.com,http://localhost:3000
     ```
  2. In `api-server/.env`, ensure `ALLOWED_ORIGINS` is configured with our production domain (`https://app.asmeepharma.com`, `https://asmeepharma.com`) alongside local development origins.

### Task 4: Automated Testing & Verification Suite
- **Files**: `api-server/src/scripts/test-cors.sh` or node verification test `api-server/src/__tests__/cors.test.ts`
- **Actions**:
  1. Write tests verifying:
     - Whitelisted origin with GET/POST returns matching `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`.
     - Non-whitelisted origin returns HTTP 403 or blocks CORS headers.
     - Preflight `OPTIONS` request returns HTTP 204 with correct `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` without invoking database.
     - Non-browser request without `Origin` header proceeds normally (e.g. `/health`).
  2. Run TypeScript check and production build verification across `api-server` and `pharmaql`.

---

## Verification Criteria
- [x] Whitelisted origins receive dynamic `Access-Control-Allow-Origin: <origin>` and `Access-Control-Allow-Credentials: true`.
- [x] Non-whitelisted origin is rejected with HTTP 403 / denied CORS headers.
- [x] Wildcard (`*`) is ignored/forbidden.
- [x] `OPTIONS` preflight returns HTTP 204 immediately with 24h `Max-Age`.
- [x] Direct server-to-server calls (no `Origin` header) succeed without CORS blocks.
- [x] `pnpm build` across Next.js and api-server compile with zero errors.
