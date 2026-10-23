# Phase 31: Architectural Hardening, Testing Suite & Production Resilience - Context

## 1. Problem Statement & Motivation
Following a comprehensive codebase audit recorded in [`.planning/codebase/CONCERNS.md`](file:///e:/work/pharmaql/.planning/codebase/CONCERNS.md), several critical architectural gaps, stability bottlenecks, and security exposures were identified:

1. **Zero Automated Testing Defense**:
   - `npm test` is unconfigured. Critical core domain logic (overdue engine, cascading blocks, ranking permissions, sliding-window rate limiters, ODBC date formatting) relies entirely on manual testing. Any regression can silently break access control or invoice calculations.
2. **Serverless Distributed State & In-Memory Isolation**:
   - `otpStore` (in `authActions.ts`), `MemoryRateLimiter` (in `rate-limit.ts`), and `presence-store.ts` keep active state in Node process memory or local filesystem JSON (`data/*.json`). In multi-instance serverless deployments (such as Vercel), requests hit different lambdas where process memory is isolated and filesystems are read-only/ephemeral (`/tmp`), leading to dropped OTPs and fragmented rate limits.
3. **Gateway Stored Procedure Safeguards**:
   - `api-server` formats stored procedure parameters directly into SQL queries without pre-validation of argument counts or types. A missing parameter (e.g. `finYear` in `rptStockandSalesStatementReport`) results in an uninformative HTTP 500 database error. Additionally, lack of query execution timeouts leaves connection pools vulnerable to pool starvation if MySQL hangs on heavy queries.
4. **Client-Side Heavy PDF Memory Pressure**:
   - [`src/lib/pdf.ts`](file:///e:/work/pharmaql/src/lib/pdf.ts) renders dense multi-page tables (3,000+ rows) entirely synchronously on the main UI thread via jsPDF and `autoTable`. On lower-end mobile devices (MR field phones), this freezes the UI thread and causes browser tab out-of-memory (OOM) crashes.
5. **Security & Reverse Proxy IP Sanitization**:
   - `getClientIp` currently uses `forwardedFor.split(",")[0]`. When deployed behind reverse proxies, an attacker can spoof `X-Forwarded-For: 127.0.0.1`, which if forwarded left-first bypasses admin IP allowlists. Strict IP extraction and explicit developer impersonation session auditing are required.

---

## 2. Technical Scope & Architecture

### A. Testing Suite (Vitest)
- Install `vitest` in root `package.json` with ESM configuration in `vitest.config.ts`.
- Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts.
- Implement comprehensive unit tests:
  - `src/lib/__tests__/overdueEngine.test.ts`: Test `calculateBlockDate`, impending block warnings (80–90 days), direct MR blocking (>90 days), division cascading blocking (>95 days), peer MR attribution, and admin exemption override.
  - `src/lib/__tests__/permissions.test.ts`: Test MR rank 1, 2, 3 capability matrix (Stock & Sales, Free Scheme, Claims, etc.) and Admin/Developer role override.
  - `src/lib/__tests__/rate-limit.test.ts`: Test sliding-window counters, window expiry, brute-force lockout, burst allowance, and reset.
  - `src/lib/__tests__/dateUtils.test.ts`: Test ODBC date conversions (`formatDateToOdbc`, ISO string handling, financial year bounds).

### B. Gateway Stored Procedure Safeguards
- In `api-server/src/utils/spValidator.ts`:
  - Build a schema-based validator for stored procedure arguments (`rptStockMovementStatement`, `rptStockandSalesStatementReport`, `rptFreeSchemePartyWiseStatementReport`).
  - Validate parameter count, date format regex (`YYYY-MM-DD`), non-empty strings, and integer IDs before constructing `CALL ...` queries.
  - Introduce connection query timeouts (`timeout: 45000` ms) on MySQL queries to prevent hanging queries from exhausting the database pool.
  - Return clear 400 Bad Request responses with detailed field-level validation errors instead of opaque 500 errors.

### C. Distributed State Adapter (Dual-Mode Key-Value)
- In `src/lib/kv-store.ts`:
  - Create a unified `KVStore` interface: `get<T>(key)`, `set(key, value, ttlSeconds?)`, `del(key)`, `has(key)`.
  - Provide an in-memory implementation (`MemoryKVStore`) as default for local development.
  - Provide an HTTP-based Upstash / Redis adapter (`RedisKVStore`) activated automatically when `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` environment variables are present.
  - Refactor `otpStore` in `src/server/actions/authActions.ts` and `MemoryRateLimiter` in `src/lib/rate-limit.ts` to use this adapter.

### D. Client-Side PDF Memory Protection & Export Safety
- In `src/lib/pdf.ts`:
  - Introduce a safety threshold for client-side rendering (e.g. max 2,500 rows per single PDF run).
  - Add chunked rendering with micro-task yielding (`await new Promise(r => setTimeout(r, 0))`) so the main thread does not freeze.
  - Provide user warning when reports exceed safe row counts, suggesting Excel/CSV export or narrower date filters.

### E. Security Hardening & Impersonation Audit
- In `src/lib/security.ts`:
  - Sanitize client IP resolution: prioritize trusted platform headers (`cf-connecting-ip`, `x-real-ip`) over generic `x-forwarded-for`, and parse the rightmost untrusted hop when configured behind reverse proxies.
- In `src/server/actions/mrInfo.ts` / `audit.ts`:
  - Ensure developer "View-As" / impersonation actions log dedicated audit events recording the developer's identity, target MR ID, client IP, and timestamp.
