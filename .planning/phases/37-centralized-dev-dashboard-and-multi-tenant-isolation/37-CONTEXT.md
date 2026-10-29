# Phase 37: Centralized Dev Platform Dashboard & Multi-Tenant Resource Isolation - Context

**Milestone:** Milestone 1 - Production Hardening & Optimization  
**Active Phase:** Phase 37  
**Status:** Discussed & Decisions Locked. Ready for Plan Phase (`/gsd-plan-phase 37`).

---

## 1. Objective

Centralize the Dev Portal dashboard and administrative suite into a master multi-tenant control center, eliminate hardcoded single-tenant assumptions across dashboards, notices, audit logging, and developer panels, fix query parameter injection for tenant-configured ERP parameters (`comp_no`, `loc_no`, and database name), convert tenant creation into a dedicated full page with separate admin credentials, and clean up the platform environment configuration.

---

## 2. Locked Implementation Decisions

### Area 1: Dedicated Tenant Management Pages (Replacing Modal)
- **Separate Full-Page Architecture**:
  - Replace `TenantModal` with dedicated full-page routes:
    - `/admin/tenants/new` — Comprehensive, guided tenant onboarding page with validation, DNS guidance, and database diagnostic ping.
    - `/admin/tenants/[id]` — Dedicated tenant editing, diagnostics, and domain management page.
  - Keeps the main `/admin/tenants` table clean, fast, and uncluttered, with a prominent "Onboard New Tenant" button navigating to `/admin/tenants/new`.
- **Tenant-Specific Admin Credentials**:
  - On `/admin/tenants/new` and `/admin/tenants/[id]`, include dedicated fields:
    - `admin_email` (e.g., `admin@acmepharma.com`).
    - `admin_password` (with generate password button and toggle visibility).
  - Encrypt `admin_password` using AES-256-GCM (`CONTROL_PLANE_ENCRYPTION_KEY`) and store in `tenants` table (`admin_email VARCHAR(128)`, `admin_password_encrypted TEXT`).
  - Update `src/server/actions/authActions.ts`:
    - On tenant client portals (`!isDevPortal`), authenticate Admin logins against the active tenant's configured `admin_email` and decrypted `admin_password`.
    - Fallback gracefully to `process.env.ADMIN_EMAIL` / `process.env.ADMIN_PASSWORD` only if the tenant has no custom admin configured.

### Area 2: Fix Query Parameter Injection (`comp_no`, `loc_no`, `legacy_db_name`)
- **Root Cause Identified**:
  - `src/middleware.ts` set headers `x-tenant-comp-no` and `x-tenant-loc-no`, but server actions (`stockAndSales.ts`, `customerBlocking.ts`, `mrInfo.ts`, `overdueEngine.ts`) and `src/lib/api-client.ts` never automatically injected them into the outgoing request body or query params to `api-server`. As a result, reports and procedures defaulted back to hardcoded `11`.
- **Enforced Fix**:
  - In `src/lib/api-client.ts`:
    - Read `x-tenant-comp-no`, `x-tenant-loc-no`, and `x-tenant-db-name` from request headers in `getDynamicApiConfig()`.
    - In `apiPost` and `apiGet`: automatically inject `compNo` and `locNo` and `dbName` into the payload if not explicitly overridden by the caller.
  - In `src/server/actions/`:
    - Ensure all report calls and stored procedure wrappers pass the active tenant's resolved `compNo` and `locNo`.
  - In `api-server/src/routes/reports.ts`:
    - Respect incoming `compNo`, `locNo`, and `dbName` across all stored procedure calls, using tenant values instead of hardcoded `11`.

