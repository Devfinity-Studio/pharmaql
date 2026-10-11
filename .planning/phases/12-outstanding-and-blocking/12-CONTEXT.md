# Phase 12: Outstanding & Blocking Management - Context

## Locked Decisions & Business Requirements

### 1. MR Overdue Tiers & Dynamic Enforcement
Any MR with pending net outstanding `(Amount - AdjAmt) > 0` evaluated via `rptMRwisePeriodicalOutstanding`:

1. **Tier 1: About to Overdue (80–90 Days)**
   - **Status:** Active, but flagged with a high-priority warning popup modal and dashboard banner.
   - **Content:** Lists specific pending invoice(s) (`DocNo` / `AgainstNo`), pending net amount (`Amount - AdjAmt`), days overdue, and the exact impending block date (when `OverDays` reaches 91 days).
   - **Message:** *"Payment Pending Warning: Your invoice(s) [InvNo] totaling ₹[Amount] have reached [Days] days overdue. Your account and division will be automatically blocked on [Date] unless payment is cleared."*

2. **Tier 2: Directly Overdue (>90 Days)**
   - **Status:** **Automatically Blocked**.
   - **Enforcement:** Login rejected (cannot receive OTP), active session invalidated.
   - **Notice:** Shows popup/message: *"Account blocked due to overdue payment exceeding 90 days on Invoice [InvNo] (₹[Amount], [Days] days overdue). Contact administrator."*

3. **Tier 3: Division Cascading Block**
   - **Rule:** If any MR in a division is directly blocked due to >90 days overdue, **all other MRs sharing that division become Division-Blocked**.
   - **Notice to Division Colleagues:** Displays popup/message explicitly naming the responsible MR:
     *"Division [Division Name] is temporarily suspended due to overdue payment (>90 days) pending with MR [Responsible MR Name] (Invoice [InvNo] - ₹[Amount]). Please contact your administration or clear the pending payment to resume division access."*

---

### 2. Admin MR Access Management (`/admin/mrs`)
Add an **Overdue & Blocking Control Center** on `/admin/mrs`:

1. **Categorized Tiers:**
   - **About to Overdue (80–90 Days):** Shows MRs nearing the 90-day threshold with warning countdown, total pending amount, and oldest invoice.
   - **Overdue & Blocked (>90 Days):** Shows MRs directly auto-blocked by overdue payments.
   - **Division Blocked:** Shows MRs collateral-blocked due to a colleague's pending overdue payment in their division, indicating the responsible MR's name.

2. **Secure Admin Password Confirmation to Unblock:**
   - When an Admin clicks **"Unblock"** on any blocked or division-blocked MR:
     - An interactive modal prompts for the **Admin Password**.
     - Server action validates against `env.ADMIN_PASSWORD`.
     - Only upon valid password entry is the MR/Division unblocked or granted a temporary exemption.

3. **Admin Exemption & Audit Trail:**
   - Admins can toggle an **Override / Grace Period** (e.g. temporary unblock exemption) stored in `data/mr_overrides.json`.
   - Stores unblock history: timestamp, admin email, reason, and exemption expiry.

---

### 3. Data Integration & Architecture
- **Live Overdue Calculation:** Evaluated dynamically via `pdyasvtrans.rptMRwisePeriodicalOutstanding`.
- **Division Mapping:** Derived from `pdyasvmaster.l_mktcompany_mr` linked with `l_mktcompany` (`DivisionID`, `DivisionName`).
- **Overdue Engine:** Centralized helper function `evaluateMrOverdueStatus(mrId)` that calculates:
  - `status`: `"CLEAN"` | `"WARNING"` (80–90d) | `"DIRECT_BLOCKED"` (>90d) | `"DIVISION_BLOCKED"`.
  - `oldestDays`: maximum overdue days.
  - `totalPendingAmt`: sum of `Amount - AdjAmt`.
  - `invoices`: array of matching invoices with impending block dates.
  - `responsibleMrName` (if division-blocked).
- **Session & Login Gate:**
  - `requestMrOtp` and `verifyMrOtp` in `authActions.ts` invoke `evaluateMrOverdueStatus(mrId)`.
  - If blocked, returns the exact structured error message with responsible MR details.
- **Client Warning Modal:**
  - MR Dashboard renders an unavoidable Dismissible/Persistent Modal when `status === "WARNING"`.
