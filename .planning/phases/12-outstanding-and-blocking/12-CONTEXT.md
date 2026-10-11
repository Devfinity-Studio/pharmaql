# Phase 12: Outstanding & Blocking Management - Context

## Objective
Implement live party/customer outstanding analysis, overdue ageing tracking, and blocking controls (MR account blocking + Party credit/overdue blocking) connected directly to the legacy MySQL schemas.

## Requirements & Scope
1. **Outstanding & Overdue Calculations**:
   - Query live stored procedure `pdyasvtrans.rptMRwisePeriodicalOutstanding`.
   - Filter net outstanding entries where `(Amount - AdjAmt) > 0`.
   - Ageing threshold highlighting: Flag days overdue > 90 in prominent red styling.
   - Comprehensive party/customer-wise summaries with export capabilities (CSV, Excel, PDF).

2. **MR Blocking System**:
   - Toggle MR block status via Admin UI.
   - Enforce blocking during authentication (disallow OTP request and session generation for blocked MRs).
   - Reject active sessions immediately if MR status is blocked.
   - Persist blocking flags via `data/mr_overrides.json` and sync with `pdyasvmaster.l_mktcompany_mr.IsInActive`.

3. **Party / Customer Blocking**:
   - Track party blocking status from ERP (`IsBlocked` / `InActive` from `m_customer`).
   - Highlight blocked parties in overdue statements and product sales views.
