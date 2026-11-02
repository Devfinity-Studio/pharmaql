# Phase 44: Overdue Report Multi-MR Listing and Export Formatting - Context

## Executive Summary
The Overdue (Purchase Days & Outstanding) report previously focused on single MR queries. According to Technomax ERP standards (`rptMRwisePeriodicalOutstanding`), the Overdue report is fundamentally an MR-wise listing of **all MRs** across a company/division as of a specific date ("AsOn Date").

## Key Requirements & User Directives
1. **Multi-MR Company-Division Listing**:
   - The report must list all MRs belonging to the selected company/division rather than only a single MR.
   - When calling stored procedure `rptMRwisePeriodicalOutstanding`, passing `p_MRId = ''` (empty string) instructs the database to return all MR records for that company-division.
   - If a specific MR filter is selected, `p_MRId` will filter to that specific MR.

2. **Single Date Filter ("AsOn Date")**:
   - The query requires a cutoff date (`p_ToDt = {d '<AsOnDate>'}`).
   - `p_FromDt` and `p_RecDt` must both be set to the base financial year start (`{d '2026-04-01'}`).
   - In the UI filter bar and export dialogs, the date selector must strictly present a single "AsOn Date" input, eliminating confusion caused by a "From Date - To Date" range.

3. **Export & Print Synchronization (PDF, Excel, CSV, Print)**:
   - Ensure PDF, Excel, CSV, and Print features mirror the multi-MR breakdown.
   - In PDF: Group by MR with MR headers, calculate subtotals for each amount column (`Invoice Amount`, `Received Amount`, `Pending Amount`), and show the Grand Total.
   - In Excel: Format with MR grouping/separation, individual invoice details, party totals, MR subtotals, and Grand Total.
   - In CSV: Include `MR Name`, party details, and complete column breakdown with summary rows.
   - Header formatting across all exports must clearly indicate "AsOn Date: DD/MM/YYYY" and the Company/Division.

