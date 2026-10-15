# Phase 23: Developer Options & Developer Account Summary

**Phase Status:** [COMPLETED]  
**Milestone:** Milestone 1 — Production Hardening & Optimization  
**Date:** October 15, 2026  

---

## 1. Executive Summary

Phase 23 delivers a comprehensive, enterprise-grade **Developer Control Center** and formalizes the **Developer Role** (`role: "DEVELOPER"`) within PharmaQL. This system gives technical administrators and software owners full lifecycle governance over software licensing, an emergency killswitch, automated renewal reminder mailers, runtime environment hot-reloading, multi-service telemetry, unified audit/system logs, and instant MR impersonation for debugging and preview—all while guaranteeing **100% read-only integrity** for the legacy MySQL ERP database (`pdyasvmaster`).

---

## 2. Key Delivered Capabilities

### A. Dedicated Developer Role & Navigation
- **Role Recognition**: Permitted `DEVELOPER` sessions in `src/app/admin/layout.tsx` alongside `ADMIN`.
- **Developer Badging**: Distinct purple `[DEV]` badge rendered in the header and collapsible sidebar (`src/components/collapsible-sidebar.tsx`).
- **Scoped Route**: `/admin/dev` is strictly gated to `role === "DEVELOPER"` (`src/app/admin/dev/page.tsx`). Standard Admins visiting this route are redirected to `/admin/dashboard`.
- **Protected MR Management**: `/admin/mrs` explicitly permits developers to manage and inspect MR accounts.

### B. Software Subscription Lifecycle, Killswitch & Renewal Mailers
- **License Engine** (`src/lib/license.ts` & `data/license.json`):
  - Tracks subscription expiry, countdown days, grace periods, and license status (`ACTIVE`, `EXPIRED`, `SUSPENDED`).
  - **Emergency Killswitch**: Instantly freezes platform access with 1 click.
  - **Branded Lockout Screen** (`src/app/license-expired/page.tsx`): Displays company details, renewal contacts (`support@devfinity.net`), and developer bypass access. Standard Admins and MRs are locked out upon expiration or killswitch activation. Developers retain full access to `/admin/dev` to unfreeze or renew.
  - **Automated Renewal Mailers**: Dispatches official HTML renewal notices and payment reminders from the Developer email (`dev@asmeepharma.com`) to all registered Administrator emails via Gmail SMTP.

### C. Granular Feature Switchboard & Global Maintenance Mode
- **Feature Switchboard** (`src/lib/maintenance.ts` & `data/feature_toggles.json`):
  - Selectively toggles 8 critical platform features: `stock`, `sales`, `products`, `party`, `claim`, `overdue`, `export`, `notices`.
  - Enforces 4 granular audience scopes:
    1. `ACTIVE`: Enabled for all users.
    2. `DISABLED_FOR_MRS`: Paused on MR portal (displays in-place maintenance notice), active for Admins.
    3. `DISABLED_FOR_ADMINS`: Paused for Admins, active for MRs.
    4. `DISABLED_FOR_ALL`: Paused platform-wide (Developers bypass).
  - **In-Place UI Notices** (`src/components/mr-dashboard-content.tsx`): When a service or report tab is paused, users see a branded maintenance alert card explaining that the service is temporarily undergoing scheduled maintenance.
- **Global Maintenance Mode** (`data/maintenance.json`):
  - 3 Operating modes: `DISABLED`, `MRS_ONLY`, `ALL_USERS`.
  - Configurable broadcast message and estimated completion timestamp.
  - Developers always bypass global maintenance mode.

### D. Dynamic Runtime Config & Secret Masking
- **Dynamic Variable Manager** (`src/lib/runtime-config.ts` & `data/runtime_config.json`):
  - Hot-reloads `ADMIN_ALLOWED_IPS`, `DEBUG_MODE`, `RATE_LIMIT_STRICT_MODE`, and `MR_OVERDUE_GRACE_DAYS` without requiring server restarts.
  - Automatically synchronizes `process.env.ADMIN_ALLOWED_IPS` in Node memory for immediate middleware IP allowlist enforcement.
- **Masked Secret Inspector**:
  - Displays masked statuses of `API_SECRET_KEY`, `GMAIL_PASS`, `ADMIN_PASSWORD`, and connection endpoints without leaking plain-text credentials.

### E. Multi-Service Health & Telemetry Monitor
- **Diagnostics Engine** (`src/server/actions/devDiagnostics.ts`):
  - **Next.js Web Frontend**: Monitors process uptime, Node version (`v26.7.0`), RSS memory, heap allocations, and CPU PID.
  - **Express API Backend**: Pings `/health` and measures round-trip HTTP latency in milliseconds.
  - **Legacy MySQL ERP Database**: Measures query response time via the API server (`SELECT 1`) and verifies connection pool readiness.
  - **SMTP Mailer Handshake**: Verifies Gmail SMTP transporter connection.
  - **Storage Subsystem**: Benchmarks local file read/write latency in milliseconds.
  - Returns unified status: `HEALTHY`, `DEGRADED`, or `DOWN`.

### F. Unified Log Inspector (User Audit + System Logs)
- **Log Engine** (`src/server/actions/devDiagnostics.ts`):
  - Merges user activity audit logs (`data/audit_logs.json`) with system telemetry, route invocations, and error events.
  - Formats logs into structured records with timestamps, categories (`USER_ACTIVITY`, `SECURITY_WARNING`), severity levels (`INFO`, `WARN`, `ERROR`), and IP addresses.
  - Provides real-time query searching and severity-level filtering (`ALL`, `INFO`, `WARN`, `ERROR`).
  - Supports 1-click JSON log export.

