# Phase 30: MR Ranking Database Synchronization & Overdue Cascading Blocking - Plan

## Objective
Fix legacy MySQL database rank synchronization so ERP rank updates immediately reflect across the portal, enforce direct MR login blocking with a rich "Contact Admin" screen at >90 days overdue, and calibrate division cascading blocking to trigger only after 95 days overdue with clear attribution of the responsible MR.

---

## Detailed Task Breakdown

### Task 1: API Server Database Rank Querying & Normalization
- **File**: `api-server/src/routes/master.ts`
- **Actions**:
  1. Add `mr.Rank AS Rank` (or database column lookup) to `SELECT_MKT_MR_COLUMNS`.
  2. In `normalizeLegacyMR`, ensure `raw.Rank` is parsed into `1 | 2 | 3` and mapped to permissions.
  3. Ensure `/api/master/mr-info/:id` and `/api/master/mrs` return the rank directly from MySQL.
  4. Ensure cache invalidation or brief TTL allows rapid propagation of database updates.

### Task 2: Next.js MR Info Rank Precedence & Session Refresh
- **Files**: `src/server/actions/mrInfo.ts`, `src/server/auth.ts`, `src/server/actions/authActions.ts`
- **Actions**:
  1. In `src/server/actions/mrInfo.ts`, ensure database `rawData.rank` / `m.rank` takes precedence over stale `mergedOverride.rank`.
  2. In `src/server/auth.ts`, verify `getSession()` revalidates active MR permissions and rank against `getMRInfo(user.id)` so changing rank immediately changes report access without requiring the user to clear cookies.

### Task 3: Overdue Engine Calibration (>90d vs >95d)
- **File**: `src/server/actions/overdueEngine.ts`
- **Actions**:
  1. Verify Individual MR Block threshold is strictly `overDays > 90` with net amount > 0.
  2. Calibrate Division Cascading Block threshold to strictly `overDays > 95`:
     ```ts
     const peerBlocking = peerItems.filter((p) => {
       const net = Number(p.Amount || 0) - Number(p.AdjAmt || 0);
       return net > 0 && Number(p.OverDays || 0) > 95;
     });
     ```
  3. In Division Cascading Block return payload, explicitly format `responsibleMrName`, `responsibleMrId`, `responsibleInvoiceNo`, `responsibleAmount`, and an unmistakable customer/division message.

### Task 4: Login Screen "Contact Admin" Blocked Screen
- **Files**: `src/app/login/login-form.tsx`, `src/app/login/page.tsx`
- **Actions**:
  1. Expand `requestMrOtp` and `verifyMrOtp` to return structured `blockedInfo` (type: `DIRECT_BLOCKED` vs `DIVISION_BLOCKED`, invoices, responsible MR details).
  2. In `LoginForm`, when blocked, display a rich, formatted "Account Suspended / Contact Admin" card:
     - For Direct Block: Shows alert icon, "Account Suspended Due to Overdue Payment", table/list of overdue invoices with age (>90 days), and admin contact phone/email.
     - For Division Cascading Block: Shows division hold banner, "Division Access Suspended", explains that MR [Name] has invoices overdue >95 days, and shows the responsible invoice amount.
     - Provides a "Back to Login" / "Retry" button.

### Task 5: Verification & End-to-End Validation
- Run TypeScript verification (`pnpm exec tsc --noEmit`).
- Verify API server build and Next.js Turbopack build.
- Commit all changes to `localdb` and push to `origin/localdb`.
