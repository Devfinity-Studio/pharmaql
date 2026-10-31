# Phase 42 UAT: Overdue Report Alignment with Technomax ERP & Dynamic Tenant Thresholds

## Status: COMPLETE (Verified & Shipped)

---

### Verification Summary

1. **Stored Procedure Parameter Alignment (`api-server/src/routes/reports.ts`)**:
   - Fixed parameter 4 (`p_Recdate`): Was previously hardcoded to `odbcFinYearStart` (`2026-04-01`), which ignored all receipts/adjustments made during the fiscal year.
   - Updated to `odbcRecDate` (`params.recDate || toDateStr`), ensuring all payment voucher adjustments up to the requested cutoff date are included in net balance calculations.
   - Verified stored procedure invocation format matches: `CALL rptMRwisePeriodicalOutstanding(...)`.

2. **Visual Hierarchy & Column Alignment (`src/components/overdue-report-view.tsx`)**:
   - Matches the Technomax ERP statement structure:
     - Header: `MR : <MR Name>`
     - Area Header: `City/Area: <City> - <Area>`
     - Party Sub-header: `<CustCode> - <Customer>, <Address1>` with `Opening :` tag and live ERP blocking badges.
     - 10 Data Columns: `Doc Type`, `Inv. Date`, `Invoice No.`, `Due Date`, `Due Days`, `Invoice Amount`, `Received Amount`, `Received Date`, `Pending Amount`, `Cumm. Total`.
     - Subtotals: Party Subtotals (`Outstanding of <Customer>`), MR Subtotals (`Outstanding of <MR Name>`), and Grand Total.
     - Due Days: preserved as raw signed integer (negative e.g. `-49` denotes past due; positive denotes days until due date).

3. **Dynamic Tenant Blocking Thresholds (`src/lib/overdueUtils.ts` & `src/server/actions/overdueEngine.ts`)**:
   - Replaced hardcoded 90-day threshold with dynamic tenant limits:
     - `overdueDirectBlockDays` (read from tenant configuration / header `x-tenant-overdue-direct`, default 90).
     - `overdueDivisionBlockDays` (read from tenant configuration / header `x-tenant-overdue-division`, default 95).
   - Overdue calculation properly handles both negative ERP `DueDays` and raw past-due day counts.

4. **Excel & PDF Statement Exports (`src/app/api/reports/download-outstanding/route.ts`)**:
   - Column mapping aligned with the ERP report (`Doc Type`, `Inv. Date`, `Invoice No.`, `Due Date`, `Due Days`, `Invoice Amount`, `Received Amount`, `Received Date`, `Pending Amount`).
   - Grouping preserved by `MR` -> `City / Area` -> `Party`.
   - Tenant branding dynamically injected: company logo, address, phone, email, and GSTIN.

5. **Automated Testing & Builds**:
   - TypeScript validation (`pnpm exec tsc --noEmit`): 0 errors.
   - Vitest test suite (`pnpm test`): 21 test files, 119/119 unit tests passing.
   - Next.js production build (`pnpm run build`): All 19 routes compiled and statically optimized.

6. **Deployment Pipeline & Verification**:
   - Merged to `prod` (preview deployment `dpl_Dkc6WU6nXFPnjQjUjmfT6E57PsTP` reached `READY`).
   - Smoke tested Vercel preview URL (`https://pharmaql-1jro40ksa-thespacestation.vercel.app/login`) -> HTTP 200 OK.
   - PR #42 merged to `deploymment` branch via GitHub CLI.
