# Phase 12: Outstanding & Blocking Management - Context

## Locked Decisions & Requirements

### 1. MR Account Blocking
- **Enforcement on Login:**
  - When an MR account is marked blocked (either via `pdyasvmaster.l_mktcompany_mr.IsInActive = 1` or `data/mr_overrides.json`), the system must **strictly block OTP request**:
    - Returns error: `"Account is blocked. Please contact your administrator."`
  - In `verifyMrOtp`: Reject authentication even if OTP was previously requested.
  - In `getSession`: When checking an active JWT token for role `"MR"`, verify current block status and invalidate session if blocked.
- **Admin UI Controls:**
  - Admin toggle in `/admin/mrs` and `/admin/mrs/[id]` enables/disables MR block status.
  - Updates persist in `data/mr_overrides.json`.

### 2. Overdue & Outstanding Reporting
- **Data Source:**
  - Live execution of `CALL pdyasvtrans.rptMRwisePeriodicalOutstanding(...)`.
- **Filtering:**
  - Display and calculate records only where `(Amount - AdjAmt) > 0`.
- **Ageing & Alert Styling:**
  - For each outstanding invoice row, calculate or read `OverDays`.
  - When `OverDays > 90`, highlight the days and amount in bold red text / soft rose background (`text-red-700 bg-red-50/70`).
- **Party Summary:**
  - Group and summarize net balance per party and per division.
  - Exports (CSV, Excel, PDF) include overdue days and net pending balance.

### 3. Party / Customer Blocking
- **ERP Master Inspection:**
  - Query `pdyasvmaster.m_customer` fields:
    - `InActive` (1 = Inactive)
    - `BlackList` (1 = Blacklisted)
    - `NotAllowInvoice` (1 = Invoicing Restricted)
    - `MaxOutDays` (allowed overdue days)
    - `CrossigLimitAmt` (credit limit)
- **UI Presentation:**
  - Surface a prominent badge in overdue statements and party views for blocked/blacklisted customers:
    - E.g. `<span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">BLOCKED</span>` or `BLACKLISTED`.
  - Display reason if available (`BlackListRmk` or `InActive`).

---

## Technical Interfaces & File Targets
- `src/server/actions/authActions.ts`: Add MR block check in `requestMrOtp` and `verifyMrOtp`.
- `src/server/auth.ts`: Add live block validation in `getSession`.
- `src/server/actions/mrs.ts`: Ensure `toggleMRBlockStatus` syncs with `data/mr_overrides.json`.
- `src/server/actions/customerBlocking.ts`: Helper to fetch customer status flags from `pdyasvmaster.m_customer`.
- `src/components/overdue-report-view.tsx`: Implement `Amount - AdjAmt > 0` filter, >90 days red highlighting, and customer block badge.
- `src/app/api/reports/download-outstanding/route.ts`: Match net amount filter and ageing columns in downloads.
