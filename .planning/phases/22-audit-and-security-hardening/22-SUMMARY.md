# Phase 22 Summary: Audit & Security Hardening

## Overview
Phase 22 implemented enterprise-grade security hardening, brute-force mitigation, IP allowlisting, HTTP security headers, request tracing, and an isolated structured audit logging engine with a dedicated Admin Audit Log viewer—while strictly adhering to 100% read-only integrity for the legacy ERP database (`pdyasvmaster`).

---

## Deliverables & Key Changes

### 1. HTTP Security Headers (`next.config.js`)
Configured industry-standard security headers for all routes (`/:path*`):
- `Content-Security-Policy`: Restricts scripts, inline styles, fonts, Vercel analytics, frames (`frame-ancestors 'none'`), objects (`object-src 'none'`), and forms.
- `Strict-Transport-Security` (HSTS): `max-age=63072000; includeSubDomains; preload`.
- `X-Content-Type-Options`: `nosniff`.
- `X-Frame-Options`: `DENY` (protects all reports and admin dashboards against clickjacking).
- `Referrer-Policy`: `strict-origin-when-cross-origin`.
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), browsing-topics=()`.

### 2. Next.js Edge/Node Middleware Pipeline (`src/middleware.ts`)
- **Correlation ID**: Generates a cryptographically random UUID (`x-request-id`) for every request, returned in response headers and forwarded downstream.
- **Client IP Normalization**: Sanitizes and extracts client IP (`cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`) and attaches `x-client-ip`.
- **Admin Route Protection**: Evaluates client IP against `ADMIN_ALLOWED_IPS` policy (supporting individual IPs, wildcard subnets, CIDR /24 blocks).
- **Debug Route Lockdown**: Restricts `/api/debug` in production environments, requiring an active admin session.

### 3. In-Memory Sliding-Window Rate Limiting Engine (`src/lib/rate-limit.ts`)
Zero-write memory-based sliding token bucket store with automatic 60-second pruning:
- **`rateLimitOtpRequest`**: Enforces max 5 OTP generation requests per 10 minutes per IP & email/phone.
- **`checkOtpVerifyAllowed` & `recordOtpVerifyFailure`**: 5 consecutive invalid OTP attempts trigger an automatic 15-minute account & IP lockout.
- **`checkLoginAllowed` & `recordLoginFailure`**: 5 failed credential attempts lock admin/dev authentication for 15 minutes.
- **`checkAdminUnblockAllowed` & `recordAdminUnblockFailure`**: Protects master password verification on unblock actions.
- **`rateLimitReportDownload`**: Limits bulk PDF/Excel downloads to max 30 exports per 5 minutes per user/IP, returning HTTP 429 with standard `Retry-After` header.

### 4. Authentication & Sensitive Action Hardening
- **`src/server/actions/authActions.ts`**:
  - `requestMrOtp`: Rate limited and logs `OTP_REQUEST` and `RATE_LIMIT_EXCEEDED` events.
  - `verifyMrOtp`: Brute-force protected with lockout, logging `OTP_VERIFY_SUCCESS`, `OTP_VERIFY_FAILURE`, and `AUTH_LOGIN_SUCCESS`.
  - `loginAdminOrDev`: Lockout protected per IP, logging `AUTH_LOGIN_SUCCESS` and `AUTH_LOGIN_FAILURE`.
  - `logoutUser`: Logs `AUTH_LOGOUT`.
- **`src/server/actions/adminUnblockActions.ts`**:
  - Validates `isIpAllowedForAdmin`, checks rate limits, and persists `ADMIN_UNBLOCK` audit events with operator email, target MR, reason, and exemption duration.
- **`src/app/api/reports/download-*`**:
  - All download endpoints (`download-stock`, `download-sales`, `download-outstanding`) check report export rate limits and log `EXPORT_DOWNLOAD` and `RATE_LIMIT_EXCEEDED` events.

### 5. Persistent Audit Logging & Admin Viewer (`src/lib/audit-logger.ts`, `src/app/admin/audit/page.tsx`)
- Structured JSON storage in `data/audit_logs.json` (git-ignored, keeping latest 1,000 entries with thread-safe atomic queue).
- Event categories: `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`, `AUTH_LOGOUT`, `OTP_REQUEST`, `OTP_VERIFY_SUCCESS`, `OTP_VERIFY_FAILURE`, `ADMIN_UNBLOCK`, `RATE_LIMIT_EXCEEDED`, `SECURITY_WARNING`, `EXPORT_DOWNLOAD`.
- **Admin UI**: Dedicated route `/admin/audit` with real-time metric cards (total events, successful logins, failures, rate limits, unblocks), search filter across IPs/emails/details, event-type selector, and visual badges.
- **Navigation Integration**: Added "Security & Audit" with `Shield` icon to `CollapsibleSidebar` in admin panel.

### 6. Express API Server Hardening (`api-server/src/index.ts`, `api-server/src/middleware/auth.ts`)
- Timing-safe Bearer token authentication via `crypto.timingSafeEqual` with buffer length matching.
- Global security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`).
- In-memory rate limiting (180 requests/minute per client IP) to protect the MySQL connection pool from exhaustion.
- CORS origin restriction to configured frontend origins.

---

## Verification & Quality Gates
1. **Automated Security Test Suite**:
   - IP extraction (`cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`) validated.
   - Admin IP allowlisting (unrestricted, exact, wildcard, CIDR) validated.
   - OTP request rate limiter (throttled at 6th request) validated.
   - OTP brute-force lockout (locked at 5th failure, reset on success) validated.
   - Audit logger serialization and sliding retrieval validated.
2. **TypeScript Compilation**:
   - `api-server`: `npm run build` exits 0 with 0 errors.
   - Root project: `pnpm exec tsc --noEmit` exits 0 with 0 errors.
3. **Production Next.js Build**:
   - `pnpm run build` exits 0 with all 14 routes generated, middleware compiled (`34.5 kB`), and new `/admin/audit` route generated (`3.88 kB`).
4. **Database Write Audit**:
   - Confirmed 0 writes to the legacy ERP MySQL database (`pdyasvmaster`). All rate limiting and audit state resides in isolated memory and local files.
