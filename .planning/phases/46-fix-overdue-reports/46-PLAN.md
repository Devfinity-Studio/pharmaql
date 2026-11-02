# Phase 46 Plan: Fix Overdue Reports

## Overview
Resolve all outstanding issues in the Overdue (MRwise Periodical Outstanding) reports across the Express API server, Next.js server actions, dashboard date controls, hierarchical table view, and synchronized export channels (PDF, Excel, CSV, Print). Specifically, align the 3-date parameter signature (`p_FromDt`, `p_AsOnDt`, `p_RecDt`), fix export authorization to support company-wide Multi-MR reports without requiring a single `mrId`, synchronize dual-date header controls in `DateRangePicker`, and ensure calculations and subtotals match Technomax ERP standards.

---

## 1. Key Objectives & Implementation Tasks

### Task 1: Stored Procedure Parameter Realignment & Validation
- **Stored Procedure**: `CALL pdyasvtrans.rptMRwisePeriodicalOutstanding(p_CompNo, p_LocNo, p_YearNo, p_FromDt, p_AsOnDt, p_RecDt, p_City, p_Area, p_CustType, p_CustIds, p_SeriesIds, p_CompCode, p_CustGrp, p_DivIds, p_MRId)`
- **Parameter Alignment**:
  - `p_FromDt`: Financial Year start (e.g. `{d '2026-04-01'}`)
  - `p_AsOnDt`: As On / Cutoff Date selected in header (e.g. `{d '2026-10-31'}`)
  - `p_RecDt`: Payment Received Date cutoff selected in header (defaults to As On date, e.g. `{d '2026-10-31'}`)
- **Target Files**:
  - `api-server/src/routes/reports.ts`: Enforce parameter order `[compNo, locNo, finYear, odbcFromDate, odbcAsOnDate, odbcRecDate, ...]`.
  - `api-server/src/utils/spValidator.ts`: Validate that `asOnDate` and `recDate` adhere to `YYYY-MM-DD` regex.
  - `src/server/actions/devDiagnostics.ts` & `src/components/dev-control-center.tsx`: Update the stored procedure debug runners to pass `[FromDate, AsOnDate, RecDate]` correctly.

### Task 2: Dual Date Header & Preset Synchronization
- **Files**:
  - `src/components/date-range-picker.tsx`
  - `src/components/mr-dashboard-content.tsx`
- **Actions**:
  - When `showReceivedDate` is enabled on the Overdue tab:
    - Ensure quick presets ("Today", "Prev Month End") update both `to` (AsOn Date) and `recDate` (Received Date).
    - When the user manually changes the AsOn Date input, automatically update `recDate` if `recDate` was previously identical to `to` (or empty).
    - Handle "Apply" button clicks so both `asOn`/`to` and `recDate` query parameters are synchronized in the URL.
    - Support "Clear" action resetting all date parameters cleanly.

### Task 3: Interactive Hierarchical Web View Verification
- **File**: `src/components/overdue-report-view.tsx`
- **Actions**:
  - Retrieve `asOnDateStr` and `recDateStr` from search parameters, defaulting `recDateStr` to `asOnDateStr`.
  - Pass `{ fromDate: finYearStart, toDate: asOnDateStr, recDate: recDateStr, compCode, mrId }` to `getMRwisePeriodicalOutstanding`.
  - Maintain support for both company-wide Multi-MR reports (`mrId = ''`) and single MR filtered reports.
  - Display header summary badges showing selected **AsOn Date**, **Received Date**, and **Company/Division**.
  - Verify calculations across all 3 monetary columns:
    - `Amount` (Invoice Amount)
    - `AdjAmt` (Received / Adjusted Amount)
    - `Balance` (`Amount - AdjAmt`)
  - Verify running cumulative balance per MR, party subtotals, city/area subtotals, MR subtotals, and Grand Total.
  - Display live ERP customer blocking status (`BLOCKED`, `BLACKLISTED`, `ACTIVE`).

### Task 4: Export Route & Download Button Fixes
- **Files**:
  - `src/app/api/reports/download-outstanding/route.ts`
  - `src/components/outstanding-download-buttons.tsx`
  - `src/lib/pdf.ts`
  - `src/lib/excel.ts`
- **Actions**:
  - In `download-outstanding/route.ts`, remove the blocking `if (!mrId) return 400;` check. If `mrId` is empty or `"all"`, authorize based on admin role or MR assigned divisions/companies, allowing company-wide export.
  - Read `asOn`, `to`, and `recDate` from search params and forward them to `getMRwisePeriodicalOutstanding`.
  - In `outstanding-download-buttons.tsx`, forward `asOn` and `recDate` in export URLs.
  - Ensure PDF landscape export renders tenant branding, party rows, signed due days, and subtotals matching the web view.
  - Ensure Excel and CSV exports include both `AsOn Date` and `Received Date` in metadata headers and provide accurate party rows and grand totals.

### Task 5: Testing, Validation & API Server Packaging
- Update unit tests in `src/lib/__tests__/spValidator.test.ts` and `src/lib/__tests__/overdueEngine.test.ts` for 3-date parameter handling.
- Run complete test suite (`pnpm test`) across all 25 test suites.
- Verify TypeScript types (`pnpm exec tsc --noEmit` on root and `api-server`).
- Build production bundle (`pnpm build`).
- Package updated standalone executable `public/downloads/api-server.exe`.

---

## 2. Success Criteria
- [ ] Stored procedure `rptMRwisePeriodicalOutstanding` receives `[p_FromDt, p_AsOnDt, p_RecDt]` in the correct order.
- [ ] `DateRangePicker` dual-date mode allows independent selection of AsOn Date and Received Date with synchronized presets.
- [ ] Company-wide Overdue export (PDF, Excel, CSV) functions seamlessly without requiring a specific `mrId`.
- [ ] Web view and exports present identical columns, signed due days, party blocking states, subtotals, and grand totals.
- [ ] All unit tests pass, zero TypeScript errors, clean production Next.js build.

