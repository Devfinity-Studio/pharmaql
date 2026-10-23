# Concerns, Technical Debt & Risk Analysis

**Date Mapped:** 2026-10-23  
**Project:** PharmaQL (B2B Medicine Supplier Portal)

---

## 1. Architectural Fragility & Technical Debt

### A. Heavy Reliance on Legacy Stored Procedures
- **Vulnerability:** PharmaQL delegates core business calculations (Stock Balances, Free Scheme claims, Overdue aging) to legacy MySQL stored procedures (`pdyasvtrans.rptStockMovementStatement`, etc.).
- **SQL Mode Quirks:** These procedures fail unless `SET sql_mode = ''` is explicitly executed on the connection session prior to invocation.
- **Risk:** Any undocumented schema or procedure modifications made directly on the client's ERP database will immediately impact report rendering. Parameter count or type mismatches trigger opaque ODBC/MySQL error codes.

### B. In-Memory State in Serverless Environments
- **The Issue:**
  - `otpStore` (in `src/server/actions/authActions.ts`): Stores pending 6-digit OTPs in a JavaScript `Map`.
  - `MemoryRateLimiter` (in `src/lib/rate-limit.ts`): Tracks rate-limit windows in local process memory.
  - `presenceStore` (in `src/lib/presence-store.ts`): Tracks active user heartbeats in memory.
- **Impact on Vercel / Multi-Instance Deployments:** In a serverless environment with multiple concurrent Lambda instances, process memory is **not shared**. An MR requesting an OTP on Lambda A may submit the verification request to Lambda B, resulting in an "OTP expired or invalid" failure.
- **Remediation:** Introduce an external key-value store (e.g., Upstash Redis, Redis Cloud) for distributed OTP, rate limiting, and presence tracking.

### C. Split-Brain Persistence (MySQL + JSON Files)
- **The Issue:** Master and transactional records reside in MySQL, while runtime overrides, licenses, audit logs, feature flags, and notices reside in local JSON files in `data/`.
- **Serverless Filesystem Restrictions:** On Vercel, the application filesystem is read-only (`EROFS`). While `src/lib/server-storage.ts` provides a fallback to `/tmp/pharmaql-data`, data stored in `/tmp` is ephemeral and does not persist across container cold starts or regional deployments.
- **Remediation:** Migrate JSON-stored state (audit logs, overrides, notices, licenses) into a dedicated MySQL schema table or managed cloud storage.

---

## 2. Performance & Scalability Bottlenecks

### A. Client-Side Heavy PDF Generation
- **The Issue:** PDF generation (`src/lib/pdf.ts`, 75 KB) executes entirely in the client's browser using `jspdf` and `jspdf-autotable`.
- **Impact:** For large reports spanning thousands of invoice line items, generating high-resolution vector tables can consume substantial memory, resulting in browser freezing or crashes on field MR mobile devices.
- **Remediation:** Offload large PDF document rendering to a streaming server-side job or paginate PDF exports into manageable batch sizes.

### B. Database Connection Pool Saturation
- **The Issue:** `api-server` maintains a fixed `mysql2` pool limit of 25 connections.
- **Risk:** During peak month-end reporting windows or when multiple MRs execute heavy stored procedures simultaneously, the connection pool can become saturated, resulting in request queuing or gateway timeouts.
- **Remediation:** Implement query timeout limits, tune connection pool size, and leverage Redis caching for frequently accessed historical reports.

---

## 3. Security Considerations

### A. Developer Impersonation & Backdoor Risk
- **The Mechanism:** Developers can impersonate any MR via the Developer Control Center using the `pharmaql_impersonate` cookie.
- **Risk:** If developer credentials (`DEV_EMAIL`, `DEV_PASSWORD`) are compromised, an attacker gains unrestricted visibility into all MR sales, customer names, and pricing schemes.
- **Mitigation:** Ensure developer passwords use high-entropy secrets in production `.env` and restrict `/admin/dev` access via IP allowlisting.

### B. Reverse Proxy Header Spoofing
- **The Mechanism:** IP allowlisting in `src/middleware.ts` extracts the client IP via `getClientIp()` examining headers (`x-forwarded-for`, `x-real-ip`).
- **Risk:** If the upstream reverse proxy (Caddy / Vercel Edge) is misconfigured or permits clients to supply their own `X-Forwarded-For` header without rewriting, IP-based authorization can be bypassed.
- **Mitigation:** Ensure reverse proxies overwrite `X-Forwarded-For` with the true connecting socket address.

### C. MR Data Inaccuracies in ERP
- **The Issue:** MR login strictly depends on their email address matching the `EmailId` column in `pdyasvmaster.l_mktcompany_mr`.
- **Operational Reality:** In legacy ERPs, MR emails are frequently missing, misspelled, or shared among staff.
- **Remediation:** The system provides fallback lookup on mobile number and exposes the Admin MR Management screen (`/admin/mrs`) to allow admins to correct contact information.

---

## 4. Test Coverage Gaps

- **Lack of Automated Testing:** The repository has zero automated unit or integration tests (`npm test` is not configured).
- **Risk:** Modifications to complex cascading logic (`overdueEngine.ts`) or financial calculations could introduce silent regressions without warning.
- **Priority Action:** Introduce Vitest for business logic and Playwright for critical user journeys (login, reporting, unblock).
