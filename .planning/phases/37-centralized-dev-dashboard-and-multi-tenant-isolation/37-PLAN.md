# Phase 37 Plan: Centralized Dev Platform Dashboard & Multi-Tenant Resource Isolation

## Objective

Centralize the Dev Portal dashboard and administrative suite into a master multi-tenant control center, eliminate hardcoded single-tenant assumptions across dashboards, notices, audit logging, and developer panels, fix query parameter injection for tenant-configured ERP parameters (`comp_no`, `loc_no`, and database name), convert tenant creation into a dedicated full page with separate admin credentials, and clean up the platform environment configuration.

---

## Architectural Guardrails

1. **Edge Runtime Invariant (CRITICAL)**:
   - Next.js Edge Middleware ([`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts)) runs in Vercel Edge Runtime.
   - ZERO imports of Node.js native modules (`net`, `dns`, `pg`) in middleware.
   - Middleware handles host resolution strictly via HTTP fetch (`@neondatabase/serverless`).
2. **Tenant Data & Resource Isolation**:
   - Client portal hosts (`!isDevPortal`) must never see data, notices, audit logs, or settings belonging to another tenant.
   - Dev Portal hosts (`isDevPortal`) have superuser observability with granular per-tenant scoping.
3. **Dedicated Page Navigation over Crowded Modals**:
   - Tenant onboarding and editing operate as dedicated full-page routes (`/admin/tenants/new` and `/admin/tenants/[id]`), providing ample screen real estate for diagnostics, DNS configuration, and credential management.
4. **Zero Test Regressions**:
   - All 16 existing Vitest suites (92 tests) must continue to pass.
   - New unit tests must cover tenant-isolated admin login, query parameter injection, and centralized platform metrics.

---

## Detailed Task Breakdown

### Task 1: Dedicated Tenant Management Pages & Tenant Admin Credentials
- **Files**:
  - `src/lib/control-plane-db.ts`
  - `src/modules/control-plane/tenantActions.ts`
  - `src/components/tenant-form.tsx`
  - `src/app/admin/tenants/new/page.tsx`
  - `src/app/admin/tenants/[id]/page.tsx`
  - `src/components/tenants-control-center.tsx`
  - `src/modules/control-plane/__tests__/tenantActions.test.ts`
- **Implementation**:
  - In `src/lib/control-plane-db.ts`:
    - Add `admin_email VARCHAR(128)` and `admin_password_encrypted TEXT` to `TenantRecord` interface and `initControlPlaneRelationalSchema()` table definition & migrations.
  - In `src/modules/control-plane/tenantActions.ts`:
    - Extend `SaveTenantInput` with `admin_email?: string` and `admin_password?: string`.
    - If `admin_password` is provided, encrypt it using AES-256-GCM (`encryptSecret`) and store as `admin_password_encrypted`.
    - Add `getTenantAction(id: string)`: fetches a single tenant by UUID or slug with decrypted password for the editor view.
  - Create `src/components/tenant-form.tsx`:
    - Modern, responsive full-page form organized into clean tabs/cards:
      1. **Organization Identity & Branding**: Display Name, Short Name, Slug, Logo URL, Primary & Accent Colors, Address, Support Email, GSTIN.
      2. **Custom Domain & Live Verification**: Custom domain input with Vercel DNS setup guidance and one-click diagnostic check.
      3. **Database & ERP Bridge Engine**: Connection Type (`postgres` vs `api_server`), Direct DB URI / API Server URL, API Key, `legacy_db_name`, `comp_no`, `loc_no`, Overdue thresholds, and live connection ping button.
      4. **Tenant Administrator Account**: Dedicated `Admin Email` and `Admin Password` inputs with "Generate Strong Password" and toggle visibility controls.
  - Create `src/app/admin/tenants/new/page.tsx`:
    - Full-page route for creating a new tenant using `<TenantForm mode="create" />`.
  - Create `src/app/admin/tenants/[id]/page.tsx`:
    - Full-page route for editing an existing tenant using `<TenantForm mode="edit" initialTenant={tenant} />`.
  - Update `src/components/tenants-control-center.tsx`:
    - Replace the modal trigger with a Link button navigating to `/admin/tenants/new`.
    - Update the table action buttons to link to `/admin/tenants/${tenant.id}` for editing.
  - Update unit tests in `src/modules/control-plane/__tests__/tenantActions.test.ts` to test saving and retrieving tenant admin credentials.

---

### Task 2: Tenant-Isolated Admin Authentication
- **Files**:
  - `src/server/actions/authActions.ts`
  - `src/server/actions/__tests__/tenantAuth.test.ts`
- **Implementation**:
  - In `src/server/actions/authActions.ts`:
    - In `loginAdminOrDev(email, password, userAgent)`:
      - Read current tenant context from request headers (`x-tenant-id`, `x-tenant-slug`, `x-is-dev-portal`).
      - If on a Client Portal (`!isDevPortal`):
        - Fetch active tenant record via `getTenantRecordById` or `getTenantRecordBySlug`.
        - If tenant has `admin_email` and `admin_password_encrypted`:
          - Compare `cleanEmail` with `tenant.admin_email.toLowerCase()`.
          - Decrypt `tenant.admin_password_encrypted` and compare using `timingSafeMatch`.
          - If matched, issue session with `role: "ADMIN"`, `locNo: String(tenant.loc_no ?? 11)`, and `compNo: tenant.comp_no ?? 11`.
        - Fallback: If tenant does not have custom admin credentials configured, verify against legacy `process.env.ADMIN_EMAIL` and `process.env.ADMIN_PASSWORD`.
      - If on Dev Portal (`isDevPortal`):
        - Authenticate strictly against `DEV_EMAIL` & `DEV_PASSWORD`.
  - Add unit test suite in `src/server/actions/__tests__/tenantAuth.test.ts` verifying tenant admin credentials authentication, rejection of other tenants' admin passwords, and fallback behavior.

---

### Task 3: Fix Query Parameter Injection (`comp_no`, `loc_no`, `legacy_db_name`)
- **Files**:
  - `src/middleware.ts`
  - `src/lib/api-client.ts`
  - `src/server/actions/mrInfo.ts`
  - `src/server/actions/stockAndSales.ts`
  - `src/server/actions/customerBlocking.ts`
  - `src/server/actions/overdueEngine.ts`
  - `api-server/src/routes/reports.ts`
  - `src/lib/__tests__/api-client-params.test.ts`
- **Implementation**:
  - In `src/middleware.ts`:
    - Forward `x-tenant-db-name` header from `tenant.legacy_db_name` alongside existing `x-tenant-comp-no` and `x-tenant-loc-no`.
  - In `src/lib/api-client.ts`:
    - In `getDynamicApiConfig()`:
      - Read `x-tenant-comp-no`, `x-tenant-loc-no`, and `x-tenant-db-name` from request headers.
    - In `apiPost(path, body)`:
      - If `body` is an object, automatically inject:
        - `compNo: body.compNo ?? tenantCompNo ?? 11`
        - `locNo: body.locNo ?? tenantLocNo ?? 11`
        - `dbName: body.dbName ?? tenantDbName`
    - In `apiGet(path, queryParams)`:
      - Automatically inject `compNo` and `locNo` into query params if not explicitly provided.
  - In `src/server/actions/`:
    - In `stockAndSales.ts`, `customerBlocking.ts`, `mrInfo.ts`, `overdueEngine.ts`: ensure calls pass dynamic `compNo` and `locNo` from tenant headers.
  - In `api-server/src/routes/reports.ts`:
    - Ensure stored procedure calls (`rptStockandSalesStatementReport`, `rptOutstandingReport`, etc.) respect the incoming `compNo` and `locNo` instead of hardcoded numbers.
  - Add unit tests in `src/lib/__tests__/api-client-params.test.ts` verifying automatic parameter injection.

---

### Task 4: Developer Panel (`/admin/dev`) — Global vs Per-Tenant Feature Mapping
- **Files**:
  - `src/app/admin/dev/page.tsx`
  - `src/components/dev-control-center.tsx`
  - `src/server/actions/devDiagnostics.ts`
- **Implementation**:
  - In `src/components/dev-control-center.tsx`:
    - Add a sticky top-bar Tenant Selector dropdown (`Platform (Global Defaults)` + list of all active tenants).
    - Divide the Developer Panel into two distinct sections:
      1. **Global Platform Controls**:
         - Platform Maintenance Mode toggle (puts entire platform into maintenance).
         - Global Debug Mode / Raw SQL query banner toggle (`?debug=1`).
         - Platform telemetry, system email test, and health status.
      2. **Per-Tenant Controls** (scoped when a tenant is selected):
         - Tenant Feature Flags: toggle specific modules (e.g., Claim Quantity, Ranking, PDF Exports, Offline PWA) for that tenant.
         - Tenant Maintenance Mode: put a single tenant into maintenance without affecting other clients.
         - Tenant License: view and modify subscription plan, status, and expiration in `tenant_licenses`.
         - Tenant Runtime Overrides: adjust `comp_no`, `loc_no`, overdue blocking days in `tenant_runtime_config`.
    - Clean up metadata and titles: replace `"Asmee Pharma"` references with `"Devfinity Platform Control Center"`.

---

### Task 5: Centralized Dev Platform Dashboard (`/admin/dashboard`) & Scoping
- **Files**:
  - `src/components/dev-platform-dashboard.tsx`
  - `src/app/admin/dashboard/page.tsx`
  - `src/app/admin/page.tsx`
  - `src/components/collapsible-sidebar.tsx`
  - `src/app/admin/notices/NoticeListClient.tsx`
  - `src/server/actions/notices.ts`
  - `src/app/admin/audit/page.tsx`
- **Implementation**:
  - Build `src/components/dev-platform-dashboard.tsx`:
    - Platform telemetry metrics: Total Registered Tenants, Active vs Suspended ratio, Neon Control Plane query latency (ms), Total MR headcount across all client tenants.
    - Recent tenant onboarding feed with direct links to preview and manage.
    - Quick Action Cards: "Onboard Tenant" (`/admin/tenants/new`), "Broadcast Notice" (`/admin/notices`), "Security Audit" (`/admin/audit`), "Developer Panel" (`/admin/dev`).
  - Update `src/app/admin/dashboard/page.tsx`:
    - Check `headers().get("x-is-dev-portal") === "true"`.
    - If `isDevPortal`: render `<DevPlatformDashboard />`.
    - If client portal: render existing client ERP Management Dashboard.
  - Update `src/app/admin/page.tsx`:
    - Redirect `/admin` to `/admin/dashboard` on both Dev Portal and Client Portals.
  - Update `src/components/collapsible-sidebar.tsx`:
    - In `devPortalNavItems`, add `Platform Dashboard` (`/admin/dashboard`, icon: `LayoutDashboard`) at the top of the menu.
  - In `src/app/admin/notices/NoticeListClient.tsx` & `src/server/actions/notices.ts`:
    - Add `tenantId?: string | null` to notice creation/update.
    - On Dev Portal: show notices with `Global Broadcast` or `Tenant: [Name]` badges; allow selecting target tenant when creating.
    - On Client Portals: query `WHERE is_active = true AND (tenant_id IS NULL OR tenant_id = :activeTenantId)`.
  - In `src/app/admin/audit/page.tsx`:
    - On Dev Portal: add tenant filter dropdown to view platform audit trails by tenant.
    - On Client Portals: scope audit logs to the active client tenant.

---

### Task 6: Environment Configuration Cleanup (`.env`, `src/env.js`, `.env.example`)
- **Files**:
  - `.env`
  - `src/env.js`
  - `.env.example`
- **Implementation**:
  - Review and clean `.env` and `src/env.js`:
    - Remove dead or obsolete single-tenant variables that are now superseded by Neon control plane records.
    - Document core platform variables (`CONTROL_PLANE_DATABASE_URL`, `CONTROL_PLANE_ENCRYPTION_KEY`, `DEV_PORTAL_DOMAIN`, `DEV_EMAIL`, `DEV_PASSWORD`, `DEV_SMTP_*`, `BETTER_AUTH_SECRET`, `NODE_ENV`).
    - Keep `API_SERVER_URL` / `API_SECRET_KEY` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` as strictly optional fallbacks for local standalone testing.
  - Synchronize `.env.example` with clear comments.

---

### Task 7: Comprehensive Testing, Typecheck & Verification
- **Files**:
  - Full Vitest suite
  - TypeScript validation (`tsc --noEmit`)
  - Next.js production build (`next build`)
- **Verification Plan**:
  1. `pnpm test` — Ensure all existing 16 test suites (92 tests) pass and new tests pass.
  2. `pnpm run typecheck` (`tsc --noEmit`) — Zero type errors.
  3. `pnpm run build` (`next build`) — Compile clean production bundle.
  4. Create `37-UAT.md`, update `ROADMAP.md` and `STATE.md`, commit and push to `origin/localdb`.
