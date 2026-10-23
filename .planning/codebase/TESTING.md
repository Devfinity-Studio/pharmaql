# Testing & Quality Verification

**Date Mapped:** 2026-10-23  
**Project:** PharmaQL (B2B Medicine Supplier Portal)

---

## 1. Current State of Automated Testing

- **Automated Test Runners:** Currently, there is **no Vitest, Jest, or Playwright runner** configured in the root `package.json`.
- **Quality Gates in CI/Local:**
  - **Static Type Checking:** `pnpm typecheck` (`tsc --noEmit`) ensures full TypeScript compilation integrity and catches interface/prop mismatches.
  - **Linting & Code Formatting:** `pnpm check` (`biome check .`) ensures stylistic consistency, correct syntax, organized imports, and valid JSX attributes.

---

## 2. In-App Live Diagnostic Suite

Rather than relying purely on external test suites, PharmaQL features a built-in, real-time diagnostic engine accessible through the Developer Control Center (`/admin/dev` and `src/server/actions/devDiagnostics.ts`):

### Diagnostic Capabilities
1. **Database Connectivity & Latency Probe (`testDbConnection`):**
   - Dispatches a ping query (`SELECT 1 as alive`) via `api-server` to measure round-trip latency to the on-premises MySQL instance.
2. **Stored Procedure Execution Probe (`testStoredProcedure`):**
   - Calls `rptStockMovementStatement` with mock company parameters to verify database procedure permissions, schema validity, and execution speed.
3. **Email SMTP Delivery Probe (`testSmtpConnection`):**
   - Verifies Gmail SMTP socket connectivity and credential validity (`mailer.verify()`).
4. **Resilient Storage Health Check (`testStorageHealth`):**
   - Writes, reads, and deletes a temporary probe file (`.probe_test_*.json`) via `src/lib/server-storage.ts` to confirm filesystem permissions and fallback behavior.
5. **Presence & Session Beacon Probe (`testPresenceHealth`):**
   - Validates in-memory session tracking and active presence heartbeats.

---

## 3. Manual Verification & UAT Protocols

For each phase delivery, the following critical workflows must be verified manually:

### A. Overdue & Cascading Blocking Protocol
1. **Clean State:** Verify MRs with <80-day outstanding invoices see clean KPI cards and unrestricted report access.
2. **Warning State (80–90 days):** Verify amber warning banner and modal appear alerting MR of impending block.
3. **Direct Block (>90 days):** Verify MR account is blocked immediately on login or navigation, showing the "Contact Admin" blocking screen with the offending invoice details.
4. **Division Cascading Block (>95 days):** Verify that when one MR is >95 days overdue, peer MRs sharing the same division receive a collateral block with explicit attribution to the responsible MR.
5. **Admin Exemption:** Verify that granting an exemption in `/admin/mrs` unblocks the MR immediately with the noted reason and expiry date.

### B. MR Passwordless OTP Login Protocol
1. Input MR registered email on `/login`.
2. Verify rate limiter blocks excessive OTP requests (>5 requests per 10 minutes).
3. Confirm 6-digit numeric OTP is received via Gmail SMTP.
4. Verify OTP verification produces an encrypted `pharmaql_session` cookie and redirects to `/dashboard`.

### C. Report Generation & Export Integrity
1. Open Stock Movement, Stock & Sales, and Claim Quantity reports across multiple divisions.
2. Verify client-side search, sorting, and pagination.
3. Trigger Excel export (`.xlsx`) and verify file integrity, formatting, and column alignments.
4. Trigger PDF export (`.pdf`) and verify stationery header, table pagination, and auto-table column wrapping.

### D. PWA & Offline Access
1. Toggle Chrome DevTools to "Offline".
2. Verify cached report snapshots load from IndexedDB (`pharmaql_offline_db`).
3. Verify offline banner appears.
4. Re-enable network and verify automatic synchronization.

---

## 4. Recommended Automated Testing Roadmap

To harden production reliability, the following testing layers should be introduced:

1. **Unit Testing with Vitest:**
   - Test pure business logic functions: `overdueEngine.ts` (calculation of auto-block dates, cascading status), `permissions.ts` (rank matrix), `rate-limit.ts` (sliding window buckets), and `dateUtils.ts` (ODBC conversions).
2. **Integration Testing for API Server:**
   - Supertest suites targeting `api-server` endpoints (`/health`, `/api/reports/*`, `/api/auth/*`) using a test MySQL container or mock connection pool.
3. **End-to-End Testing with Playwright:**
   - Automated browser tests simulating MR login, report tab switching, export downloads, and Admin MR management.
