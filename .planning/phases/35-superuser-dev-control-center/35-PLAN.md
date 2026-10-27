# Phase 35 Plan: Monolithic Dev Control Center & Superuser Admin Portal

## Objective
Implement the Superuser Dev Control Center directly within the monolithic PharmaQL application, conditionally accessible on the Dev Portal domain (`pharmaql.devfinity.net` or `DEV_PORTAL_DOMAIN`). 
Superusers can register and manage tenants, encrypt and store database credentials in Neon Postgres, and run live connection latency and diagnostic tests using Node.js `pg`.

---

## Strict Architectural Guardrails
1. **Edge Runtime Safety (CRITICAL):**
   - [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts) runs on Vercel Edge Runtime. 
   - ZERO imports of native Node modules (`net`, `tls`) or `pg` or `tenant-pool.ts` in middleware.
   - Middleware handles host detection and domain routing strictly using HTTP-based `@neondatabase/serverless`.
2. **Node.js Isolation for DB Drivers:**
   - The `pg` library is strictly isolated to Node.js Server Actions (`src/modules/control-plane/tenantActions.ts`) and the existing connection pool manager ([`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts)).
3. **Relational State Schema:**
   - All tenant registrations, notices, features, and configuration must persist into normalized relational tables in Neon (`tenants`, `tenant_notices`, `tenant_features`, `tenant_licenses`, `tenant_runtime_config`).
4. **No Kinde Auth:**
   - Retain the existing Better Auth system.
5. **Client Domain Isolation:**
   - Client domains (e.g. `portal.asmeepharma.com`) must never be able to access `/admin` or Dev Portal control pages. Middleware rewrites any unauthorized attempts to 404 (`/tenant-not-found`).

---

## Detailed File-by-File Implementation Plan

### Task 1: Edge Middleware Domain Partitioning & Ingress Isolation
- **Files**:
  - [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts)
  - [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts)
- **Details**:
  - In [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts):
    - When `pathname.startsWith("/admin")`: check `isDevPortal`. If `!isDevPortal`, rewrite the request to `/tenant-not-found` so client domains cannot reach the Dev Control Center or administrative pages.
    - When `isDevPortal && pathname === "/"`: rewrite or redirect to `/admin/tenants` so superusers accessing `pharmaql.devfinity.net` land directly on the control plane dashboard.
  - Ensure zero native `net` or `pg` imports are introduced into the middleware dependency graph.

### Task 2: Control Plane Server Actions & Encrypted Tenant Secrets
- **Files**:
  - `src/modules/control-plane/tenantActions.ts`
  - `src/modules/control-plane/__tests__/tenantActions.test.ts`
- **Details**:
  - Create `src/modules/control-plane/tenantActions.ts` with `"use server"`:
    - `listTenantsAction()`: Query the `tenants` table via `getControlPlaneSql()`. Ensure schema is initialized with `initControlPlaneRelationalSchema()`. Return tenant records with sensitive connection secrets masked for safety (`dbConnectionConfigured: boolean`, `apiKeyConfigured: boolean`).
    - `saveTenantAction(data)`:
      - Validates required fields (`slug`, `display_name`, `db_type`).
      - Encrypts `db_connection` and `api_server_key` using `encryptSecret` from [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts) before persisting.
      - Handles both Insert (new tenant) and Update (existing tenant by ID).
    - `toggleTenantStatusAction(tenantId: string, isActive: boolean)`:
      - Updates `is_active = $1` in `tenants` table.
    - `deleteTenantAction(tenantId: string)`:
      - Deletes tenant record and cascades to child relational tables.
  - Create unit tests in `src/modules/control-plane/__tests__/tenantActions.test.ts` covering CRUD operations, encryption integrity, and error handling.

### Task 3: Live Database Connectivity Diagnostics Action
- **Files**:
  - `src/modules/control-plane/tenantActions.ts`
  - `src/modules/control-plane/__tests__/tenantActions.test.ts`
- **Details**:
  - Implement `testDbConnectionAction({ tenantId, rawDbConnection })`:
    - If `tenantId` is provided, fetches the encrypted connection string from Neon and decrypts it with `decryptSecret()`.
    - If `rawDbConnection` is provided (e.g., from modal form pre-save), uses the provided connection string.
    - Uses Node.js `pg.Client` with `connectionTimeoutMillis: 5000` to prevent hanging connections.
    - Executes `SELECT current_database() as db, version() as version;`.
    - Measures roundtrip latency (ms) and returns `{ success: true, db, version, latencyMs }` or `{ success: false, error: err.message }`.
    - Guarantees immediate cleanup via `await client.end().catch(...)` in a `finally` block.

### Task 4: Superuser Dev Control Center UI & Sidebar Integration
- **Files**:
  - `src/components/tenants-control-center.tsx`
  - `src/components/tenant-modal.tsx`
  - `src/app/admin/tenants/page.tsx`
  - `src/app/admin/page.tsx`
  - [`src/components/collapsible-sidebar.tsx`](file:///e:/work/pharmaql/src/components/collapsible-sidebar.tsx)
- **Details**:
  - Build `src/components/tenants-control-center.tsx`:
    - Metric overview cards: Total Tenants, Active Tenants, Inactive Tenants, Control Plane DB Status.
    - Search & Filter bar: Search by name, slug, domain. Filter by status (All, Active, Inactive).
    - Data table: Tenant Name, Slug, Custom Domain, DB Type, Status Badge (Active/Inactive), Last Updated, Actions (Ping DB Connection, Edit, Toggle Active).
  - Build `src/components/tenant-modal.tsx`:
    - Modal dialog with clean tabs/sections:
      - Basic Details (Display Name, Short Name, Slug, Custom Domain).
      - Stationery (Logo URL, Address, Phone, Email, GSTIN).
      - Database & API Integration (DB Type, Connection URI, API Server URL, API Key).
    - Includes inline "Test Connection" button to verify database URI before saving.
  - Create `src/app/admin/tenants/page.tsx`:
    - Server component requiring `ADMIN` or `DEVELOPER` session, fetching initial tenant list via `listTenantsAction()`, and mounting `<TenantsControlCenter />`.
  - Create `src/app/admin/page.tsx`:
    - Redirects or mounts `/admin/tenants`.
  - In [`src/components/collapsible-sidebar.tsx`](file:///e:/work/pharmaql/src/components/collapsible-sidebar.tsx):
    - Add "Tenant Control Center" menu item with database icon for `DEVELOPER` and `ADMIN` roles pointing to `/admin/tenants`.

### Task 5: Testing, Validation & Production Build Verification
- **Files**:
  - Run Vitest suite: `pnpm test`.
  - Run typecheck: `pnpm run typecheck`.
  - Run Next.js production build: `pnpm run build`.
  - Document results and UAT in `.planning/phases/35-superuser-dev-control-center/35-UAT.md`.
