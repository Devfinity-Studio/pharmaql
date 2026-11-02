# Phase 47 Context: Admin Overdue Blocking Days, Max Data Limit & Unrestricted Admin MR Access

## User Requirements
1. **Admin Overdue Blocking Days Configuration**:
   - Provide an option for Admins to set overdue blocking days (direct block limit and cascading division block days).
   - Ensure these settings are dynamically passed and used in overdue evaluations across web and exports.
2. **Max Data Limit for MRs**:
   - Add an option allowing Admins to set a maximum data window for MRs (e.g. 60 days).
   - If set (e.g. 60 days), no MR can view or query data older than 60 days from today across date pickers, reports, and backend actions.
   - Admins remain unrestricted.
3. **Admin Full Visibility Across All MRs Regardless of Rank**:
   - Ensure that even if an MR has a lower rank (Rank 1, 2) that restricts them from viewing specific reports, Admins can view all reports for all MRs without restriction.
