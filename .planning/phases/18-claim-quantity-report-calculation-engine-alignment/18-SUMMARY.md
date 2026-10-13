# Phase 18 Summary: Claim Quantity Report & Calculation Engine Alignment

## Execution Overview
Phase 18 aligned the Claim Quantity / Free Scheme report calculation engine, backend Express endpoint, and UI/export representations with the gold-standard reference PDF (`Claim Quantity Statement for Period of 01-09-2026 to 30-09-2026`).

### Key Accomplishments

1. **Backend Query Hardening (`api-server/src/routes/reports.ts`)**:
   - Refactored `/claim-data` endpoint:
     - Implemented dynamic session UUID generation (`claim-${Date.now()}-${random}`) to prevent temporary table and static GUID collisions across concurrent users.
     - Enforced pre-query cleanup: `DELETE FROM pdyasvtrans.claimdata WHERE UniqueCode = ?` before procedure execution.
     - Added post-retrieval cleanup to automatically purge temporary session records from `claimdata` table, keeping the ERP database clean and lean.
   - Built with 0 TypeScript compilation errors (`npm run build`).

2. **Calculation Engine & Formula Normalization**:
   - Normalized formulas across web and export logic:
     - **Qty Claim (Free Scheme)**: `Claim Value = PRate * ClaimQty` (verified against September 2026 STARTOS data where $195.02 \times 4 = 780.08$ and $189.30 \times 5 = 946.50$).
     - **Rate Claim**: `Claim Value = (PTR - InvRate) * SaleQty` (or `NetRate - InvRate`).
   - Updated UI legend to reflect exact accounting formula: `Claim Value = PRate x ClaimQty`.

3. **UI Table Layout & Summary Alignment (`free-scheme-report-view.tsx`)**:
   - Standardized table layout to match the official 15-column reference format:
     - `Code`, `Product Name`, `Packing`, `Batch No.`, `Inv. No.`, `Inv. Dt.`, `MRP`, `PRate`, `PTR`, `Net Rate`, `Inv. Rate`, `Sale Qty`, `Free Qty`, `Claim Qty`, `Claim Value`, `Scheme`.
   - Added Customer Subtotal rows displaying totals per party (`Total of [Party] : Sale Qty, Free Qty, Claim Qty, Claim Value`).
   - Grouped Item Summary table (`Summary :`) aggregating `Item Name`, `Packing`, `Sale Qty`, `Free Qty`, `Claim Qty`, and `Claim Value`.
   - Company Grand Total row at the bottom.
   - Retained the live debug query banner for runtime visibility and auditability.

4. **Export Endpoints Synchronization (`download-sales/route.ts`)**:
   - Synchronized Excel/CSV export generation for Free Scheme claims with 15 columns, Customer subtotals, and Grand Totals.
   - Enforced strict MR company and division filtering to prevent cross-company data bleed.

5. **Verification & Quality Checks**:
   - Validated against live database: STARTOS in September 2026 returns **exactly 10 rows and 3 customers** matching the reference PDF 100%.
   - Full TypeScript compile check passed with 0 errors (`pnpm run typecheck`).
   - API server compilation passed with 0 errors (`npm run build`).
   - Strict constraint adhered to: **No git push executed**.
