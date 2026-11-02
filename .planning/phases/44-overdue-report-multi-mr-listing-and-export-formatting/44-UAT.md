# Phase 44 UAT: Overdue Report Multi-MR Listing and Export Formatting

## Status: COMPLETE (Verified & Validated)

---

### Verification Summary

1. **Stored Procedure Parameter & Date Range Resolution**:
   - `p_FromDt`: Hardened to base financial year start (`{d '2026-04-01'}`), preventing filter pollution when navigating from other dashboard tabs.
   - `p_RecDt`: Set to `{d '2026-04-01'}`.
   - `p_ToDt`: Dynamically maps to the selected AsOn Date (`{d '<AsOnDate>'}`).
   - `p_MRId`: Evaluates to `''` for company-division wide report, returning all MRs under the selected division/company.
   - Verified SQL pattern:
     ```sql
     CALL `pdyasvtrans`.`rptMRwisePeriodicalOutstanding`(11, 11, 202627, {d '2026-04-01'}, {d '2026-04-01'}, {d '2026-10-31'}, '', '', 'All', '', '', '(''AVRIVA'')', '', '', '')
     ```

2. **Single "AsOn Date" Filter Bar (`src/components/date-range-picker.tsx` & `src/components/mr-dashboard-content.tsx`)**:
   - Overdue tab exclusively renders a single date input with label **"AsOn Date"**.
   - Added instant shortcut presets for "Today" and "Prev Month End" in single date mode.
   - Cleanses conflicting `from` date query parameters, ensuring `asOn` and `to` are synchronized.

3. **Hierarchical Multi-MR Web View (`src/components/overdue-report-view.tsx`)**:
   - Groups records by `MR Name -> City/Area -> Party -> Invoices`.
   - Party sub-headers display customer name, address, opening balance tag, and live ERP blocking badges.
   - Renders individual party subtotals, MR subtotals for each MR, and company-division Grand Total.
   - Direct and division overdue threshold warnings remain active based on dynamic tenant configuration.

4. **Synchronized Multi-MR PDF & Print Exports (`src/lib/pdf.ts` & `src/components/outstanding-download-buttons.tsx`)**:
   - Enhanced `generateGroupedPdfReport` in `src/lib/pdf.ts` to compute and display subtotals for **all three monetary columns** (`Invoice Amount`, `Received Amount`, `Pending Amount`) per MR section.
   - Grand Total row displays company-division aggregate sums across all 3 monetary columns.
   - Header stationery reflects `MRwise Periodical Outstanding Statement as on DD/MM/YYYY`.

5. **Multi-MR Excel & CSV Exports (`src/app/api/reports/download-outstanding/route.ts`)**:
   - Formatted spreadsheet data grouped MR-wise.
   - In multi-MR statements, automatically inserts an explicit `Total for <MR Name>` subtotal row after each MR's records.
   - Appends a final Grand Total row with formatted currency `#,\#\#0.00`.
   - CSV export outputs MR Name, customer details, and individual subtotals.

6. **Automated Testing & Builds**:
   - TypeScript compilation (`pnpm exec tsc --noEmit`): 0 errors.
   - Vitest test suite (`pnpm test`): 25 test suites, 138/138 tests passed.
   - Next.js production build (`pnpm run build`): All 19 routes compiled cleanly with 0 errors.
