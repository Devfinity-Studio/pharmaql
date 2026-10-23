# Phase 31: Architectural Hardening, Testing Suite & Production Resilience - Plan

## Objective
Establish a rock-solid automated testing suite (Vitest), enforce parameter validation and query timeouts for stored procedures in `api-server`, implement a dual-mode distributed Key-Value adapter for serverless resilience, safeguard client-side PDF generation from memory exhaustion, and harden reverse-proxy IP extraction and developer impersonation auditing.

---

## Detailed Task Breakdown

### Task 1: Vitest Setup & Core Domain Test Suites
- **Files**: `package.json`, `vitest.config.ts`, `src/lib/__tests__/overdueEngine.test.ts`, `src/lib/__tests__/permissions.test.ts`, `src/lib/__tests__/rate-limit.test.ts`, `src/lib/__tests__/dateUtils.test.ts`
- **Actions**:
  1. Add `vitest` to `devDependencies` and configure `vitest.config.ts` with path aliases (`@/*` mapping to `./src/*`).
  2. Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to root `package.json`.
  3. Write tests for `overdueEngine.ts`:
     - Test `calculateBlockDate` with valid ISO strings and fallback date offsets.
     - Test direct blocking condition: invoice with net balance (`Amount - AdjAmt > 0`) and `OverDays > 90`.
     - Test division cascading blocking condition: peer invoice with `OverDays > 95` blocks other MRs in the division and attributes `responsibleMrName`, `responsibleInvoiceNo`, and `responsibleAmount`.
     - Test that peer invoices with `91-95` days overdue do **not** trigger division cascading block (calibrated boundary).
     - Test that active Admin exemptions (`hasAdminExemption: true`) override blocking.
  4. Write tests for `permissions.ts`:
     - Test MR Rank 1 allowed/denied tabs (Stock & Sales allowed, Claim and others restricted).
     - Test MR Rank 2 allowed/denied tabs (Stock & Sales, Claim allowed).
     - Test MR Rank 3 allowed/denied tabs (all reports allowed).
     - Test Admin and Developer roles bypass all rank restrictions.
  5. Write tests for `rate-limit.ts`:
     - Test sliding window increments and limit breaches.
     - Test window reset when time advances.
     - Test brute-force lockouts and IP resets.
  6. Write tests for `dateUtils.ts`:
     - Test `formatDateToOdbc` with ISO dates, partial dates, and year rollover.
     - Test edge cases (leap years, month padding, financial year boundaries).

### Task 2: Stored Procedure Parameter Validation & Timeout Safeguards
- **Files**: `api-server/src/utils/spValidator.ts`, `api-server/src/routes/reports.ts`
- **Actions**:
  1. Create `api-server/src/utils/spValidator.ts` providing parameter validation schemas for:
     - `rptStockMovementStatement` (10 parameters: compNo, locParam, finYearCode, odbcFinYearStart, odbcFromDate, odbcToDate, compCodeParam, empty, empty, rateType).
     - `rptStockandSalesStatementReport` (11 parameters: compNo, locParam, finYearCode, odbcFinYearStart, odbcFromDate, odbcToDate, compCodeParam, finYear, empty, empty, rateType).
     - `rptFreeSchemePartyWiseStatementReport` (9 parameters: compNo, locParam, finYearCode, odbcFinYearStart, odbcFromDate, odbcToDate, compCodeParam, mrNoParam, partyNoParam).
  2. Validate that required parameters are defined, valid types, and date strings match `YYYY-MM-DD`.
  3. Reject invalid parameter sets immediately with HTTP 400 and a structured error message (`{ success: false, error: "Validation Error", details: [...] }`), avoiding invalid SQL generation.
  4. Add a query execution timeout (`{ sql: ..., timeout: 45000 }`) on all stored procedure queries to prevent hanging connection pool leaks.

### Task 3: Dual-Mode Key-Value Adapter for Serverless State
- **Files**: `src/lib/kv-store.ts`, `src/server/actions/authActions.ts`, `src/lib/rate-limit.ts`
- **Actions**:
  1. Create `src/lib/kv-store.ts` implementing a unified `KVStore` interface:
     - Methods: `get<T>(key: string): Promise<T | null>`, `set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>`, `del(key: string): Promise<void>`.
     - In-memory implementation with TTL auto-cleanup as the default fallback.
     - Upstash / Redis REST adapter when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`) are configured.
  2. Refactor `otpStore` in `src/server/actions/authActions.ts` to use `kvStore`, ensuring OTP verification works seamlessly across multiple serverless lambda instances.
  3. Integrate `kvStore` into `rate-limit.ts` so rate limit state can be backed by distributed KV in production.

### Task 4: Client-Side PDF Memory Protection & Export Safety
- **Files**: `src/lib/pdf.ts`, `src/components/reports/export-actions.tsx`
- **Actions**:
  1. In `src/lib/pdf.ts`, introduce row safety thresholds:
     - If dataset exceeds 2,500 rows, show a warning modal or toast: "Large dataset detected (X rows). Generating this PDF may slow down mobile devices. We recommend exporting as Excel/CSV or filtering by date."
     - Allow user to either proceed with capped PDF (first 2,500 rows) or switch to Excel export.
  2. Implement micro-task yielding (`await new Promise(r => setTimeout(r, 0))`) in the PDF preparation loops to avoid blocking the main browser thread.
  3. Ensure memory is freed by clearing temporary canvas/table buffers after document generation.

### Task 5: Security Hardening (Reverse Proxy IP Extraction & Impersonation Audit)
- **Files**: `src/lib/security.ts`, `src/middleware.ts`, `src/server/actions/mrInfo.ts`
- **Actions**:
  1. In `src/lib/security.ts`:
     - Refactor `getClientIp` to prevent `X-Forwarded-For` spoofing.
     - Prioritize trusted cloud headers: `cf-connecting-ip`, `x-real-ip`.
     - For `x-forwarded-for`, sanitize and handle reverse proxy chains safely.
  2. In `src/server/actions/mrInfo.ts` / developer impersonation handler:
     - Log an explicit `DEVELOPER_IMPERSONATION` audit event to `data/audit_log.json` recording developer user ID, impersonated MR ID, MR name, client IP, and timestamp.
     - Add a visual banner in the UI whenever an active impersonation session is underway.

### Task 6: Verification & End-to-End Validation
- **Actions**:
  1. Run `pnpm test` (or `npm test`) to ensure 100% pass on all unit tests.
  2. Run TypeScript check (`pnpm exec tsc --noEmit`) on Next.js frontend.
  3. Run TypeScript check (`tsc`) on `api-server`.
  4. Run production build (`pnpm build`).
  5. Commit and push all changes to `localdb` and `prod`.
