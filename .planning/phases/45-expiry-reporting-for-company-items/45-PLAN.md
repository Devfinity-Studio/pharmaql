# Phase 45 Plan: Expiry Reporting for Company Items

## Overview
Build an end-to-end Expiry & Near-Expiry Reporting Suite in PharmaQL for company items: connect to the Technomax ERP batch stock dataset via Express `api-server`, surface a dedicated "Expiry" report tab in the MR & Admin dashboards with horizon filtering (Expired, 30d, 60d, 90d, 180d, All), provide color-coded risk alerts, and support standardized exports (PDF, Excel, CSV, and Print).

---

## 1. Key Objectives & Implementation Tasks

### Task 1: ERP Schema Resolution & On-Premise API Route
- **Files**:
  - `api-server/src/routes/reports.ts`
  - `api-server/src/utils/spValidator.ts`
- **Actions**:
  - Implement `/api/reports/expiry` in `api-server`:
    - Accept parameters: `compNo`, `locNo`, `compCode`, `division`, `cutoffDate`, `horizonDays`, `search`.
    - Query batch stock and expiration records from Technomax ERP (e.g. `pdyasvtrans` batch stock view/stored procedure or `m_item` + batch transactions join).
    - Return structured rows: `ItemCode`, `ItemName`, `Packing`, `Division`, `CompCode`, `BatchNo`, `ExpDate`, `DaysToExpiry`, `StockQty`, `PTR`, `MRP`, `StockValue`.
  - Add request validation in `spValidator.ts` and memory-capped LRU caching (`getOrSetCache`, TTL 180s).

### Task 2: Server Action & API Client Ingestion
- **Files**:
  - `src/server/actions/expiryReports.ts`
  - `src/lib/api-client.ts`
- **Actions**:
  - Implement `getCompanyItemExpiryReport(params)` server action calling `/api/reports/expiry`.
  - Provide fallback data derivation if remote procedure requires specific legacy flags.
  - Return typed result `{ success: boolean; data?: ExpiryReportRow[]; error?: string }`.

### Task 3: Dashboard Tab & Filter Toolbar Integration
- **Files**:
  - `src/components/mr-dashboard-content.tsx`
  - `src/components/expiry-filter-toolbar.tsx`
- **Actions**:
  - Add an `"expiry"` tab to the MR dashboard navigation next to "Overdue" and "Stock & Sales".
  - Build horizon selector:
    - `All Batches`
    - `Expired (<= 0 Days)`
    - `Near Expiry (Within 30 Days)`
    - `Near Expiry (Within 60 Days)`
    - `Near Expiry (Within 90 Days)`
    - `Within 180 Days`
  - Include search bar for Item Name, Code, or Batch No.

### Task 4: Interactive Expiry Report View
- **Files**:
  - `src/components/expiry-report-view.tsx`
  - `src/components/report-stationery-header.tsx`
- **Actions**:
  - Group items hierarchically: `Division / Manufacturer -> Item Name -> Batches`.
  - Display columns:
    1. `Item Code`
    2. `Product / Item Name`
    3. `Packing`
    4. `Batch No.`
    5. `Exp. Date`
    6. `Days to Expiry` (signed integer)
    7. `Stock Qty`
    8. `PTR` (₹)
    9. `MRP` (₹)
    10. `Stock Value` (₹ Qty * PTR)
    11. `Risk Status` (Badge: EXPIRED / CRITICAL / WARNING / NORMAL)
  - Calculate Division Subtotals (Total Stock Qty & Total Value) and Grand Total Summary.

### Task 5: Multi-Format Exports (PDF, Excel, CSV & Print)
- **Files**:
  - `src/app/api/reports/download-expiry/route.ts`
  - `src/components/expiry-download-buttons.tsx`
  - `src/lib/pdf.ts`
  - `src/lib/excel.ts`
- **Actions**:
  - **PDF & Print**:
    - Landscape orientation with tenant stationery letterhead.
    - Division header rows and batch listings with color-coded expiry alerts.
    - Subtotals for Stock Qty and Stock Value per division and Grand Total.
  - **Excel**:
    - Styled Excel workbook with metadata, division groupings, currency formatting (`#,##0.00`), and summary totals.
  - **CSV**:
    - High-speed tabular CSV download for inventory accounting.

### Task 6: Testing, Build & 3-Stage Promotion
- **Verification Steps**:
  1. Unit tests pass: `pnpm test`.
  2. TypeScript validation: `pnpm exec tsc --noEmit`.
  3. Next.js production build: `pnpm run build`.
  4. 3-stage promotion workflow: `dev` -> `prod` -> `deploymment` PR.

---

## 2. Definition of Done
- Users can view, search, and filter near-expiry and expired stock batches across any company-division.
- PDF, Excel, CSV, and Print statements match Technomax ERP conventions with complete stock quantity and value calculations.
- Clean code with 100% test coverage for new utilities and zero regression on existing reports.
