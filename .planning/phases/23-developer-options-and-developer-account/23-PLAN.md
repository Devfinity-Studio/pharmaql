# Phase 23: Developer Options & Developer Account Plan

## Objective
Implement an enterprise-grade Developer Control Center and full-fledged Developer role in PharmaQL. Provide software subscription/licensing lifecycle management with an emergency killswitch, automated renewal reminder emails to Admins, global and granular maintenance mode/feature switchboard, runtime environment key management, multi-service health monitors, unified user and system log inspection, MR view-as simulation, and stored procedure diagnostics—while guaranteeing zero writes to the legacy ERP database.

---

## Detailed Implementation Tasks

### Task 1: Developer Role Separation & Layout Alignment
- **File**: `src/app/admin/layout.tsx`
  - Update session check to permit both `ADMIN` and `DEVELOPER`:
    `if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) redirect("/login");`
- **File**: `src/components/collapsible-sidebar.tsx`
  - Add `userRole?: string` to props.
  - Render a distinct purple/cyan `[DEVELOPER]` badge when `userRole === "DEVELOPER"`.
  - Add navigation item for Developer Control Center:
    `{ label: "Developer Options", href: "/admin/dev", icon: Terminal }` (visible only when `role === "DEVELOPER"`).
- **File**: `src/middleware.ts`
  - Restrict `/admin/dev/:path*` strictly to sessions with `role === "DEVELOPER"`.

---

### Task 2: Software Subscription Lifecycle, Killswitch & Admin Reminder Emails
- **Create**: `src/lib/license.ts`
  - Config storage in `data/license.json` (git-ignored):
    - `status`: `"ACTIVE"` | `"EXPIRED"` | `"SUSPENDED"`
    - `expiresAt`: ISO Date string (default 1 year from current: `2027-03-31`)
    - `killswitchActive`: boolean
    - `gracePeriodDays`: number (default 7 days)
    - `organization`: "Asmee Pharma Pvt. Ltd."
    - `developerEmail`: "dev@asmeepharma.com"
    - `supportEmail`: "support@devfinity.net"
  - Functions:
    - `getLicenseStatus()`: Computes status, days remaining, and whether access is blocked.
    - `updateLicenseConfig(...)`: Server action for developers to extend expiration (+30 days, +90 days, +1 year), toggle emergency killswitch, or set custom dates.
    - `sendSubscriptionReminderEmails(...)`: Server action to send renewal reminder emails via Gmail SMTP from Developer Email to registered Admin emails.
- **Create**: `src/app/license-expired/page.tsx`
  - Full-page branded screen: "Subscription Expired — Software Access Suspended", displaying company details, support contact (`support@devfinity.net`), and instructions to renew.
- **Middleware & Route Interceptor**:
  - In `src/middleware.ts`:
    - If software license is blocked (killswitch or expired):
      - Allow `/admin/dev/*` and developer login so engineers can access the panel and renew.
      - Redirect all other traffic (MRs, standard Admins) to `/license-expired`.

---

### Task 3: Granular Feature Switchboard & Global Maintenance Mode
- **Create**: `src/lib/maintenance.ts`
  - Storage in `data/feature_toggles.json` and `data/maintenance.json`:
    - Feature keys: `stock`, `sales`, `products`, `party`, `claim`, `overdue`, `export`, `notices`.
    - 4 Scope levels per feature:
      - `ACTIVE`: Fully enabled.
      - `DISABLED_FOR_MRS`: Disabled on MR portal (shows maintenance card), active for Admins.
      - `DISABLED_FOR_ADMINS`: Disabled for Admins, active for MRs.
      - `DISABLED_FOR_ALL`: Completely disabled (Developers bypass).
  - Global Maintenance Mode:
    - Mode: `DISABLED`, `MRS_ONLY`, `ALL_USERS`.
    - Custom message, reason, and estimated completion time (e.g. "Scheduled DB optimization until 10:00 PM").
  - Functions:
    - `isFeatureEnabled(featureKey, userRole)`
    - `getMaintenanceStatus()`
    - `updateFeatureToggles(toggles)`
    - `updateMaintenanceMode(config)`
- **UI Integration**:
  - Wrap report views and export buttons with feature toggle checks:
    - If feature is disabled for current user's role, render a sleek in-place notice:
      `"This service is temporarily undergoing scheduled maintenance. Please check back shortly."`
  - If global maintenance mode is on and matches user role, render full-page maintenance screen.

---

### Task 4: Environment & Runtime Configuration Management
- **Create**: `src/lib/runtime-config.ts`
  - Storage in `data/runtime_config.json`:
    - `ADMIN_ALLOWED_IPS`: Comma-separated list of allowed IPs/CIDRs.
    - `DEBUG_MODE`: Toggle verbose API and SQL query telemetry.
    - `RATE_LIMIT_STRICT_MODE`: Toggle aggressive vs. normal rate limiting.
    - `MR_OVERDUE_GRACE_DAYS`: Default grace duration for unblock actions.
    - `MAINTENANCE_BANNER`: Custom broadcast message displayed globally.
  - Functions:
    - `getRuntimeConfig()`: Reads config with fallback to environment variables.
    - `updateRuntimeConfig(partialConfig)`: Saves new config atomically.
    - `getMaskedEnvInspection()`: Returns masked status of critical environment variables (SMTP host, port, user, API Server URL, database name) without exposing credentials.

