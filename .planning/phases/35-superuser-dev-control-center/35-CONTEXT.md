# Phase 35 Context: Monolithic Dev Control Center & Superuser Admin Portal

## Executive Summary
This phase completes the multi-tenant architecture by introducing the administrative Dev Control Center into the monolithic codebase, served conditionally based on the incoming domain.
- **Dev Portal Domain (`pharmaql.devfinity.net` / `DEV_PORTAL_DOMAIN` / `localhost` in dev mode):** Root (`/`) and administrative routes serve the Dev Control Center where superusers can register and manage tenants, encrypt database credentials, and execute live connection health diagnostics.
- **Client Domains (e.g. `portal.asmeepharma.com`):** Direct traffic to the white-labeled PharmaQL ERP consumer UI, strictly isolating client domains from accessing `/admin` or Dev Control Center routes (rewriting to 404 or redirecting).

---

## Architectural Guardrails

1. **Edge Runtime Safety (CRITICAL):**
   - [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts) runs on the Vercel Edge Runtime.
   - NEVER import `pg`, `net`, `tls`, or `src/lib/db/tenant-pool.ts` into middleware.
   - Middleware handles host detection and domain routing strictly using HTTP-based `@neondatabase/serverless` and standard request headers.

2. **Node.js Isolation for Native DB Drivers:**
   - The `pg` library is strictly isolated to Node.js Server Actions (for live DB ping testing in `src/modules/control-plane/tenantActions.ts`) and the existing connection manager ([`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts)).

3. **Relational State Schema Persistence:**
   - All tenant registrations, notices, features, and configuration must persist into normalized relational tables in Neon (`tenants`, `tenant_notices`, `tenant_features`, `tenant_licenses`, `tenant_runtime_config`).
   - No fallback to ephemeral local JSON files or `/tmp`.

4. **Authentication & Authorization:**
   - Retain Better Auth. Superuser access to the Dev Control Center requires an authenticated session with admin privileges or verification against `SUPERUSER_SECRET` / `DEV_ACCESS_PASSWORD`.

---

## Decided Ingress & Routing Structure

- **Dev Portal Ingress:**
  - If `x-is-dev-portal` is `true`:
    - Accessing `/` or `/admin` loads the Superuser Dev Control Center.
- **Client Domain Ingress:**
  - If `x-is-dev-portal` is `false` (or unmapped):
    - Client domains render the white-labeled tenant ERP portal.
    - Any attempt by client domains to navigate to `/admin` or Dev Portal management endpoints is rewritten to 404 (`/tenant-not-found` or clean Next.js not-found).

---

## Decided Feature Set & Implementation Scope

### 1. Control Plane Server Actions (`src/modules/control-plane/tenantActions.ts`)
- **`listTenantsAction`**: Retrieves all registered tenants from the Neon `tenants` table. Omits or masks encrypted connection strings for security in client view.
- **`saveTenantAction` (Create / Update)**:
  - Validates payload (slug, custom_domain, display_name, short_name, logo_url, address, contact_phone, contact_email, gstin, db_type, raw db_connection, api_server_url, raw api_server_key).
  - Encrypts sensitive secrets (`db_connection_encrypted`, `api_server_key_encrypted`) using `encryptSecret` from [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts) before persisting to Neon.
  - Supports upsert / update logic.
- **`toggleTenantStatusAction`**: Activates / deactivates tenants.
- **`testDbConnectionAction`**:
  - Accepts a tenant ID or a raw connection string.
  - Decrypts the secret if tenant ID is passed.
  - Connects using a short-lived `pg.Client` / `pg.Pool` with connection timeout safeguards (e.g. 5000ms).
  - Executes `SELECT current_database() as db, version() as ver;`.
  - Measures roundtrip latency (ms) and returns `{ success: true, db, version, latencyMs }` or descriptive failure details.

### 2. Superuser Dev Control Center UI (`src/app/admin/page.tsx` & Components)
- **Metric Overview Cards**:
  - Total Registered Tenants.
  - Active Tenants vs. Inactive Tenants.
  - Database Health & Quick Ping indicators.
- **Tenant Management Data Grid**:
  - Searchable, filterable list of tenants displaying slug, display name, custom domain, status badge (Active/Inactive), and actions (Test DB, Edit, Toggle Active).
- **Tenant Modal Form**:
  - Clean modal dialog for adding/editing tenants with tabs or clear sections:
    - Basic Information (Slug, Display Name, Short Name, Custom Domain).
    - Branding & Stationery (Logo URL, Address, Contact Phone/Email, GSTIN).
    - Database & API Integration (DB Type, Connection URI, API Server URL, API Key).
  - Built-in "Test Connection" button inside the modal to verify connectivity before saving.

---

## Verification Plan
1. **Unit & Action Testing**:
   - Write Vitest tests for `src/modules/control-plane/tenantActions.ts` (encrypt/save, list, status toggle, test connection timeout/fallback).
2. **Middleware & Route Boundary Testing**:
   - Verify that requests with `x-is-dev-portal: false` cannot access `/admin`.
3. **Build & Typecheck**:
   - Run `pnpm run typecheck` (0 errors).
   - Run `pnpm test` (all tests passing).
   - Run `pnpm run build` (successful compilation).
