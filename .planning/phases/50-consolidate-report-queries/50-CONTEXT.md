# Phase 50 Context: Consolidate Report Generation Queries

## Overview & Executive Summary
In PharmaQL, data queries for ERP report generation (Party-wise Sales, Product-wise Sales, Stock Valuation, Stock & Sales, Overdue/Outstanding, Expiry Stock, and Claim Quantity) were previously scattered across 7 individual server action files in `src/server/actions/`.

Phase 50 consolidates all report generation queries and data fetchers into a single, cohesive server module: **`src/server/actions/reportQueries.ts`**. All interactive report views, download modals, export buttons, and API download routes will be updated to import and invoke queries directly from this centralized file, and the legacy individual action files will be cleanly removed.

---

## Locked Decisions & Architecture

### 1. Unified Report Queries File (`src/server/actions/reportQueries.ts`)
- **Location**: `src/server/actions/reportQueries.ts`
- **Capabilities & Exports**:
  - Individual strongly-typed query functions:
    1. `fetchPartyWiseSales`: Executes `rptPartyWiseSaleStatement` with company/division filtering, date range clamping, and item aggregation.
    2. `fetchProductWiseSales` (or `fetchCustomerItemSale`): Executes `rptCustomerItemSaleStatement` for product-centric views.
    3. `fetchStockValuation`: Executes `rptStockStatementWithValuation` with rate valuations (PRate, PTR, MRP) and division subtotals.
    4. `fetchStockAndSales`: Computes integrated opening stock, sales, receipts, and closing balance statements.
    5. `fetchOverdueOutstanding`: Executes `rptMRwisePeriodicalOutstanding` with multi-voucher receipt aggregation, settled invoice filtering, and overdue risk status.
    6. `fetchExpiryStock`: Executes `rptExpiryStockStatement` with days-to-expiry calculations, risk badges, and batch valuations.
    7. `fetchClaimData`: Fetches and calculates company claim differentials and claim amounts.
  - Unified Dispatcher Function:
    - `fetchReportQuery({ reportType, ...params })`: Allows callers to dynamically execute any report query via a single dispatch interface.
  - Shared Types & Interfaces:
    - Centralize all report input parameters (`ReportQueryParams`, `ReportType`, date filters, tenant context, MR filters, rank checks).
    - Standardized error handling, ERP bridge timeout handling, and fallback behavior.

### 2. Caller Refactoring & Rewiring
- **Interactive Report Views**:
  - `src/components/party-report-view.tsx` -> import from `@/server/actions/reportQueries`
  - `src/components/product-report-view.tsx` -> import from `@/server/actions/reportQueries`
  - `src/components/stock-report-view.tsx` -> import from `@/server/actions/reportQueries`
  - `src/components/stock-and-sales-report-view.tsx` -> import from `@/server/actions/reportQueries`
  - `src/components/overdue-report-view.tsx` -> import from `@/server/actions/reportQueries`
  - `src/components/expiry-report-view.tsx` -> import from `@/server/actions/reportQueries`
- **Download Modals & Export Buttons**:
  - `src/components/report-download-modal.tsx` -> import from `@/server/actions/reportQueries`
  - `src/components/overdue-download-modal.tsx` -> import from `@/server/actions/reportQueries`
  - `src/components/expiry-download-buttons.tsx` -> import from `@/server/actions/reportQueries`
- **API Download Endpoints**:
  - `src/app/api/reports/download/route.ts` -> import from `@/server/actions/reportQueries`
  - `src/app/api/reports/download-sales/route.ts` -> import from `@/server/actions/reportQueries`
  - `src/app/api/reports/download-stock/route.ts` -> import from `@/server/actions/reportQueries`
  - `src/app/api/reports/download-outstanding/route.ts` -> import from `@/server/actions/reportQueries`
  - `src/app/api/reports/download-expiry/route.ts` -> import from `@/server/actions/reportQueries`

### 3. Clean Removal of Legacy Action Files
Per user instruction, the old separate action files will be completely deleted once callers are rewired:
- ❌ `src/server/actions/partyItemSale.ts`
- ❌ `src/server/actions/customerItemSale.ts`
- ❌ `src/server/actions/stockreports.ts`
- ❌ `src/server/actions/stockAndSales.ts`
- ❌ `src/server/actions/overdueReports.ts`
- ❌ `src/server/actions/expiryReports.ts`
- ❌ `src/server/actions/claimData.ts`

All tests referencing these files will be updated to test `src/server/actions/reportQueries.ts`.

---

## Verification Plan
1. **TypeScript Verification**: Zero type errors (`pnpm exec tsc --noEmit`).
2. **Test Suite Verification**: All 26 test suites passing (`pnpm test`).
3. **Build Verification**: Clean production build (`pnpm build`).
4. **Promotion Workflow**: 3-stage promotion workflow (`dev` -> `prod` -> `deploymment`).
