# Phase 47: Admin Overdue Controls, MR Max Data History Limit & Unrestricted Admin Reports - Verification & UAT

## Phase Summary
- **Phase Objective**:
  1. Link Expiry and Overdue reports to Rank 1 and above (`rank >= 1`), granting MRs access out of the box.
  2. Grant Admins complete, unrestricted visibility across all report tabs when viewing any MR (`/admin/mrs/[id]`), bypassing individual MR rank/permission blocks.
  3. Provide an Admin Policy Settings panel in `/admin/mrs` to configure Overdue Blocking (enforce/disable), Direct block days, Division block days, and Max historical data window in days (`maxDataDays`).
  4. Enforce `maxDataDays` cutoff both client-side (`DateRangePicker` input min attribute & preset clamping) and server-side (`apiPost`, `apiGet`, and all download routes).

---

## Verification Results

### 1. Automated Tests & Type Checking
- **TypeScript**: `pnpm exec tsc --noEmit` -> Passed with 0 errors.
- **Unit & Integration Tests**: `pnpm test` -> 25 test suites passed, 151 tests passed.
  * `permissions.test.ts`: Verified Rank 1 and Rank 2 include `canViewExpiry: true` and `canViewOverdue: true`.
  * `dateUtils.test.ts`: Verified `calculateMaxDataCutoff` and `sanitizeDateRangeForRole` clamping logic for MRs vs Admins.
  * `overduePolicy.test.ts`: Verified `getOverduePolicyAction` and `updateTenantPolicyAction` reading/writing policy with fallback defaults.
  * `tenantActions.test.ts`: 20 tests verified tenant persistence including `max_data_days` in control plane DB and local file fallback.
- **Production Build**: `pnpm build` (`next build`) -> Passed (`Compiled successfully`, 20/20 static pages generated).

---

## User Acceptance Testing (UAT) Checklist

| Feature | Scenario | Verification Method | Status |
|---|---|---|---|
| **Rank 1 Permissions** | MR with Rank 1 logs in | Expiry & Overdue tabs/nav appear in header/mobile nav; reports load without permission error | PASS |
| **Admin Unrestricted View** | Admin views Rank 1 or restricted MR via `/admin/mrs/[id]` | `isAdminView={true}` passed; all reports (Overview, Stock, Stock & Sales, Party, Product, Free Schemes, Overdue, Expiry) render with live data | PASS |
| **Admin Policy Settings** | Admin navigates to `/admin/mrs` | Policy card renders toggle for Overdue blocking, inputs for direct block days, division block days, and max data days | PASS |
| **Save Policy Updates** | Admin updates max data days to 60 | Changes persist across Neon DB and local store; toast notification confirms update | PASS |
| **Date Clamping (Client)** | MR opens `DateRangePicker` with `maxDataDays = 60` | Input `min` attribute set to `today - 60d`; presets (Last Month, 90 Days, FY) clamped to cutoff date | PASS |
| **Date Clamping (Server)** | MR alters URL params or API payload to request older data | `apiPost`, `apiGet`, and `/api/reports/download*` automatically clamp `fromDate`, `asOn`, `to` to cutoff | PASS |
| **Admin Bypasses Date Clamping** | Admin requests historical data older than `maxDataDays` | `sanitizeDateRangeForRole` preserves unconstrained dates for `ADMIN` and `DEVELOPER` | PASS |
