# Phase 48 Context: Developer Console Refinement

## Overview & Objectives
Refine the Developer Console (`/admin/dev`) to provide an enterprise-grade control center for managing multi-tenant operations, diagnosing on-premise ERP bridges, testing stored procedures, monitoring live sessions characterized by tenant, managing per-tenant licensing, and dispatching global or tenant-specific notifications.

---

## Locked Decisions & Requirements

### 1. Grouped Category Navigation & Tenant Switcher
- **Layout Organization**: Replace the flat 13-tab bar with 4 clear functional category groups:
  1. **Overview & Telemetry**: System Health, Active Fleet & Auto-Update, Runtime Configuration & Env Inspection.
  2. **Diagnostics & Sandbox**: Stored Procedure & Query Sandbox, Diagnostic Tests (Email, Storage, DB Latency), Unified System Logs.
  3. **Tenants & Licensing**: Multi-Tenant License Management & Status Overview, Feature Toggles & Maintenance Windows.
  4. **Field Tools & Comms**: Live User Presence (Characterized by Tenant), MR Impersonation ("View-As"), Global & Tenant-Specific Push Notifications, System Notices.
- **Top Bar**: Persistent tenant selector dropdown ("🌐 Platform-Wide (Global)" vs specific tenant) with instant cache flush action and quick status pills.

### 2. Live User Presence Characterization by Tenant
- **Presence Beacon & Heartbeat**: Update `sendPresenceHeartbeatAction` and `recordPresenceHeartbeat` in `src/lib/presence-store.ts` to capture:
  - `tenantId`: string
  - `tenantSlug`: string
  - `tenantName`: string
- **Presence Table UI**:
  - Distinct tenant badges (with colored pill badges) next to each session.
  - Tenant filter dropdown in the Presence tab to filter active sessions by tenant or view all platform-wide.
  - Direct actions per session: terminate/revoke session, inspect IP/device details, or quick impersonate if the user is an MR.

### 3. Per-Tenant Licensing Management
- **Tenant License Storage**: Store licensing metadata directly within each tenant record in the Control Plane (Neon DB & local store fallback):
  - `license_status`: `"ACTIVE" | "EXPIRED" | "SUSPENDED"`
  - `license_expires_at`: ISO timestamp (e.g. `2027-03-31T23:59:59.000Z`)
  - `license_grace_days`: number (default 7)
  - `is_license_blocked`: boolean (killswitch per tenant)
- **Licensing Tab UI**:
  - Platform-wide summary cards (total licensed tenants, active, expiring soon (<30 days), expired/blocked).
  - Detailed tenant-by-tenant license table showing Organization Name, Domain/Slug, Status, Expiry Date, Days Remaining, and Killswitch toggle.
  - Action to extend license, update expiry date, or send renewal reminder email to tenant admin.

### 4. MR Impersonation Fix & Multi-Tenant Support
- **Robust Impersonation**:
  - Fix `startMrImpersonation(mrId)` and `getSession` in `src/server/auth.ts` to properly resolve the target MR across tenant boundaries without session dropping.
  - Correctly bind permissions (`getPermissionsForRank`), division assignments, and tenant ERP context so all report tabs render correctly during simulation.
  - Ensure `ImpersonationBanner` is consistently visible with "Viewing as [MR Name] ([ID]) • Rank [Rank]" and a one-click "Exit Simulation" button that cleanly removes the simulation cookie and returns the developer to `/admin/dev`.

### 5. Global vs Tenant-Specific Notifications & Alerts
- **System Notices**:
  - Update notice creation modal/form to allow selecting `targetTenantId`:
    - `🌐 Global (All Tenants)`
    - Specific Tenant (e.g. Asmee Pharma)
  - Enforce tenant isolation when fetching active notices so MRs and Admins receive their tenant's notices plus global platform notices.
- **Push Notifications**:
  - Update `sendTestPushAction` and push dispatcher in `src/server/actions/pushActions.ts` and `src/lib/push-notifications.ts` to support `targetTenantId`.
  - Push dispatch options:
    - Broadcast to All Active Users (Platform-Wide)
    - Broadcast to All MRs (Global)
    - Broadcast to All MRs of Selected Tenant
    - Broadcast to Administrators of Selected Tenant
    - Target Specific User / MR ID

### 6. Interactive ERP Bridge & Procedure Sandbox
- **Procedure Coverage**: Support running live test executions of key ERP procedures:
  - `rptStockMovement` (Stock Movement)
  - `rptMRwisePeriodicalOutstanding` (Overdue Statement)
  - `rptExpiryStockStatement` (Expiry Stock)
  - `customer-item-sale` / `party-item-sale`
- **Output & Metrics**:
  - Live query latency timer (ms).
  - Raw SQL query display (`debugSql`).
  - Table preview with row counts and error diagnostics.
  - Dynamic parameter form allowing company code, division, date range, and locNo inputs.

### 7. Log Streaming & Diagnostic Filters
- **Filter Controls**:
  - Log Level filter: `ALL`, `INFO`, `WARN`, `ERROR`, `DEBUG`.
  - Tenant filter: `ALL` vs specific tenant.
  - Text search query.
  - Limit selector (50, 100, 250 rows).
  - Refresh button and auto-refresh toggle.

