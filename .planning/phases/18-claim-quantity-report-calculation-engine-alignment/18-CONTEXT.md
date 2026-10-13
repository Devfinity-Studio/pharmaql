# Phase 18 Context: Claim Quantity Report & Calculation Engine Alignment

## Background & Problem Statement
PharmaQL provides MRs and administrators with a Claim Quantity / Free Scheme report to reconcile claims submitted to pharmaceutical manufacturers for goods distributed under promotional schemes (such as "10+1 free" or rate differences).

### Identified Issues
1. **Stuck on Skeleton / Heavy Response Freeze**:
   - Queries without strict date ranges or company boundaries returned 8,500+ raw records across all 71 ERP companies into the Next.js SSR pipeline, causing request freezes and browser hangs.
2. **Data Bleeding Across Unassigned Companies**:
   - A logic flaw (`.includes("")` matching empty strings `""`) caused data from unrelated companies (e.g. `AAGAM`, `ALEMBIC`) to be displayed to MRs who were only assigned to specific companies (e.g. `STARTOS`).
3. **Calculation Discrepancies**:
   - Free Scheme (Qty Claim) vs. Rate Claim calculations were inconsistent with standard ERP accounting.
   - Ground truth from reference PDF (`Claim Quantity Statement for Period of 01-09-2026 to 30-09-2026`):
     - **Qty Claim (Free Scheme)**: `Claim Value = PRate * ClaimQty` (Distributor claims purchase cost from manufacturer for bonus goods issued).
     - **Rate Claim**: `Claim Value = (PTR - InvRate) * SaleQty` or `(NetRate - InvRate) * SaleQty`.
4. **Stored Procedure Failure & Stale GUID Accumulation**:
   - In MySQL, `rptSaleFreeQtyStatement` joins `i.MktBy = Company1.MktBy`. `m_item.MktBy` stores full descriptions (`STARTOS HEALTHCARE PVT LTD`), while parameters often passed short codes (`STARTOS`).
   - `claimdata` table never executed `DELETE FROM claimdata WHERE UniqueCode = ...`, causing thousands of stale rows across all companies to accumulate under static GUIDs and get re-served on subsequent requests.
5. **Report Layout Mismatch**:
   - Table columns, item summary blocks (`Item Name, Packing, Sale Qty, Free Qty, Claim Qty`), and grand totals did not match the official 15-column reference PDF format.

---

## Technical Decisions & Architecture

1. **Backend Query Architecture (`api-server/src/routes/reports.ts`)**:
   - Replace or harden `/claim-data` endpoint:
     - Ensure clean transaction boundaries: either delete stale records from `claimdata` for the session UUID before executing `rptSaleFreeQtyStatement`, or use direct parameterized SQL joining `h_sale`, `l_sale`, `m_customer`, and `m_item`.
     - Direct SQL provides deterministic, sub-50ms execution, exact company matching via `m_item.MktBy` or `m_mktcompany.Description`, and complete isolation.
2. **Formula Standardizations**:
   - Qty Claim: `Claim Value = PRate * ClaimQty`.
   - Rate Claim: `Claim Value = (PTR - InvRate) * SaleQty`.
3. **Strict MR Company Isolation**:
   - Both web view and export APIs must strictly constrain results to `mrInfo.company`, `mrInfo.companyCode`, `mrInfo.division`, and `assignedManufacturers`.
4. **Layout Alignment with Reference PDF**:
   - Standard 15 columns: Inv. No., Inv. Dt., Customer Name, Item Name, Packing, Batch No., Exp. Date, Sale Qty, Free Qty, Scheme %, Claim Qty, PTR, PRate, Claim Amt, Diff / Net Rate.
   - Customer-grouped rows with subtotals.
   - Item Summary table at bottom (`Summary :`) displaying aggregated `Sale Qty`, `Free Qty`, and `Claim Qty` per product.
   - Company Grand Total row.
5. **Export & Print Synchronization**:
   - Synchronize `src/app/api/reports/download-sales/route.ts` and `src/lib/pdf.ts` with identical logic, formulas, and headers.
6. **Debug Visibility**:
   - Retain the debug query banner at the top of the report view for full observability.
