# Phase 50 Plan: Consolidate Report Generation Queries

## Goal
Consolidate all ERP report generation queries and data fetchers currently distributed across 7 separate action files into a single, cohesive server module (`src/server/actions/reportQueries.ts`), update all interactive views, download modals, export buttons, and API routes to call queries from this single source of truth, and cleanly remove the legacy individual action files.

---

## Execution Waves

### Wave 1: Unified Report Queries Service Module
- **Plan 50.1: Build `src/server/actions/reportQueries.ts`**
  - Unify all 7 report query functions:
    1. `fetchPartyWiseSales` / `getCompanyCustomerItemwiseSales`
    2. `fetchProductWiseSales` / `getItemCustomerSale`
    3. `fetchStockValuation` / `getStockMovement`
    4. `fetchStockAndSales` / `getStockAndSales`
    5. `fetchOverdueOutstanding` / `getMRwisePeriodicalOutstanding`
    6. `fetchExpiryStock` / `getExpiryStockStatement`
    7. `fetchClaimData` / `getClaimData`
  - Unify all Row and Result TypeScript interfaces:
    - `PartyCustomerItemSaleRow`, `ItemCustomerSaleRow`, `StockMovementRow`, `StockAndSalesRow`, `OverduePeriodicalOutstandingRow`, `ExpiryStockRow`, `ClaimDataRow`.
  - Implement unified query dispatcher:
    - `fetchReportQuery({ reportType, ...params })`
  - Centralize error handling, request parameter sanitization, and fallback behaviors.
- **Plan 50.2: Dedicated Unit Tests for Unified Queries**
  - Create `src/server/actions/__tests__/reportQueries.test.ts` testing each named query function and the unified dispatcher with mock responses.

### Wave 2: Caller Rewiring Across Views & Download Routes
- **Plan 50.3: Rewire Interactive Report Views & Dashboard**
  - Update `src/components/party-report-view.tsx`
  - Update `src/components/product-report-view.tsx`
  - Update `src/components/stock-report-view.tsx`
  - Update `src/components/stock-and-sales-report-view.tsx`
  - Update `src/components/overdue-report-view.tsx`
  - Update `src/components/expiry-report-view.tsx`
  - Update `src/components/free-scheme-report-view.tsx`
  - Update `src/components/mr-dashboard-content.tsx`
  - Update `src/lib/overdueUtils.ts`
- **Plan 50.4: Rewire API Download & Export Routes**
  - Update `src/app/api/reports/download/route.ts`
  - Update `src/app/api/reports/download-sales/route.ts`
  - Update `src/app/api/reports/download-stock/route.ts`
  - Update `src/app/api/reports/download-outstanding/route.ts`
  - Update `src/app/api/reports/download-expiry/route.ts`

### Wave 3: Legacy File Deletion & Cleanup
- **Plan 50.5: Delete Legacy Action Files**
  - Delete `src/server/actions/claimData.ts`
  - Delete `src/server/actions/customerItemSale.ts`
  - Delete `src/server/actions/expiryReports.ts`
  - Delete `src/server/actions/overdueReports.ts`
  - Delete `src/server/actions/partyItemSale.ts`
  - Delete `src/server/actions/stockreports.ts`
  - Delete `src/server/actions/stockAndSales.ts`

### Wave 4: Verification, Production Build & Promotion
- **Plan 50.6: Verification & Promotion**
  - Run TypeScript typecheck (`pnpm exec tsc --noEmit`).
  - Run all Vitest test suites (`pnpm test`).
  - Run Next.js production build (`pnpm build`).
  - Write `50-UAT.md`.
  - Update `ROADMAP.md` and `STATE.md` marking Phase 50 as completed.
  - Execute 3-stage promotion workflow (`dev` -> `prod` -> `deploymment`).
