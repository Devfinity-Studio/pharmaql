# Phase 30: MR Ranking Database Synchronization & Overdue Cascading Blocking - Context

## 1. Problem Statement & User Requirements
1. **MR Ranking Synchronization**:
   - The client reported that updating an MR's rank directly in the legacy MySQL database (e.g. `l_mktcompany_mr`, `m_user`, or changing job profiles) does not reflect or update in the web portal.
   - **Root Causes**:
     - `api-server/src/routes/master.ts`: `SELECT_MKT_MR_COLUMNS` was missing `mr.Rank AS Rank` (or database column fallback).
     - In Next.js `mrInfo.ts`: Stale overrides in `data/mr_overrides.json` or cached session tokens took precedence over fresh database rank data.
     - Stateless JWT session cookies did not refresh the MR's rank dynamically upon subsequent requests without logging out and back in.
2. **Direct Overdue Blocking (>90 Days)**:
   - When an MR has any invoice with net pending balance (`Amount - AdjAmt > 0`) overdue by more than 90 days (`> 90 days`), that specific MR must be blocked from logging in.
   - Instead of a small text error, the login interface must present a clear, dedicated "Account Suspended / Contact Admin" screen displaying:
     - Warning banner stating account is on hold due to overdue payments.
     - Summary of blocking invoice(s): Customer name, Invoice No, Net Amount, and Days Overdue.
     - Instructions to clear payment or contact system administrator.
3. **Division Cascading Blocking (>95 Days)**:
   - Previously, division cascading blocking occurred at >90 days simultaneously with individual blocking.
   - **New Calibration**: Peer MRs in the same division are **not** blocked at 90 days. They are only blocked if an invoice remains unpaid after **95 days** (`> 95 days`).
   - When a peer MR from the same division attempts to log in (or browse), they are blocked and shown a specific notification/screen explaining:
     - Division access for their division is temporarily suspended.
     - Specifically states **which MR** (`responsibleMrName` / `responsibleMrId`) has overdue payments exceeding 95 days.
     - Lists the responsible invoice number and pending amount.

## 2. Technical Architectural Scope
- **Backend API Service (`api-server`)**:
  - Update `SELECT_MKT_MR_COLUMNS` and `normalizeLegacyMR` in `api-server/src/routes/master.ts`.
  - Safely select `mr.Rank AS Rank` (and fallback to column checks if schema varies).
  - Ensure `/api/master/mrs` and `/api/master/mr-info/:id` always return the true database rank and updated job profile.
- **Next.js Core (`src/server/actions/mrInfo.ts`)**:
  - Align rank resolution so fresh database rank is prioritized over stale local overrides.
  - In `src/server/auth.ts`: Ensure `getSession()` syncs the latest rank and blocking status on user requests.
- **Overdue Engine (`src/server/actions/overdueEngine.ts`)**:
  - Individual Direct Block: `overDays > 90`.
  - Division Cascading Block: `peer.overDays > 95` (calibrated from 90 to 95).
  - Include detailed `responsibleMrName`, `responsibleMrId`, `responsibleInvoiceNo`, and `responsibleAmount` in evaluation result.
- **Login UI (`src/app/login/login-form.tsx`)**:
  - Build a high-clarity "Blocked / Contact Admin" modal or card view with distinct visual treatment for:
    1. Direct MR Block (>90d): Overdue invoice details + Admin contact prompt.
    2. Division Cascading Block (>95d): Peer MR attribution card explaining which MR caused the division hold.
