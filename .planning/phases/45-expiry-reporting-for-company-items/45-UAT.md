# Phase 45 UAT: Expiry Reporting for Company Items

## Status: COMPLETE (Verified & Validated)

---

### Verification Summary

1. **Stored Procedure Integration & Parameter Handling**:
   - Stored Procedure: `CALL rptExpiryStockStatement({d '<AsOnDate>'}, 11, 11, 202627, '(''AAGAM'')', '', 'PRate')`.
   - Hardened `validateExpiryStockParams` in `api-server/src/utils/spValidator.ts` to validate:
     - Cutoff AsOn Date (`asOnDate`, converted to ODBC `{d 'YYYY-MM-DD'}`).
     - Company & Division codes (escaped in SQL tuple notation).
     - Valuation Rate (`PRate`, `PTR`, `MRP`).
     - Numeric identifiers (`compNo`, `locNo`, `finYear`).
   - Caching: LRU cache with 180s TTL and fallback query engine when stored procedure returns simulated dataset in sandbox environments.

2. **Dashboard UI & Single AsOn Date Cutoff**:
   - Added dedicated `"expiry"` tab in `src/components/mr-dashboard-content.tsx` with calendar badge.
   - Toolbar dynamically switches `DateRangePicker` to `singleDateMode` when the Expiry tab is active.
   - Only a single **"AsOn Date"** input is shown, synchronizing `asOn` and `to` while cleansing `from` parameters.
   - Quick presets provided for rapid selection (e.g., Today, Month End, Quarter End).

3. **Hierarchical Company-Division Web View (`src/components/expiry-report-view.tsx`)**:
   - Company & Division stationery header matching Technomax ERP format (`Expiry Stock Statement as on DD/MM/YYYY`).
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
   - Real-time days-to-expiry risk tags:
     - `Expired` (red badge for `Days <= 0`).
     - `Critical: < 30 days` (orange badge).
     - `Near Expiry: < 90 days` (yellow badge).
   - Division subtotals and Grand Total footer for total quantity and stock valuation.
   - Offline sync support with `OfflineReportSync`.

4. **Synchronized PDF, Excel, CSV & Print Exports**:
   - **PDF & Print**:
     - Landscape autoTable with company letterhead, address, GSTIN, and cutoff statement.
     - Subtotals per division and grand total row.
   - **Excel (`buildStyledExcelBuffer`)**:
     - Formatted currency columns (`#,##0.00`) and quantity integers (`#,##0`).
     - Includes divisional subtotal rows and grand total footer.
   - **CSV (`/api/reports/download-expiry?format=csv`)**:
     - Complete itemized CSV with company, division, batch, expiration date, godown, unit rate, and total stock value.

5. **Automated Testing & Builds**:
   - TypeScript compilation (`pnpm exec tsc --noEmit`): 0 errors.
   - Next.js production build (`pnpm run build`): All 20 routes generated successfully.
   - Vitest test suite (`pnpm test`): 25 test files, 141/141 passing tests.
