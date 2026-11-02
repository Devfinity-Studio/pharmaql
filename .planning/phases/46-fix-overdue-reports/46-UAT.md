# Phase 46 UAT: Fix Overdue Reports (Receipt Multiplication & Multi-MR Alignment)

## Intent Verification
Eliminate the discrepancy between Technomax legacy ERP overdue statements and PharmaQL's web/download outstanding reports caused by multi-voucher receipts, while supporting company-wide Multi-MR reports.

---

### Criteria & Verification Results

1. **Stored Procedure Argument Alignment**
   - **Legacy ERP Stack Call**:
     `CALL rptMRwisePeriodicalOutstanding(11, 11, 202627, {d '2026-04-01'}, {d '2026-10-31'}, {d '2026-10-31'}, '', '', 'All', '', '', '(''AVRIVA'')', '', '', '')`
   - **API Server 1.3.0 Call**:
     Verified live on `api.asmeepharma.com` with `POST /api/reports/mr-overdue`. Stored procedure produces identical output rows.

2. **Invoice Receipt Multiplication Problem Solved**
   - **Root Cause**: An invoice settled with $N$ receipt vouchers returned $N$ rows from the procedure. Individual row filters evaluated each partial voucher independently, leaving fully settled invoices showing up repeatedly.
   - **Fix**: Group by unique invoice identifier (`ID` / `DocNo`), aggregate `SUM(AdjAmt)`, and filter out zero-balance invoices (`originalAmt - totalAdj <= 0.001`).
   - **Math Verification**:
     * Total pending invoices: **38** (down from 154 raw voucher rows).
     * Dewanshu Patel: Inv ₹26,725.00 | Rec ₹0.00 | Pending ₹26,725.00
     * Udita Chauhan: Inv ₹30,217.00 | Rec ₹0.00 | Pending ₹30,217.00
     * Divya Kanojiya: Inv ₹61,633.00 | Rec ₹6,195.00 | Pending ₹55,438.00
     * Sohel Saiyad: Inv ₹900.00 | Rec ₹0.00 | Pending ₹900.00
     * **Grand Total**: Inv ₹1,19,475.00 | Rec ₹6,195.00 | Pending ₹1,13,280.00
     * Exactly matches legacy ERP PDF artifact (`media_1793440258396_fbb134f2.pdf`).

3. **Multi-MR Company-Wide Export**
   - Enabled `/api/reports/download-outstanding` to run for company-wide statements without requiring a specific `mrId`.
   - Excel and CSV downloads produce the identical 38 rows and exact ₹1,19,475.00 / ₹6,195.00 / ₹1,13,280.00 totals.

4. **MR Auto-Blocking Protection**
   - `evaluateOverdueInvoices` in `src/lib/overdueUtils.ts` aggregates invoices by ID before checking aging and threshold limits. Fully paid invoices with multiple vouchers are never counted against an MR.

5. **Test Suite and Type Safety**
   - `pnpm exec tsc --noEmit`: 0 errors.
   - `pnpm test`: 25 test suites, 142 tests passing.
   - `pnpm build`: 100% successful Next.js production build.

