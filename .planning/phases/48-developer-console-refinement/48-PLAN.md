# Phase 48 Plan: Developer Console Refinement

## Executive Summary
Phase 48 refines the Developer Console (`/admin/dev`) to provide an enterprise-grade control platform for managing multi-tenant operations. Key improvements include: grouping the 13 tools into 4 intuitive categories with a sticky tenant switcher, characterizing live presence by tenant, implementing per-tenant licensing with full status controls, fixing MR impersonation for cross-tenant simulation, adding tenant-scoped and global push/notice broadcasts, expanding the stored procedure sandbox with latency metrics and raw SQL inspection, and enhancing unified log filtering.

---

## Work Breakdown Structure (Plans & Tasks)

### Plan 48.1: Multi-Tenant Presence Characterization & Filter
- **Goal**: Characterize active user sessions by tenant so developers can immediately see which login belongs to which tenant, with tenant filtering and direct session controls.
- **Tasks**:
  1. Update `ActiveUserSession` in `src/lib/presence-store.ts` to include:
     - `tenantId?: string | null;`
     - `tenantSlug?: string | null;`
     - `tenantName?: string | null;`
  2. Update `sendPresenceHeartbeatAction` in `src/server/actions/presenceActions.ts` to resolve `x-tenant-id`, `x-tenant-slug`, and `x-tenant-name` (or `x-tenant-short-name`) from request headers and pass to `recordPresenceHeartbeat`.
  3. In `dev-control-center.tsx` (`presence` tab):
     - Add tenant filter dropdown ("All Tenants" vs individual tenants).
     - Render distinctive colored tenant badges/pills next to each user session in the live presence table.
     - Add quick actions per session: terminate/revoke session, inspect device/IP/page, or quick impersonate if user is an MR.

### Plan 48.2: Per-Tenant Licensing & Multi-Tenant License Management
- **Goal**: Enable per-tenant license tracking and management directly within the Tenant Record in Control Plane DB & local store fallback, with a clear management UI in the `license` tab.
- **Tasks**:
  1. Add license fields to `TenantRecord` in `src/lib/control-plane-db.ts` and `TenantDetails` / `SaveTenantInput` in `src/modules/control-plane/tenantActions.ts`:
     - `license_status`: `"ACTIVE" | "EXPIRED" | "SUSPENDED"` (default `"ACTIVE"`)
     - `license_expires_at`: string (default `"2027-03-31T23:59:59.000Z"`)
     - `license_grace_days`: number (default 7)
     - `is_license_blocked`: boolean (default false)
  2. Implement server actions:
     - `updateTenantLicenseAction(tenantId, licenseData)` to update expiry, status, and killswitch per tenant.
     - `getMultiTenantLicenseOverviewAction()` returning all tenants with calculated days remaining, blocked status, and admin contact emails.
  3. In `src/lib/license.ts`:
     - Enhance `getLicenseStatus()` to dynamically evaluate the current tenant's license when in a tenant request context (`x-tenant-id` header), falling back to global `license.json` if in platform context.
  4. In `dev-control-center.tsx` (`license` tab):
     - Replace single-tenant card with a rich multi-tenant licensing dashboard:
       * Metrics summary: Total Tenants, Active Licenses, Expiring Soon (< 30 days), Blocked/Suspended.
       * Per-tenant license table with status badge, expiration date, days remaining, killswitch switch, edit modal to extend dates, and "Send Renewal Notice" action.

### Plan 48.3: MR Impersonation Fix & Cross-Tenant Resolution
- **Goal**: Fix MR simulation so developers can seamlessly view-as any MR across tenants, ensure correct permissions, and show the persistent exit banner.
- **Tasks**:
  1. Audit and fix `startMrImpersonation` in `src/server/actions/impersonation.ts`:
     - Ensure cookies are set with proper domain, path `/`, `sameSite: "lax"`.
     - Accept optional `tenantId` to ensure the session binds to the right tenant context if navigating across domains.
  2. Fix `getSession` in `src/server/auth.ts`:
     - Ensure `pharmaql_impersonate` resolves the MR with their complete profile and rank permissions.
     - Set `isImpersonating: true` and `originalDeveloper: user`.
  3. Ensure `ImpersonationBanner` in `src/components/impersonation-banner.tsx`:
     - Mounts reliably in MR layout and displays the simulated MR's name, ID, rank, and tenant.
     - "Exit Simulation" cleanly invokes `stopMrImpersonation()`, removes cookies, and redirects the developer back to `/admin/dev`.
  4. In `dev-control-center.tsx` (`impersonate` tab):
     - Display tenant name next to each MR in the MR simulation list.
     - Provide tenant filter in the MR simulation search table.

