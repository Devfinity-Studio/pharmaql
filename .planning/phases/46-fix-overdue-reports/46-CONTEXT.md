# Phase 46 Context: Fix Overdue Reports

## Background & Historical Context
In previous phases (Phase 42 and Phase 44), the Overdue Report was transformed from a single-MR query to a company-wide Multi-MR hierarchical statement based on Technomax ERP conventions.

During live usage, two key adjustments were identified:
1. **Stored Procedure Parameter Signature Alignment**:
   In `rptMRwisePeriodicalOutstanding`, the 3 date parameters are:
   - Param 4: `p_FromDt` - Base financial year start (`2026-04-01`)
   - Param 5: `p_AsOnDt` - As On cutoff date entered from the date header (e.g. `2026-10-31`)
   - Param 6: `p_RecDt` - Payment received cutoff date (defaults to As On date or custom date)
   Previously, the date parameters were misaligned in some layers, passing `p_RecDt` before `p_AsOnDt`.

2. **Company-Wide Export Authorization**:
   In `src/app/api/reports/download-outstanding/route.ts`, the export endpoint strictly required `mrId`, returning a 400 error when attempting to export company-wide Multi-MR reports where `mrId` is deliberately empty.

3. **Dual Date Header Controls**:
   In `src/components/date-range-picker.tsx`, when viewing the Overdue tab (`showReceivedDate=true`), the user must be able to specify both the **AsOn Date** and **Received Date**, with quick presets ("Today", "Prev Month End") updating both dates simultaneously.

## Technical Scope
1. `api-server/src/routes/reports.ts` & `src/utils/spValidator.ts`:
   - Validate and order parameters: `[compNo, locNo, finYear, odbcFromDate, odbcAsOnDate, odbcRecDate, ...]`
2. `src/components/date-range-picker.tsx`:
   - Synchronize `to` (AsOn Date) and `recDate` (Received Date).
3. `src/components/overdue-report-view.tsx`:
   - Display AsOn Date and Received Date summary badges.
   - Calculate Running Balance, MR Subtotals, and Grand Total.
4. `src/app/api/reports/download-outstanding/route.ts`:
   - Remove strict requirement for `mrId`.
   - Support company-wide PDF, Excel, and CSV downloads.
5. `src/components/outstanding-download-buttons.tsx`:
   - Forward both `asOn` and `recDate` to export URLs.

