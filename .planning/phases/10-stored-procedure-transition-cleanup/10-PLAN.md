# Phase 10: Legacy Stored Procedure Transition & Cleanup

**Goal:** Transition live stored procedures to production-ready status across the MR portal, configure debug query visibility behind a query toggle (`?debug=1`), align Overview metrics with procedure data, and ensure robust error handling and exports.

---

## Context & Background

During troubleshooting, 5 core reports were connected to MySQL stored procedures:
1. **Product Wise Sales:** `pdyasvtrans.rptItemCustomerSale`
2. **Party Wise Sales:** `pdyasvtrans.rptCompanyCustomerItemwiseSales`
3. **Stock & Sales Statement:** `pdyasvtrans.rptStockMovementStatement`
4. **Claim Qty:** `pdyasvtrans.rptSaleFreeQtyStatement` & `rptClaimData`
5. **Overdue & Periodical Outstanding:** `pdyasvtrans.rptMRwisePeriodicalOutstanding`

Additionally:
- Full company names (e.g., `"STARTOS HEALTHCARE PVT LTD"`) are standardized using `formatCompanyCodeParam` to pass only first words (`"STARTOS"`).
- Temporary `[DEBUG QUERY]` visual banners and extensive console logs were placed in report views.
- Overdue statements were filtered for `Amount - AdjAmt > 0`, highlighting records with $> 90$ purchase days in red.

---

## Tasks & Execution Plan

### Task 1: Clean Up & Gate Debug Query Banners Behind Toggle
- **Files:**
  - `src/components/product-report-view.tsx`
  - `src/components/party-report-view.tsx`
  - `src/components/stock-report-view.tsx`
  - `src/components/free-scheme-report-view.tsx`
  - `src/components/overdue-report-view.tsx`
  - `src/components/mr-dashboard-content.tsx`
- **Action:**
  - Add `isDebug = searchParams?.debug === "true" || searchParams?.debug === "1" || process.env.NODE_ENV === "development"` or explicit toggle check so raw SQL queries are hidden from end users in production unless `?debug=1` is explicitly present in URL.
  - Ensure all debug banners have `print:hidden` so printable versions are clean.

### Task 2: Align Overview Dashboard Metrics with Live Procedures
- **Files:**
  - `src/components/mr-dashboard-content.tsx`
- **Action:**
  - Connect Overview card summaries (Total Sales, Total Invoices, Outstanding Balance) to procedure aggregated results when local tables are unpopulated for the MR.
  - Prevent displaying ₹0.00 when the MR has active sales and outstanding data in the procedures.

### Task 3: Export & Print Consistency
- **Files:**
  - `src/components/report-download-buttons.tsx`
  - `src/components/outstanding-download-buttons.tsx`
  - `src/app/api/export/...`
- **Action:**
  - Verify that export actions and print stylesheets work cleanly with the live procedure datasets.
  - Ensure date formatting, currency symbols, and headers match client-facing standards.

### Task 4: End-to-End Verification & Git Checkpoint
- **Files:** All modified files
- **Action:**
  - Validate with `pnpm exec tsc --noEmit`.
  - Validate all report tabs: Overview, Stock & Sales, Party Wise, Product Wise, Claim Qty, Overdue.
  - Commit and push strictly to `origin/localdb`.

---

## Acceptance Criteria
- [ ] Debug query banners only appear when `?debug=1` (or in explicit debug mode), keeping the UI clean by default.
- [ ] Overview tab accurately reflects live sales and outstanding metrics.
- [ ] Overdue statement continues filtering for `Amount - AdjAmt > 0` with red highlighting for days $> 90$.
- [ ] All 5 procedures execute reliably without parameter mismatch errors.
- [ ] TypeScript checks pass with 0 errors.