### G. MR Impersonation / "View-As" Simulation Mode
- **Simulation Actions** (`src/server/actions/impersonation.ts` & `src/server/auth.ts`):
  - Allows Developers to click **"Simulate MR View"** on any registered MR (Rank 1, 2, or 3).
  - Sets signed `pharmaql_impersonate` cookie.
  - `getSession()` automatically resolves target MR's permissions, rank, and division assignments, while attaching `originalDeveloper` context.
  - Renders top sticky `<ImpersonationBanner />` with simulated MR metadata and a 1-click **"Exit Simulation"** button that restores the developer back to `/admin/dev`.
  - Simulating developers bypass MR overdue blocking and maintenance locks.

### H. Stored Procedure Playground & Cache Controls
- **Procedure Sandbox** (`api-server/src/routes/reports.ts` & `src/server/actions/devDiagnostics.ts`):
  - Executes read-only stored procedures (`rptStockMovementStatement`, `rptItemCustomerSale`, `rptMRwisePeriodicalOutstanding`) in an isolated sandbox.
  - Strictly enforces a procedure whitelist to reject arbitrary SQL injection attempts.
  - Measures execution latency in milliseconds and returns row counts, column names, and tabular samples.
- **Cache & Rate Limit Flusher**:
  - 1-click reset of all in-memory rate-limit sliding windows, IP lockouts, and masterdata caches.

---

## 3. Architecture & File Structure

```
pharmaql/
├── api-server/src/routes/reports.ts      # Added /dev-procedure-sandbox with procedure whitelisting
├── data/                                 # Isolated local JSON stores (git-ignored)
│   ├── license.json                      # Subscription expiration, killswitch state, admin emails
│   ├── feature_toggles.json              # 8 Feature keys with 4 scope levels
│   ├── maintenance.json                  # Global maintenance mode & broadcast notices
│   └── runtime_config.json               # Dynamic variables & IP allowlists
├── src/
│   ├── app/
│   │   ├── (mr)/layout.tsx               # Impersonation banner & license/maintenance checks
│   │   ├── (mr)/dashboard/page.tsx       # Notices feature toggle check
│   │   ├── admin/layout.tsx              # DEVELOPER role permission & license gate
│   │   ├── admin/dev/page.tsx            # Dedicated Developer Control Center route
│   │   ├── admin/mrs/page.tsx            # DEVELOPER access to MR management
│   │   └── license-expired/page.tsx      # Branded lockout screen for expired/killed subscriptions
│   ├── components/
│   │   ├── collapsible-sidebar.tsx       # Added [DEV] badge & "Developer Options" nav item
│   │   ├── dev-control-center.tsx        # High-efficiency 7-tab command dashboard
│   │   ├── impersonation-banner.tsx      # Sticky top MR simulation banner with Exit button
│   │   └── mr-dashboard-content.tsx      # Feature switchboard checks & in-place maintenance notices
│   ├── lib/
│   │   ├── license.ts                    # License status, countdown, killswitch, renewal mailer
│   │   ├── maintenance.ts                # Feature switchboard & maintenance mode checks
│   │   └── runtime-config.ts             # Runtime config persistence & process.env sync
│   └── server/
│       ├── auth.ts                       # Impersonation cookie resolution & permission mapping
│       └── actions/
│           ├── devDiagnostics.ts         # Multi-service health, logs, procedure sandbox, cache flushes
│           └── impersonation.ts          # Start/stop MR view-as simulation
└── scratch/test-phase23-suite.ts         # Automated 7-point integration test suite
```

---

## 4. Verification & Quality Gates

| Verification Gate | Result | Notes |
|:---|:---:|:---|
| Subscription & Killswitch | **PASSED** | Killswitch freezes access; deactivation restores access; extension +30d works. |
| Admin Renewal Email Dispatch | **PASSED** | HTML renewal notices dispatched to admins via Gmail SMTP (`Sent`). |
| Feature Switchboard Scope Matrix | **PASSED** | `DISABLED_FOR_MRS`, `DISABLED_FOR_ADMINS`, `DISABLED_FOR_ALL` verified; Dev bypasses. |
| Global Maintenance Mode | **PASSED** | `MRS_ONLY` and `ALL_USERS` block non-developers; Developers bypass. |
| Dynamic Runtime Config | **PASSED** | Hot-reloaded `ADMIN_ALLOWED_IPS` synced to `process.env`; secrets masked. |
| Multi-Service Health Telemetry | **PASSED** | Overall: `HEALTHY` (Frontend: 100MB, API: 71ms, MySQL: 36ms, Storage: 8ms, SMTP: Healthy). |
| MR Impersonation Handshake | **PASSED** | Developer cookie triggers MR simulation; Exit button clears cookie. |
| Stored Procedure Sandbox | **PASSED** | Whitelisted procedures benchmarked; non-whitelisted SQL injections rejected. |
| TypeScript Compilation | **PASSED** | `pnpm exec tsc --noEmit` exits `0` with zero errors. |
| Standalone API Server Build | **PASSED** | `api-server: npm run build` exits `0`. |
| Database Read-Only Integrity | **PASSED** | Exactly 0 writes to `pdyasvmaster` or `pdyasvtrans`. |

---

## 5. Conclusion

Phase 23 is fully executed, tested, and verified. PharmaQL now provides a complete developer operations layer, enterprise subscription protection, feature toggles, and live system health monitoring without altering or risking the legacy ERP database.