### Plan 48.4: Global & Tenant-Specific Notifications (Push & System Notices)
- **Goal**: Expand Push Notifications and System Notices to support targeting globally (all tenants) or a specific tenant.
- **Tasks**:
  1. System Notices (`src/server/actions/notices.ts`):
     - Update notice creation modal and `saveNotice` action to accept `targetTenantId: string | null` (`null` or `"ALL"` for Global, or specific tenant ID).
     - Update `getActiveNotices(role)` to filter notices where `n.tenantId === currentTenantId || !n.tenantId || n.tenantId === "ALL"`.
     - In Developer Console Notices tab, display a tenant selector dropdown when composing a notice.
  2. Push Notifications (`src/server/actions/pushActions.ts` and `src/lib/push-notifications.ts`):
     - Update `PushSubscriptionRecord` and `InAppNotification` to store `tenantId`.
     - Update `sendTestPushAction` to accept `targetTenantId?: string | null`.
     - Allow broadcast targeting:
       * `GLOBAL_ALL`: All users across all tenants.
       * `GLOBAL_MR`: All MRs across all tenants.
       * `TENANT_ALL`: All users in selected tenant.
       * `TENANT_MR`: All MRs in selected tenant.
       * `TENANT_ADMIN`: All Admins in selected tenant.
       * `SPECIFIC_USER`: Target specific user ID.
     - Update `dev-control-center.tsx` push notification dispatch form to provide these targeting options.

### Plan 48.5: Console Navigation Refactoring (Grouped Categories & Top Switcher)
- **Goal**: Refactor the monolithic 13-tab bar into 4 intuitive functional category groups with a sticky top bar.
- **Tasks**:
  1. In `src/components/dev-control-center.tsx`:
     - Design a persistent top header with:
       * Tenant switcher dropdown (`🌐 Platform-Wide (Global)` vs individual tenants).
       * Live ERP bridge status badge for the selected tenant.
       * "Flush Master Data Caches" action button with instant feedback.
       * Quick link to `/admin/dashboard` and `/admin/tenants`.
     - Group the 13 tools into 4 primary Category Tabs:
       * **Category 1: Overview & Telemetry** (`status`, `fleet`, `runtime`)
       * **Category 2: Diagnostics & Sandbox** (`query`, `debug`, `logs`)
       * **Category 3: Tenants & Licensing** (`license`, `toggles`)
       * **Category 4: Field Tools & Comms** (`presence`, `impersonate`, `push`, `notices`, `feedback`)
     - Within each category, render clean sub-navigation pills or tab triggers.

### Plan 48.6: Interactive ERP Bridge & Query Sandbox Enhancements
- **Goal**: Support running live test queries for all core ERP stored procedures with latency timing and raw SQL inspection.
- **Tasks**:
  1. In `src/components/dev-control-center.tsx` (`query` tab):
     - Expand procedure dropdown:
       * `rptStockMovement` (Stock Movement)
       * `rptMRwisePeriodicalOutstanding` (Overdue Periodical Outstanding)
       * `rptExpiryStockStatement` (Expiry Stock Statement)
       * `customer-item-sale` (Customer-Item Sales)
       * `party-item-sale` (Party-Item Sales)
       * `claim-data` (Claim Qty & Free Schemes)
     - Provide smart parameter presets based on the selected procedure (e.g. `compCode`, `asOnDate`, `fromDate`, `toDate`, `locNo`).
     - Live execution timer showing round-trip query latency in ms.
     - Toggleable "Raw SQL Inspection" accordion showing the exact `CALL procedure(...)` string sent to MySQL.
     - Paginated or scrollable table preview with row count badge and JSON raw export.

### Plan 48.7: Log Streaming & Diagnostic Filters
- **Goal**: Enable filtering system logs by severity level, tenant, and search terms, with refresh controls.
- **Tasks**:
  1. In `src/server/actions/devDiagnostics.ts` (`getUnifiedSystemLogs`):
     - Support filtering by `level?: "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG"`.
     - Support filtering by `tenantId?: string`.
     - Support search query filtering across message, category, and metadata.
  2. In `dev-control-center.tsx` (`logs` tab):
     - Add Level filter dropdown (`All Levels`, `Error`, `Warning`, `Info`, `Debug`).
     - Add Tenant filter dropdown.
     - Add search text input.
     - Add auto-refresh toggle (every 10 seconds) with visual countdown.

### Plan 48.8: Verification, Test Suites, Production Build & Promotion
- **Goal**: Verify all changes through TypeScript checks, test suites, Next.js build, and 3-stage promotion workflow.
- **Tasks**:
  1. Update and add unit tests:
     - `src/lib/__tests__/presence-store.test.ts` (tenant characterization).
     - `src/lib/__tests__/license.test.ts` (per-tenant licensing).
     - `src/server/actions/__tests__/devDiagnostics.test.ts` or similar.
  2. Run `pnpm exec tsc --noEmit` (0 errors).
  3. Run `pnpm test` (all suites passing).
  4. Run `pnpm build` (`next build`).
  5. Document UAT in `48-UAT.md`.
  6. Promote `dev` -> `prod` -> `deploymment`.

