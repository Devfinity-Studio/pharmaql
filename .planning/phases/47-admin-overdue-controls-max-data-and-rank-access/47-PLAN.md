# Phase 47 Plan: Admin Overdue Blocking Days, Max Data Limit & Unrestricted Admin MR Access

## Executive Summary
This phase provides administrators with full configuration controls over overdue blocking limits and MR data visibility windows, while eliminating permission roadblocks so Admins can inspect all reports for every MR regardless of rank or MR-specific permissions.

---

## Work Breakdown Structure (Plans & Tasks)

### Plan 47.1: Policy Engine & Storage Expansion (Overdue Days & Max Data Limit)
- **Goal**: Expand tenant policy storage to persist configurable overdue blocking days (`overdue_direct_block_days`, `overdue_division_block_days`) and maximum MR data historical window (`max_data_days`), with fast caching and middleware header resolution.
- **Tasks**:
  1. Update `OverduePolicyConfig` in `src/server/actions/overduePolicy.ts`:
     - Add `directBlockDays: number` (default 90)
     - Add `divisionBlockDays: number` (default 120)
     - Add `maxDataDays: number | null` (default null / 0 for unlimited)
     - Add server action `updateTenantOverduePolicyAction({ disabled, directBlockDays, divisionBlockDays, maxDataDays })`
  2. Update `src/lib/control-plane-db.ts` and `src/modules/control-plane/tenantActions.ts`:
     - Add column `max_data_days INTEGER DEFAULT NULL`
     - Include `max_data_days` in tenant schema, queries, update mutations, and `data/tenants.json` fallback.
  3. Update `src/middleware.ts`:
     - Propagate `x-tenant-overdue-direct`, `x-tenant-overdue-division`, and `x-tenant-max-data-days` in request headers.

### Plan 47.2: Admin UI Policy Controls
- **Goal**: Provide an intuitive, modern configuration card on the Admin MR Access Management page (`/admin/mrs`) and Tenant Control Center for administrators to set overdue blocking parameters and the MR max data window.
- **Tasks**:
  1. Create or enhance `src/components/admin-policy-settings-card.tsx`:
     - Direct block limit (days, e.g. 90)
     - Division cascading block limit (days, e.g. 120)
     - MR Overdue account enforcement toggle (Enforced / Disabled)
     - Max Historical Data Window for MRs (numeric input in days, e.g. 60 days, with description: "MRs cannot view or select dates older than X days from today. Admins remain unrestricted.")
     - "Save Policy" button with optimistic UI and toast/banner feedback.
  2. Embed the policy card in `src/app/admin/mrs/page.tsx` directly above or alongside the Overdue MRs Section.
  3. Update `src/components/tenant-modal.tsx` and `src/components/tenant-form.tsx` to include `max_data_days`.

### Plan 47.3: Max Historical Data Enforcement for MRs
- **Goal**: Enforce the `max_data_days` boundary so MRs cannot see or query data older than `today - max_data_days`, while Admins remain 100% exempt.
- **Tasks**:
  1. Create server-side date sanitizer `sanitizeDateRangeForRole({ from, to, role, maxDataDays })` in `src/lib/dateUtils.ts`:
     - For `ADMIN` and `DEVELOPER`: returns `from` and `to` untouched.
     - For `MR` (when `maxDataDays > 0`): clamps `from` to `max(from, minAllowedDate)` and ensures `to` is not older than `minAllowedDate`.
  2. Apply date clamping in server actions:
     - `src/server/actions/salesReports.ts`
     - `src/server/actions/stockReports.ts`
     - `src/server/actions/partyItemSaleReports.ts`
     - `src/server/actions/claimData.ts`
     - `src/server/actions/expiryReports.ts`
     - `src/server/actions/overdueReports.ts`
  3. Apply date clamping in report export API routes (`src/app/api/reports/download*`).
  4. Update `src/components/date-range-picker.tsx`:
     - Accept `minDate` (or resolve `maxDataDays` for MRs).
     - Set `min={minDate}` on date inputs.
     - Clamp shortcut buttons ("Today", "Last 30 Days", "This Month", "FY Start", etc.) so MRs cannot select past the cutoff.

### Plan 47.4: Unrestricted Admin MR Report Access
- **Goal**: Ensure Admins viewing any MR dashboard (`/admin/mrs/[id]`) have full, unhindered visibility across all tabs and reports, regardless of the MR's rank (Rank 1, 2, 3) or individual permission toggles.
- **Tasks**:
  1. Pass `isAdminView={isAdminView}` from `src/components/mr-dashboard-content.tsx` to all child report views:
     - `StockReportView`
     - `StockAndSalesReportView`
     - `PartyReportView`
     - `ProductReportView`
     - `FreeSchemeReportView`
     - `ExpiryReportView`
     - `OverdueReportView`
  2. Update each child view component's permission gates:
     - `if (!isAdminView && (!mrInfo || !mrInfo.canViewPartyWise)) ...`
     - `if (!isAdminView && (!mrInfo || !mrInfo.canViewProductWise)) ...`
     - `if (!isAdminView && (!mrInfo?.canViewStockAndSales && !mrInfo?.canViewStock)) ...`
     - `if (!isAdminView && !mrInfo?.canViewStock) ...`
  3. Ensure party sales valuation in `PartyReportView` and `ProductReportView` uses `isAdminView || mrInfo.canViewSales` so sales figures display for Admins even if the MR cannot view sales.
  4. Verify that MR tab bar in `mr-dashboard-content.tsx` does not hide any report tabs when `isAdminView === true`.

### Plan 47.5: Testing, Type Safety, Build Verification & Promotion
- **Goal**: Verify with automated test suites, typechecks, Next.js build, and 3-stage promotion workflow.
- **Tasks**:
  1. Write unit tests in `src/lib/__tests__/dateUtils.test.ts` and `src/lib/__tests__/overduePolicy.test.ts` validating:
     - Admin exemption vs. MR clamping for `max_data_days`.
     - Updating and resolving overdue blocking days.
     - Unrestricted Admin permissions logic.
  2. Run `pnpm exec tsc --noEmit` to verify type safety.
  3. Run full Vitest suite (`pnpm test`).
  4. Run `pnpm build` (`next build`).
  5. Commit and promote through `dev` -> `prod` -> `deploymment`.
