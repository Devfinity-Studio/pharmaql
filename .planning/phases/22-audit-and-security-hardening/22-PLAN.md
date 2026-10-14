# Phase 22: Audit & Security Hardening Plan

## Objective
Harden PharmaQL's security posture, prevent brute-force attacks, protect administrative operations, establish an immutable audit logging trail, and inject industry-standard HTTP security headers across all web and export endpoints—while maintaining 100% read-only integrity for the legacy ERP database.

---

## Execution Tasks

### Task 1: HTTP Security Headers & Next.js Middleware Pipeline
- **File**: `next.config.js`
  - Define custom `headers()` returning strict security headers for all routes (`/:path*`):
    - `Content-Security-Policy`: Restrict scripts to self, inline styles/fonts for Tailwind & Google Fonts, frame ancestors `none`.
    - `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`.
    - `X-Content-Type-Options`: `nosniff`.
    - `X-Frame-Options`: `DENY` (prevent clickjacking across report dashboards).
    - `Referrer-Policy`: `strict-origin-when-cross-origin`.
    - `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), browsing-topics=()`.
- **Create**: `src/middleware.ts`
  - Intercept incoming requests to assign a unique `X-Request-Id` for tracing.
  - Enforce session checking on protected routes (`/admin/*`, `/dashboard/*`).
  - Restrict `/api/debug` in production environments or require active Admin session.
  - Forward sanitized client IP (`x-forwarded-for`, `x-real-ip`, or `127.0.0.1`) down to server action context via headers.

---

### Task 2: Core In-Memory Rate Limiting Engine
- **Create**: `src/lib/rate-limit.ts`
  - Implement a sliding window token bucket / timestamp record store:
    - In-memory Map keyed by `action:identifier` (e.g. `otp:ip`, `login:ip`, `export:userId`).
    - Periodic auto-pruning of expired windows to prevent memory leaks.
  - Provide reusable helper functions:
    - `checkRateLimit(key: string, limit: number, windowSeconds: number)`
    - Returns `{ success: boolean, remaining: number, resetInSeconds: number }`.
  - Add predefined profiles:
    - `AUTH_OTP_REQUEST`: 5 requests per 10 minutes.
    - `AUTH_OTP_VERIFY`: 5 attempts per 15 minutes (with lockout).
    - `AUTH_LOGIN_CREDENTIALS`: 5 failed attempts per 15 minutes.
    - `ADMIN_UNBLOCK_ACTION`: 5 attempts per 15 minutes.
    - `REPORT_DOWNLOAD`: 30 exports per 5 minutes per user/IP.

---

### Task 3: Authentication & Brute-Force Mitigation
- **File**: `src/server/actions/authActions.ts`
  - **`requestMrOtp`**:
    - Extract client IP from headers.
    - Enforce rate limit per IP and per target email/mobile.
    - Return user-friendly throttling error if limit exceeded: `"Too many OTP requests. Please wait X seconds before trying again."`.
    - Audit log the request event.
  - **`verifyMrOtp`**:
    - Track failed attempts per email. If failed >= 5 times, lock OTP verification for 15 minutes and invalidate active code.
    - Audit log successful vs. failed OTP verification attempts with client IP and user-agent.
  - **`loginAdminOrDev`**:
    - Enforce rate limiting on bad credential attempts per IP.
    - Audit log login attempts (both successful and failed) with operator identity and IP.

---

### Task 4: Sensitive Actions & Report Export Throttling
- **File**: `src/server/actions/adminUnblockActions.ts`
  - Wrap `secureAdminUnblockMR` with brute-force rate limiting on password checks.
  - Record full audit trail for every unblock execution:
    - Admin email, target MR, reason, exemption duration, client IP, timestamp.
- **Files**:
  - `src/app/api/reports/download-stock/route.ts`
  - `src/app/api/reports/download-sales/route.ts`
  - `src/app/api/reports/download-outstanding/route.ts`
  - Apply `REPORT_DOWNLOAD` rate limiter per session user / IP.
  - Return HTTP 429 Too Many Requests with standard `Retry-After` header when limit exceeded.
  - Audit log bulk download activity (report type, filters, MR ID, file format).

---

### Task 5: Persistent Audit Logging & Session Tracking
- **Create**: `src/lib/audit-logger.ts`
  - Define schema `AuditLogEntry`:
    - `id`: UUID string.
    - `timestamp`: ISO-8601 string.
    - `event`: Event type enum (`AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`, `OTP_REQUEST`, `OTP_VERIFY_FAILURE`, `ADMIN_UNBLOCK`, `RATE_LIMIT_BLOCKED`, `EXPORT_DOWNLOAD`, `SECURITY_WARNING`).
    - `userId`: string or null.
    - `userEmail`: string or null.
    - `role`: string or null.
    - `ip`: string.
    - `userAgent`: string.
    - `details`: Record<string, any>.
  - Storage: Store entries in `data/audit_logs.json`.
  - Maintain rolling retention (keep latest 1,000 entries) with safe atomic file writes.
  - Expose query functions: `recordAuditEvent(entry)` and `getRecentAuditLogs(limit, filter)`.
- **Create**: `src/app/admin/audit/page.tsx` (or integrated Audit tab in Admin portal)
  - Display real-time security events, authentication attempts, export downloads, and unblock overrides with filterable badges and timestamps.

---

### Task 6: Admin Route Protection & IP Allowlisting
- **File**: `src/lib/security.ts`
  - Parse `ADMIN_ALLOWED_IPS` from environment (supports comma-separated IPs or CIDRs).
  - Provide `isIpAllowedForAdmin(clientIp: string): boolean`.
  - If `ADMIN_ALLOWED_IPS` is empty or not configured, bypass restriction (log warning in audit trail).
  - If configured and client IP is not in allowlist, block access with 403 Forbidden and record `SECURITY_WARNING` event.

---

### Task 7: Express API Server Hardening
- **File**: `api-server/src/index.ts`
  - Add Helmet middleware or security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`).
  - Ensure constant-time comparison for `API_SECRET_KEY` Bearer authentication to prevent timing attacks.
  - Restrict CORS origin to configured frontend origins (`process.env.FRONTEND_URL` / `localhost:3000`).

---

### Task 8: Verification & Quality Gates
1. Run `pnpm exec tsc --noEmit` across Next.js and API server to verify zero TypeScript errors.
2. Test rate limiting triggers:
   - Attempt 6 rapid OTP requests and verify HTTP 429 / error response.
   - Attempt repeated invalid logins and verify lockout.
3. Test security headers:
   - Verify CSP, HSTS, X-Frame-Options, X-Content-Type-Options with `curl -I`.
4. Test Audit Log generation:
   - Trigger a login, an export, and an unblock override, and confirm entries are accurately appended to `data/audit_logs.json`.
5. Run full production build (`pnpm run build`) to ensure all routes and SSR pages compile cleanly.