---

### Task 5: Multi-Service Health & Telemetry Monitor
- **Create**: `src/server/actions/devDiagnostics.ts`
  - Checks health across all system layers:
    1. **Next.js Web Frontend**: Process uptime, Node.js version (`v26.7.0`), RSS memory, heap usage, CPU usage.
    2. **Express API Backend**: Pings `/health`, measures round-trip HTTP latency in ms.
    3. **Legacy MySQL ERP Database**: Measures query response time via API server (`SELECT 1`), reports pool status.
    4. **SMTP Mailer Service**: Tests Gmail SMTP transporter connection.
    5. **Data Storage Integrity**: Measures read/write latency to `data/` directory.
  - Returns unified health score: `HEALTHY` | `DEGRADED` | `DOWN` with latency metrics for each component.

---

### Task 6: Unified Log Inspector (User Audit + System Logs)
- **File**: `src/server/actions/devDiagnostics.ts`
  - Server action `getUnifiedSystemLogs(options)`:
    - Aggregates user activity audit logs (`data/audit_logs.json`) with system events, API server request traces, and unhandled errors.
    - Returns structured logs with timestamp, category (`USER_AUTH`, `REPORT_EXPORT`, `API_REQUEST`, `SYSTEM_ERROR`), severity (`INFO`, `WARN`, `ERROR`), IP, user, and message.
    - Supports real-time text search and severity level filters.
    - Exposes log export action (JSON format).

---

### Task 7: MR Impersonation & "View-As" Simulation Mode
- **Create**: `src/server/actions/impersonation.ts`
  - `startMrImpersonation(mrId: string)`:
    - Requires `DEVELOPER` session.
    - Fetches target MR info, rank, and permissions.
    - Signs temporary impersonation cookie `pharmaql_impersonate` containing MR identity and developer origin.
  - `stopMrImpersonation()`:
    - Deletes `pharmaql_impersonate` cookie and returns developer to `/admin/dev`.
- **File**: `src/server/auth.ts`
  - Update `getSession()`:
    - If active session is `DEVELOPER` and `pharmaql_impersonate` cookie exists, return target MR session with `isImpersonating: true` and `originalDeveloper: developerUser`.
- **Create**: `src/components/impersonation-banner.tsx`
  - Prominent sticky top banner across all pages when impersonation is active:
    `"Viewing as MR: {mrName} ({mrId}) — Rank {rank} | [Exit Simulation]"`

---

### Task 8: Stored Procedure Playground & Cache Controls
- **File**: `src/server/actions/devDiagnostics.ts`
  - `executeProcedureSandbox({ procedureName, params })`:
    - Executes read-only stored procedures via Express API backend (`rptStockMovementStatement`, `rptItemCustomerSale`, `rptMRwisePeriodicalOutstanding`, `rptClaimData`).
    - Validates strict whitelist of allowed procedure names (prevents arbitrary SQL injection).
    - Benchmarks execution time in milliseconds.
    - Returns row count, execution latency, column names, and sample output.
  - `flushAllRateLimits()`: Clears all sliding-window rate limit memory buckets and IP locks.
  - `flushMasterDataCaches()`: Clears masterdata memory caches.

---

### Task 9: Developer Control Center UI (`/admin/dev`)
- **Create**: `src/app/admin/dev/page.tsx` & `src/components/dev-control-center.tsx`
  - Single, sleek developer command dashboard organized in high-efficiency tabs:
    1. **Overview & System Health**: Live service health cards (Next.js, API server, MySQL, SMTP), memory graphs, latency benchmarks, and quick emergency killswitch.
    2. **Subscription & License**: Expiration countdown, extend subscription (+30d, +90d, +1y), killswitch toggle, and "Send Renewal Mail to Admins" trigger.
    3. **Feature Switchboard & Maintenance**: Granular toggles for each of the 8 services (active, disabled for MRs, disabled for Admins, disabled for all) + Global Maintenance Mode settings.
    4. **MR Impersonation**: Searchable list of all MRs with Rank, Division, and 1-click "View-As" simulation button.
    5. **Unified Logs**: Live searchable log viewer with severity filters (`INFO`, `WARN`, `ERROR`), IP filter, and JSON export.
    6. **Procedure Playground**: Interactive stored procedure test bench with parameter inputs, execution latency timer, and tabular results.
    7. **Runtime Config**: Hot-reloadable dynamic configuration settings and masked environment secret inspection.

---

### Task 10: Verification & Quality Gates
1. Run automated security and feature test script:
   - Validate subscription blocking and killswitch lockout.
   - Validate subscription reminder email dispatch.
   - Validate feature switchboard scope enforcement.
   - Validate MR impersonation session handling and return to developer portal.
   - Validate multi-service health checks.
2. Compile and typecheck:
   - `api-server`: `npm run build` exits 0.
   - Root project: `pnpm exec tsc --noEmit` exits 0.
3. Validate production Next.js build:
   - `pnpm run build` exits 0 with all routes and middleware compiling cleanly.
4. Database Write Audit:
   - Confirm 0 writes to `pdyasvmaster`. All developer controls, subscription metadata, and feature toggles reside in isolated local files and memory.
