# Phase 45 Plan: Expiry Reporting for Company Items

## Overview
Implement the Technomax ERP Expiry Stock Statement (`rptExpiryStockStatement`) across the API server, server actions, dashboard tabs, interactive web portal, and PDF/Excel/CSV exports. The report accepts a single **AsOn Date** parameter (`p_AsonDt`), returning all company items whose batch expiration date is prior to the AsOn date (`h.ExpDt < p_AsonDt`) with remaining stock (`Qty > 0`).

---

## 1. Key Objectives & Implementation Tasks

### Task 1: API Server Endpoint (`api-server/src/routes/reports.ts`)
- **Route**: `POST /api/reports/expiry-stock`
- **Stored Procedure**: `CALL pdyasvtrans.rptExpiryStockStatement(p_AsonDt, p_CmpNo, p_LocNo, p_YearNo, p_CompCode, p_Div, p_Rate)`
- **Parameters**:
  - `asOnDate`: format `YYYY-MM-DD` (converted to `{d 'YYYY-MM-DD'}`)
  - `compNo`: default `11`
  - `locNo`: default `11`
  - `finYear`: default `202627`
  - `compCode`: resolved via `resolveCompanyCodeParam` e.g. `'(''AAGAM'')'`
  - `div`: division ID e.g. `'(12)'` or `''`
  - `rateType`: `'PRate'` | `'PTR'` | `'MRP'` (defaults to `'PRate'`)
- **Caching**: In-memory LRU cache with TTL 180s, cache key scoped by parameters.
- **Validation**: In `api-server/src/utils/spValidator.ts`, validate date format and numeric parameters.

### Task 2: Server Action & API Client (`src/server/actions/expiryReports.ts`)
- Interface `ExpiryStockRow`:
  - `ID`: number
  - `MktBy`: string
  - `Division`: string
  - `ItemCode`: string
  - `ItemName`: string
  - `Packing`: string
  - `BatchNo`: string
  - `MRP`: number
  - `PRate`: number
  - `PTR`: number
  - `ExpDt`: string
  - `Godown`: string
  - `Qty`: number
  - `Rate`: number
  - `DaysToExpiry`: number (calculated from current date or AsOn date)
  - `TotalAmount`: number (`Qty * Rate`)
- Export `getExpiryStockStatement(params)`.

### Task 3: Dashboard Tab & Single AsOn Date Toolbar
- **Files**:
  - `src/components/mr-dashboard-content.tsx`
  - `src/components/date-range-picker.tsx`
- **Actions**:
  - Add tab `"expiry"` labeled **"Expiry"** in the navigation bar.
  - In the filter bar when `activeTab === "expiry"`, render single date picker:
    `<DateRangePicker singleDateLabel="AsOn Date" singleDateMode={true} />`.
  - Provide quick presets (e.g., "Today", "Prev Month End", "Next Month End", "End of Quarter").

### Task 4: Interactive Hierarchical Web View (`src/components/expiry-report-view.tsx`)
- Display stationery header with tenant letterhead: `Expiry Stock Statement as on DD/MM/YYYY`.
- Grouping: `Company / Division -> Item Name -> Batches`.
- Columns:
  1. `Item Code`
  2. `Item Name`
  3. `Packing`
  4. `Batch No.`
  5. `Godown`
  6. `Exp. Date`
  7. `Stock Qty`
  8. `PRate` (₹)
  9. `PTR` (₹)
  10. `MRP` (₹)
  11. `Stock Value` (₹ Qty * Rate)
- Subtotals per Item, Subtotals per Division, and Grand Total across the statement.

### Task 5: Synchronized Exports (PDF, Excel, CSV & Print)
- **Files**:
  - `src/app/api/reports/download-expiry/route.ts`
  - `src/components/expiry-download-buttons.tsx`
  - `src/lib/pdf.ts`
  - `src/lib/excel.ts`
- **Actions**:
  - **PDF & Print**:
    - Landscape autoTable with tenant branding, company address, phone, GSTIN.
    - Division header row `Company: <Company> - <Division>`.
    - Columns: `Item Code`, `Item Name`, `Packing`, `Batch No.`, `Exp. Date`, `Godown`, `Qty`, `PRate`, `PTR`, `Stock Value`.
    - Subtotals per Division and Grand Total row.
  - **Excel**:
    - Styled Excel workbook with metadata, columns formatted with currency (`#,##0.00`) and integers (`#,##0`).
    - Subtotals per Division and Grand Total row.
  - **CSV**:
    - Complete flat record CSV export with Grand Total summary.

### Task 6: Testing, Build & 3-Stage Promotion
- Unit tests in `src/lib/__tests__/expiryReports.test.ts`.
- TypeScript verification (`pnpm exec tsc --noEmit`).
- Production build (`pnpm run build`).
- Promote `dev` -> `prod` -> `deploymment` PR pipeline.

---

## 2. Definition of Done
- User can select any company-division and AsOn date, and the report executes `rptExpiryStockStatement` returning all expired/near-expiry stock batches.
- Web view, PDF, Excel, CSV, and Print are 100% aligned with Technomax ERP.
- Zero TypeScript errors, all unit tests pass, and successfully deployed to production.