### Area 3: Developer Dashboard (`/admin/dev`) — Global vs Per-Tenant Feature Mapping
- **Dual-Tier Feature Mapping**:
  - **Global Options** (Platform-wide controls applied across the platform or default fallbacks):
    - Platform-wide maintenance mode banner.
    - Global debug query banner toggle (`?debug=1`).
    - Platform telemetry & logging verbosity.
  - **Per-Tenant Options** (Activated via sticky top-bar Tenant Selector dropdown):
    - Switch active tenant to inspect and modify:
      - Feature flags (`tenant_features.feature_flags`) for that specific tenant.
      - Tenant-specific Maintenance Mode (`tenant_features.maintenance_mode`) to suspend single tenants without affecting others.
      - License management (`tenant_licenses.status`, `plan_type`, `expires_at`).
      - Runtime configuration overrides (`comp_no`, `loc_no`, overdue thresholds).
  - Clean up UI branding: remove hardcoded `"Asmee Pharma"` references in titles and metadata.

### Area 4: Centralized Dev Platform Dashboard (`/admin/dashboard`)
- **Host-Based Route Partitioning**:
  - **Dev Portal Hosts** (`pharmaql.devfinity.net`, `localhost:3000` in Dev Portal mode):
    - Renders `<DevPlatformDashboard />`:
      - Platform telemetry: Total Tenants, Active vs Suspended, Neon Control Plane status & roundtrip latency (ms), Total MR headcount across all tenants.
      - Recent tenant onboarding feed with live status badges and direct preview links.
      - Quick Platform Actions: "Onboard Tenant" (`/admin/tenants/new`), "Broadcast Notice" (`/admin/notices`), "Security Audit" (`/admin/audit`), "Developer Panel" (`/admin/dev`).
  - **Client Portal Hosts** (`portal.asmeepharma.com`, `<slug>.localhost:3000`):
    - Continues rendering client-isolated ERP Management Dashboard querying their specific on-premise Technomax API server.
- **Sidebar Navigation**:
  - Update `devPortalNavItems` in `src/components/collapsible-sidebar.tsx` to include `Platform Dashboard` (`/admin/dashboard`) at the top.
  - Ensure `/admin` root route redirects to `/admin/dashboard` on both Dev Portal and Client Portals.

### Area 5: Multi-Tenant Notice Board & Audit Logging Scoping
- **Notice Board (`/admin/notices`)**:
  - Add `tenant_id` scoping to notice creation:
    - "All Tenants (Global Broadcast)" (`tenant_id = null`)
    - "Specific Client Tenant" (`tenant_id = <uuid>`)
  - Dev Portal displays all notices with badges; Client Portals only query `tenant_id IS NULL OR tenant_id = :activeTenantId`.
- **Audit Logs (`/admin/audit`)**:
  - Dev Portal features a tenant filter dropdown; Client Portals are strictly scoped to the active client domain.

### Area 6: Environment Configuration Cleanup (`.env`, `src/env.js`, `.env.example`)
- **Clean Audit**:
  - Audit `.env` and `src/env.js`:
    - Remove obsolete/dead variables from legacy single-tenant architecture.
    - Keep core multi-tenant platform variables:
      - `CONTROL_PLANE_DATABASE_URL` (Neon Postgres)
      - `CONTROL_PLANE_ENCRYPTION_KEY` (AES-256-GCM 32-byte key)
      - `DEV_PORTAL_DOMAIN` (`pharmaql.devfinity.net`)
      - `DEV_EMAIL` & `DEV_PASSWORD` (Superuser developer credentials)
      - `DEV_SMTP_*` (Developer Zoho SMTP alerts)
      - `BETTER_AUTH_SECRET` (JWT signing secret)
      - `NODE_ENV`
    - Retain `API_SERVER_URL` / `API_SECRET_KEY` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` as strictly optional fallbacks for development/local testing.
  - Update `.env.example` with clear documentation.

---

## 3. Technical Boundaries & Security Invariants

1. **Edge Runtime Invariant**: `src/middleware.ts` must maintain 100% Edge runtime compatibility with zero Node.js native module imports.
2. **Tenant Data Isolation**: Client portals must never leak or expose other tenants' data, credentials, or audit trails.
3. **Zero Test Regressions**: All 16 existing Vitest suites (92/92 tests) must pass, plus new tests for tenant admin authentication and query parameter injection.
