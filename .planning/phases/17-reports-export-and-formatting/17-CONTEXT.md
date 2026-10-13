# Phase 17 Context: Reports Export and Formatting Improvements

## Background & Problem Statement
PharmaQL generates multi-dimensional pharmaceutical reports across Stock Movement, Customer Item Sales, Party-Wise Sales, Periodical Overdue, and Free Scheme Claims.
Currently:
1. Export downloads across CSV and PDF have varying filename patterns, missing column alignments, and need consistent formatting across all tabs.
2. Excel downloads currently serve CSV content; having clean formatted Excel/CSV exports with proper currency, numeric types, and summary rows will significantly improve distributor and MR usability.
3. PDF reports in `src/lib/pdf.ts` need consistent table column widths, wrapping, and header branding so print and download operations never truncate wide columns.
4. Date range filters (`from` and `to`) must be seamlessly synchronized between report tabs, URL query parameters, stored procedure callers, and download modal filters.

## Scope of Phase 17
1. **Export & Download Pipeline Polish**:
   - Verify and enhance `/api/reports/download*` endpoints (Stock, Sales, Outstanding, Free Schemes) for clean CSV/Excel output with proper headers, summary rows, and standardized filename naming conventions (`<MR>_<Division>_<ReportType>_<DateRange>.<ext>`).
2. **PDF Styling & Print Layout Refinement**:
   - Audit and tune `src/lib/pdf.ts` table column formatting, summary footers, and page numbers across landscape wide tables.
3. **Date Range Filtering Enhancements**:
   - Provide consistent date filtering behavior across all report views with preset shortcuts (Financial Year, Current Month, Custom Range) and ensure query parameters propagate seamlessly into exports.
4. **Build & Type Safety Verification**:
   - Ensure zero TypeScript compiler errors and clean production builds.
