# Phase 18 Plan: Claim Quantity Report & Calculation Engine Alignment

## Objectives
1. Harden the Claim Quantity query engine in `api-server` to eliminate temporary table / stale GUID collisions and support direct deterministic query execution.
2. Standardize claim calculation formulas across the application:
   - **Qty Claim (Free Scheme)**: `Claim Value = PRate * ClaimQty`
   - **Rate Claim**: `Claim Value = (PTR - InvRate) * SaleQty`
3. Align the frontend web view (`free-scheme-report-view.tsx`) with the gold-standard 15-column reference PDF, including Customer groupings, Item Summary table, and Grand Totals.
4. Synchronize export endpoints (`/api/reports/download-sales`) for Excel and PDF to mirror the exact columns, formulas, and totals.
5. Validate end-to-end data accuracy against the reference September 2026 STARTOS dataset (10 rows, 3 customers).

---

## Tasks & Waves

### Wave 1: Backend Query Engine Hardening (`api-server`)
- [x] Refactor `/claim-data` endpoint in `api-server/src/routes/reports.ts`:
  - Ensure any stale data in `pdyasvtrans.claimdata` is purged (`DELETE FROM claimdata WHERE UniqueCode = ?`) before procedure execution.
  - Support isolated session-specific `uniqueCode` generation (`claim-${Date.now()}-${random}`) to avoid temporary table collisions.
  - Automatically purge temporary session data from `claimdata` after response retrieval.
- [x] Validate `api-server` query execution for `STARTOS` across single-company and multi-company scenarios.

### Wave 2: Calculation Engine & Formula Standardization
- [x] Standardize claim value calculations in `free-scheme-report-view.tsx`:
  - Free Scheme / Qty Claim: calculate `Claim Value = PRate * ClaimQty`.
  - Rate Claim: calculate `Claim Value = (PTR - InvRate) * SaleQty`.
- [x] Standardize calculations in export route `src/app/api/reports/download-sales/route.ts`.
- [x] Ensure currency and decimal values are consistently rounded to 2 decimal places.

### Wave 3: UI Table Layout & Summary Section Alignment
- [x] Standardize table columns in `src/components/free-scheme-report-view.tsx` to match the 15-column reference format:
  1. Inv. No.
  2. Inv. Dt.
  3. Customer Name
  4. Item Name
  5. Packing
  6. Batch No.
  7. Exp. Date
  8. Sale Qty
  9. Free Qty
  10. Scheme %
  11. Claim Qty
  12. PTR / Rate
  13. PRate
  14. Claim Amt
  15. Net Rate / Diff Rate
- [x] Refactor table row rendering: group by Customer with party subtotal rows.
- [x] Implement the `Summary :` block at the bottom with aggregated `Item Name`, `Packing`, `Sale Qty`, `Free Qty`, and `Claim Qty`.
- [x] Render the Company Grand Total row.
- [x] Retain and polish the debug query banner.

### Wave 4: Export Endpoints Synchronization
- [x] Update `src/app/api/reports/download-sales/route.ts` Excel builder with identical 15 columns, Customer subtotals, Item Summary section, and Grand Totals.
- [x] Update PDF export generator in `src/lib/pdf.ts` / download route with matching landscape columns and totals.
- [x] Ensure export endpoints enforce identical MR company filtering.

### Wave 5: Verification & Quality Assurance
- [x] Test September 2026 STARTOS query and verify 100% match with the reference PDF (`media_1791895909214.pdf`).
- [x] Run `pnpm run check:write` / lint checks.
- [x] Run `pnpm run typecheck` (`tsc --noEmit`).
- [x] Verify `api-server` build: `npm run build` in `api-server`.
- [x] Present completed work to the user for review before any commit or push (STRICT: no git push).
