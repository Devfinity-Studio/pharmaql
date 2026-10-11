# Phase 12 Plan: Outstanding & Blocking Management

## Overview
Implement an automated overdue enforcement engine, division cascading blocking, 80–90 day warning popup modals, party blocking badges, and password-protected Admin unblocking controls, all backed directly by legacy MySQL procedures and local JSON overrides without creating any database tables.

---

## Tasks & Wave Execution

### Wave 1: Overdue Engine & Customer Blocking Service

- [ ] **Task 12.1: Centralized Overdue & Cascading Block Engine**
  - **File:** `src/server/actions/overdueEngine.ts`
  - **Logic:**
    - Call `getMRwisePeriodicalOutstanding` from `src/server/actions/overdueReports.ts`.
    - Filter entries strictly where `(Amount - AdjAmt) > 0`.
    - Evaluate overdue tiers for MR:
      - `CLEAN`: No invoices >= 80 days.
      - `WARNING`: At least one invoice with `80 <= OverDays <= 90`. Calculates impending block date (`DocDate` or `DueDate` + 91 days).
      - `DIRECT_BLOCKED`: Any invoice with `OverDays > 90`.
    - Check division cascading: If MR has no >90 day overdue invoices, check if any peer MR sharing the same `DivisionID` in `pdyasvmaster.l_mktcompany_mr` is `DIRECT_BLOCKED`. If yes, mark MR as `DIVISION_BLOCKED` and attach `responsibleMrName`, `responsibleMrId`, `invoiceNo`, `amount`.
    - Respect admin exemptions in `data/mr_overrides.json` (e.g. `unblockedUntil` or explicit admin override).

- [ ] **Task 12.2: Customer / Party Blocking Lookup**
  - **File:** `src/server/actions/customerBlocking.ts`
  - **Logic:**
    - Query `pdyasvmaster.m_customer` for `CustCode`, `InActive`, `BlackList`, `NotAllowInvoice`, `BlackListRmk`, `MaxOutDays`.
    - Cache customer blocking map or provide batch lookup function for reports.

---

### Wave 2: Auth Gateways & MR Dashboard Warning Modal

- [ ] **Task 12.3: Enforce Blocking on Login & Session Check**
  - **Files:** `src/server/actions/authActions.ts`, `src/server/auth.ts`
  - **Logic:**
    - In `requestMrOtp(email)`:
      - Evaluate MR overdue status via `evaluateMrOverdueStatus(mr.id)`.
      - If `DIRECT_BLOCKED`: Return error with pending invoice number, amount, and overdue days.
      - If `DIVISION_BLOCKED`: Return error informing that division access is suspended due to pending payment by `responsibleMrName`.
    - In `verifyMrOtp`: Re-validate overdue status before issuing signed JWT session cookie.
    - In `getSession`: Invalidate MR sessions if overdue block is active and no admin exemption exists.

- [ ] **Task 12.4: MR Dashboard Warning Popup & Alert Banner (80–90 Days)**
  - **Files:** `src/components/mr-overdue-warning-modal.tsx`, `src/components/mr-dashboard-content.tsx`
  - **Logic:**
    - When MR status is `WARNING`, display an interactive popup dialog on login:
      - Details pending invoice numbers, net amount, current overdue days, and exact auto-block deadline.
      - Dismissible for session, but persistent alert banner remains at top of dashboard.

- [ ] **Task 12.5: Overdue Report View Net Filter, >90d Red Highlight & Party Badge**
  - **File:** `src/components/overdue-report-view.tsx`
  - **Logic:**
    - Filter records strictly where `(Amount - AdjAmt) > 0`.
    - Highlight rows where `OverDays > 90` with red styling (`text-red-700 bg-red-50/70 font-bold`).
    - Render red `BLOCKED` / `BLACKLISTED` badge next to customer names if flagged in `m_customer`.

---

### Wave 3: Admin Overdue Control Center & Password-Protected Unblock

- [ ] **Task 12.6: Admin Overdue Control Center on `/admin/mrs`**
  - **Files:** `src/app/admin/mrs/page.tsx`, `src/app/admin/mrs/overdue-mrs-section.tsx`
  - **Logic:**
    - Add tabs/cards for:
      - **About to Overdue (80–90d)**: Countdown to block date.
      - **Overdue Blocked (>90d)**: Directly auto-blocked MRs.
      - **Division Blocked**: Collateral blocked MRs with link to responsible MR.
    - Badges on MR cards indicating overdue count and maximum days.

- [ ] **Task 12.7: Secure Password-Protected Unblock Modal**
  - **Files:** `src/server/actions/adminUnblockActions.ts`, `src/app/admin/mrs/unblock-modal.tsx`
  - **Logic:**
    - Unblock button triggers a modal requiring Admin password.
    - Server action verifies password against `env.ADMIN_PASSWORD`.
    - Records unblock action in `data/mr_overrides.json` with timestamp, admin email, reason, and optional grace period expiry.
    - Revalidates paths `/admin/mrs` and `/dashboard`.

---

## Verification Criteria
1. `pnpm exec tsc --noEmit` exits with 0 errors.
2. `pnpm run build` succeeds across all routes.
3. Test MR with invoice in 80–90 days range: Receives warning popup with invoice details and block date.
4. Test MR with invoice > 90 days: Blocked from login with informative error message.
5. Peer MR in same division: Blocked with notice showing responsible MR's name.
6. Admin password unblock: Prompts for password, rejects incorrect password, unblocks MR on valid password.
