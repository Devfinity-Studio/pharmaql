# Phase 42: Overdue Report Fix - Context

## Overview
Investigation and resolution of issues in the Overdue (Purchase Days & Outstanding) Report across the ERP API ingestion, server action handling, filtering, and UI display.

## Scope & Target Areas
1. **API Endpoint & Stored Procedure Execution**:
   - Inspect `/api/reports/mr-overdue` calling stored procedure `rptMRwisePeriodicalOutstanding`.
   - Verify parameter alignment (`compNo`, `locNo`, `finYear`, `odbcFromDate`, `odbcToDate`, `compCode`, `mrId`, etc.).
2. **Server Action & Data Processing**:
   - `src/server/actions/overdueReports.ts`: `getMRwisePeriodicalOutstanding`.
   - `src/server/actions/overdueEngine.ts`: MR overdue status calculation and blocking logic.
3. **Frontend Presentation & Filters**:
   - `src/components/overdue-report-view.tsx`: Division/manufacturer filtering, customer/party search, date range resolution, and grouping.
   - Outstanding balance calculation: ensuring `Amount - AdjAmt > 0` and purchase days calculation remain accurate.
4. **Offline Sync & Download**:
   - Verify offline caching in IndexedDB (`OfflineReportSync`) and Excel/PDF generation for overdue records.
