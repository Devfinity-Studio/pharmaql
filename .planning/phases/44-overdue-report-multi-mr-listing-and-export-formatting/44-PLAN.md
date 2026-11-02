# Phase 44 Plan: Overdue Report Multi-MR Listing and Export Formatting

## Overview
Align the Overdue / Outstanding Report across PharmaQL with Technomax ERP conventions: execute company-division wide Multi-MR queries using a single "AsOn Date" filter parameter (`CALL rptMRwisePeriodicalOutstanding(..., {d '2026-04-01'}, {d '2026-04-01'}, {d '<AsOnDate>'}, ..., '')`), display hierarchical MR groupings with subtotals in the web portal, and synchronize this multi-MR structure across PDF, Excel, CSV, and Print export channels.

---

## 1. Key Objectives & Implementation Tasks

### Task 1: Stored Procedure Query Alignment
- **Files**:
  - `api-server/src/routes/reports.ts`
  - `src/server/actions/overdueReports.ts`
- **Actions**:
  - Confirm `api-server` accepts `mrId` as optional or empty string (`""`), translating it to `p_MRId = ''` in SQL for company-division wide listing.
  - Enforce `p_RecDt = {d '2026-04-01'}` and `p_FromDt = {d '2026-04-01'}` as base financial year cutoff dates.
  - Ensure `p_ToDt` receives the user-selected AsOn date (`{d 'YYYY-MM-DD'}`).
  - Maintain `compCode` resolution as `'(''COMPCODE'')'`.

### Task 2: Single "AsOn Date" Filter Bar in Dashboard
- **Files**:
  - `src/components/mr-dashboard-content.tsx`
  - `src/components/date-range-picker.tsx`
- **Actions**:
  - Verify that when `activeTab === "overdue"`, the filter toolbar exclusively renders the single date input labeled **"AsOn Date"** with `singleDateMode={true}`.
  - Ensure changing the AsOn date cleanses conflicting `from` params and sets `asOn` & `to` parameters.
  - Add quick presets relevant to AsOn reporting (e.g., "Today", "Month End", "End of Prev Month").

### Task 3: Hierarchical Multi-MR View in Web Portal
- **Files**:
  - `src/components/overdue-report-view.tsx`
- **Actions**:
  - Ensure data is grouped into a 3-tier hierarchy:
    1. **MR Section**: Header badge `MR : <MR Name>`
    2. **City/Area Section**: Subheader `City/Area: <City> - <Area>`
    3. **Party Section**: `<CustCode> - <Customer>, <Address1>` with `Opening :` and live ERP blocking badges (`BLOCKED` / `BLACKLISTED`).
  - Calculate running cumulative balance per party invoice.
  - Render Party Subtotals: `Outstanding of <Customer> : <Inv Amount> | <Rec Amount> | <Pending Amount>`.
  - Render MR Subtotals: `Outstanding of <MR Name> : <Inv Amount> | <Rec Amount> | <Pending Amount>`.
  - Render Grand Total at the bottom of the statement.

### Task 4: Export Engine Synchronization (PDF, Excel, CSV & Print)
- **Files**:
  - `src/app/api/reports/download-outstanding/route.ts`
  - `src/components/outstanding-download-buttons.tsx`
  - `src/lib/pdf.ts`
- **Actions**:
  - **PDF & Print**:
    - Enhance `generateGroupedPdfReport` in `src/lib/pdf.ts` so that when generating outstanding reports, the subtotal rows per MR calculate and display all three monetary figures: `Invoice Amount`, `Received Amount`, and `Pending Amount`.
    - Render tenant stationery letterhead with `AsOn Date: DD/MM/YYYY`, division/company name, and generation timestamp.
  - **Excel**:
    - Group rows by MR and Party, formatting currency cells with `#,\#\#0.00`.
    - Provide MR subtotals and Grand Total rows.
    - Set document metadata (Company, Division, AsOn period).
  - **CSV**:
    - Include `MR Name`, `City`, `Area`, `Party`, invoice fields, amounts, and Grand Total row.
  - **Modal**:
    - Confirm the download modal prompts for a single "AsOn Date" with modern backdrop blur and immediate download/print triggers.

### Task 5: Testing, Validation & 3-Stage Promotion
- **Verification Steps**:
  1. Unit tests pass: `pnpm test` (Vitest).
  2. TypeScript check: `pnpm exec tsc --noEmit`.
  3. Next.js production build: `pnpm run build`.
  4. Live query verification against `https://api.asmeepharma.com` with AsOn date parameter.
  5. Promote commits through `dev` -> `prod` (Vercel preview verification) -> `deploymment` (production release).

---

## 2. Definition of Done
- User can select any AsOn date, and the Overdue report generates a clean Multi-MR breakdown of all MRs under the selected company-division.
- PDF, Excel, CSV, and Print outputs accurately reflect all MRs with respective subtotals and grand totals.
- No TypeScript or build errors; tests pass; changes safely deployed.

