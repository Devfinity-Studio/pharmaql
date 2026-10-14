# Phase 22: Audit & Security Hardening - Context & Requirements

## Objectives
Enhance the security posture, operational visibility, and resilience of the PharmaQL platform without affecting the read-only integrity of the underlying legacy ERP database.

---

## 1. Rate Limiting Engine
- **Target Endpoints**:
  - OTP Request (`/api/auth/otp` or equivalent authentication server actions) - Prevent SMS/Email abuse and credential stuffing.
  - Admin & Login verification endpoints - Prevent brute-force attempts on credentials and OTPs.
  - Unblock Action modal endpoint - Prevent brute-forcing emergency unlock PIN/passwords.
  - Heavy Report Exports (PDF & Excel endpoints `/api/reports/download-*`) - Prevent DoS/query exhaustion by automated scrapers.
- **Implementation Strategy**:
  - In-memory sliding window / token bucket algorithm with configurable thresholds (or local cache).
  - Clear standard HTTP rate limit headers (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`).
  - Graceful UI feedback when throttled ("Too many attempts. Please try again in X seconds.").

---

## 2. HTTP Security Headers
- **Headers to Enforce**:
  - `Content-Security-Policy`: Restrict unauthorized script execution and framing.
  - `Strict-Transport-Security` (HSTS): Enforce HTTPS connections.
  - `X-Content-Type-Options: nosniff`: Prevent MIME-type sniffing.
  - `X-Frame-Options: DENY`: Prevent clickjacking attacks.
  - `Referrer-Policy: strict-origin-when-cross-origin`: Prevent leak of internal URLs and parameters.
  - `Permissions-Policy`: Disable unused browser features (camera, microphone, geolocation).
- **Placement**:
  - Next.js configuration (`headers()` in `next.config.js`) or Edge / API Middleware to ensure headers are injected across all static, dynamic, and API routes.

---

## 3. Enhanced Session Tracking & Access Logging
- **Tracked Parameters**:
  - Client IP (supporting proxy headers `x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`).
  - User-Agent and device context.
  - Auth event types: Login attempt, Login success, Login failure, OTP request, Session invalidation, Token renewal.
- **Storage & Isolation**:
  - Strict isolation: zero writes to the legacy ERP database (`pdyasvmaster` remains strictly 100% read-only).
  - Use structured JSON logs / rotating local storage in `data/audit-logs.json` or dedicated server-side logger.

---

## 4. Admin Route Protection & IP Allowlisting
- **IP Configuration**:
  - Support configurable CIDR / IP list via environment variables (e.g. `ADMIN_ALLOWED_IPS`).
  - If configured, restrict sensitive `/admin` administrative actions or display alerts if accessed from unrecognized network locations.
  - Allow local dev environments (`127.0.0.1`, `::1`) by default.

---

## 5. Unblock Exemption Audit Trail
- **Traceability**:
  - Every unblock action (temporary MR/Customer access exemption past 90 days) must capture:
    - Target MR Code / Customer Code
    - Operator / Admin identifier
    - Reason provided in modal
    - Exemption expiry / timestamp
    - Originating client IP
  - Persisted in structured audit log records for administrative inspection.

---

## 6. Verification & Quality Gates
- Test brute force limits against OTP generation (e.g. 5 attempts in 5 minutes).
- Test rapid download triggers to verify rate limiting responses.
- Verify security headers with `curl -I` or automated checks.
- Verify that `pnpm run build` passes with zero errors and clean bundle output.
