# Phase 34 Plan: Multi-Tenant Control Plane & Dynamic Client DB Resolution

## Objective
Transition PharmaQL from a single-tenant on-premise application to an enterprise multi-tenant cloud control plane powered by Neon Serverless Postgres (`@neondatabase/serverless`). Symmetrically encrypt all client credentials with AES-256-GCM (`CONTROL_PLANE_ENCRYPTION_KEY`), dynamically route tenants via custom domains with in-memory TTL caching, provide dynamic read-only PostgreSQL pools alongside on-premise API server proxying, abstract white-label UI branding, fix Vercel `/tmp` state wipe bugs permanently, and build a dedicated tenant management suite in the Dev Control Center.

---

## Tasks

### Task 1: Package Dependencies, AES-256-GCM Secret Encryption & Unit Tests
- **Files**:
  - [`package.json`](file:///e:/work/pharmaql/package.json)
  - [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts)
  - [`src/lib/__tests__/crypto.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/crypto.test.ts)
- **Description**:
  - Install `@neondatabase/serverless`, `pg`, and `@types/pg`.
  - Create [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts) implementing:
    - `encryptSecret(plaintext: string, masterKey?: string): string` using Node.js native `crypto.createCipheriv("aes-256-gcm", key, iv)`.
    - `decryptSecret(ciphertext: string, masterKey?: string): string` validating auth tag before decryption.
    - `getEncryptionKey()` loading `CONTROL_PLANE_ENCRYPTION_KEY` (32 bytes from hex or base64) with deterministic fallback generation for local development.
  - Create Vitest test suite in [`src/lib/__tests__/crypto.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/crypto.test.ts) testing round-trip encryption, tampered ciphertext rejection, and invalid key lengths.

### Task 2: Neon Control Plane Client & Persistent Server Storage Adapter
- **Files**:
  - [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts)
  - [`src/lib/server-storage.ts`](file:///e:/work/pharmaql/src/lib/server-storage.ts)
  - [`src/lib/__tests__/server-storage.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/server-storage.test.ts)
- **Description**:
  - Build [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts) using `@neondatabase/serverless` connected via `CONTROL_PLANE_DATABASE_URL`:
    - Automatically run idempotent DDL migrations to ensure `tenants` and `control_plane_store` tables exist:
      - `tenants` (`id UUID PRIMARY KEY`, `slug VARCHAR(64) UNIQUE NOT NULL`, `name VARCHAR(255) NOT NULL`, `logo_url TEXT`, `custom_domain VARCHAR(255) UNIQUE`, `db_type VARCHAR(32) NOT NULL DEFAULT 'postgres'`, `db_connection_encrypted TEXT`, `api_server_url TEXT`, `api_server_key_encrypted TEXT`, `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
      - `control_plane_store` (`tenant_id VARCHAR(64) NOT NULL DEFAULT 'global'`, `key VARCHAR(128) NOT NULL`, `data JSONB NOT NULL`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `PRIMARY KEY (tenant_id, key)`)
  - Refactor [`src/lib/server-storage.ts`](file:///e:/work/pharmaql/src/lib/server-storage.ts):
    - When `CONTROL_PLANE_DATABASE_URL` is set, `readServerJson` and `writeServerJson` read/write to `control_plane_store` scoped by current tenant ID (or `'global'`).
    - If `CONTROL_PLANE_DATABASE_URL` is unset, automatically fall back to local disk (`/tmp` / `data/`) for offline development.
    - This permanently fixes Vercel serverless cold-start state loss for notices, feature toggles, licenses/subscriptions, and feedback reports!

### Task 3: Tenant Resolution Middleware & In-Memory TTL Cache
- **Files**:
  - [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts)
  - [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts)
  - [`src/lib/__tests__/tenant-resolver.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/tenant-resolver.test.ts)
- **Description**:
  - Create [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts):
    - Maintains an in-memory cache mapping domain/slug to tenant metadata with a 5-minute TTL.
    - Exposes `resolveTenantByHost(host: string, searchParams?: URLSearchParams, headers?: Headers): Promise<TenantRecord | null>`.
    - Handles `DEV_PORTAL_DOMAIN`: allows tenant switching via `x-tenant-slug` header or `?tenant=` query parameter.
    - Exposes `invalidateTenantCache(slugOrDomain?: string)` to immediately flush cache on tenant updates.
  - Update [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts):
    - Intercept requests, resolve tenant via `resolveTenantByHost`.
    - For non-dev-portal domains: if tenant not found or inactive, return a branded 404 "Tenant Not Found".
    - Forward `x-tenant-id`, `x-tenant-slug`, `x-tenant-name`, and `x-is-dev-portal` headers downstream.

### Task 4: Dynamic Hybrid Client DB Pool Manager
- **Files**:
  - [`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts)
  - [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts)
  - [`src/lib/__tests__/tenant-pool.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/tenant-pool.test.ts)
- **Description**:
  - Implement [`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts):
    - `getTenantDbPool(tenant: TenantRecord): Promise<Pool>`
    - Decrypts `db_connection_encrypted` using `decryptSecret`.
    - Instantiates and caches a `pg.Pool` with connection pool limits (`max: 10`, `idleTimeoutMillis: 900000`).
    - Enforces read-only safety on connection acquire: `client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")`.
    - Implements periodic and on-demand pool eviction for pools idle > 15 minutes.
  - Enhance [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts):
    - Support dynamic tenant targeting: when a tenant specifies `db_type === 'api_server'`, resolve `api_server_url` and decrypted `api_server_key_encrypted` per tenant.

### Task 5: Dynamic UI Branding & Identity Context
- **Files**:
  - [`src/lib/tenant-context.tsx`](file:///e:/work/pharmaql/src/lib/tenant-context.tsx)
  - [`src/app/layout.tsx`](file:///e:/work/pharmaql/src/app/layout.tsx)
  - [`src/components/ReportHeader.tsx`](file:///e:/work/pharmaql/src/components/ReportHeader.tsx)
  - [`src/app/manifest.ts`](file:///e:/work/pharmaql/src/app/manifest.ts)
- **Description**:
  - Create [`src/lib/tenant-context.tsx`](file:///e:/work/pharmaql/src/lib/tenant-context.tsx) exposing `TenantProvider` and `useTenant()` hook.
  - Create server-side helper `getCurrentTenant()` reading from incoming headers (`x-tenant-slug`, `x-tenant-name`, `x-tenant-id`).
  - Update [`src/app/layout.tsx`](file:///e:/work/pharmaql/src/app/layout.tsx) to wrap the app in `TenantProvider` and render dynamic tenant title, favicon, and meta tags.
  - Update [`src/components/ReportHeader.tsx`](file:///e:/work/pharmaql/src/components/ReportHeader.tsx) and report generators to dynamically display tenant logo and company name instead of hardcoded "Asmee Pharma".

### Task 6: Developer Control Center Tenant Management Tab & Server Actions
- **Files**:
  - [`src/server/actions/tenantActions.ts`](file:///e:/work/pharmaql/src/server/actions/tenantActions.ts)
  - [`src/components/dev-control-center.tsx`](file:///e:/work/pharmaql/src/components/dev-control-center.tsx)
  - [`src/app/admin/dev/page.tsx`](file:///e:/work/pharmaql/src/app/admin/dev/page.tsx)
- **Description**:
  - Create [`src/server/actions/tenantActions.ts`](file:///e:/work/pharmaql/src/server/actions/tenantActions.ts):
    - `listTenantsAction()`
    - `createTenantAction(data)`: Encrypts secrets, invalidates resolver cache, inserts record into Neon.
    - `updateTenantAction(id, data)`: Re-encrypts secrets if changed, updates Neon, invalidates cache.
    - `toggleTenantActiveAction(id, isActive)`: Toggles active status.
    - `pingTenantDbAction(id)`: Tests connectivity (PostgreSQL handshake or API server `/health` probe) and reports latency/status.
  - Update [`src/components/dev-control-center.tsx`](file:///e:/work/pharmaql/src/components/dev-control-center.tsx):
    - Add `"tenants"` to `activeTab` union.
    - Build rich UI tab:
      - Tenant list with status pills (🟢 Active / ⚪ Inactive), domain badges, DB type indicators.
      - "Add New Tenant" modal with encrypted secret inputs and DB type selector (`postgres` vs `api_server`).
      - "Test Connection" button triggering `pingTenantDbAction`.
      - Edit and Toggle Active controls.
  - Pass initial tenant list from [`src/app/admin/dev/page.tsx`](file:///e:/work/pharmaql/src/app/admin/dev/page.tsx).

### Task 7: Verification, Automated Vitest Suite & Build Validation
- **Files**:
  - Vitest test suites (`src/lib/__tests__/*.test.ts`)
  - Integration sanity checks
- **Description**:
  - Run all Vitest suites testing encryption, server storage, tenant resolution, and connection pooling.
  - Verify clean TypeScript check (`pnpm run typecheck`).
  - Verify production Next.js build (`pnpm run build`).
  - Validate that existing local dev remains fully functional even when `CONTROL_PLANE_DATABASE_URL` is omitted.

---

## Success Criteria
- [ ] `@neondatabase/serverless` and `pg` installed and configured.
- [ ] AES-256-GCM authenticated encryption securely handles all client DB credentials.
- [ ] Control plane tables in Neon seamlessly auto-migrate on first connection.
- [ ] `readServerJson`/`writeServerJson` persist data in Neon Postgres, solving Vercel state loss for notices, toggles, and subscriptions.
- [ ] Host-based tenant resolution works with 5-minute in-memory TTL caching.
- [ ] Dev Portal domain supports tenant switching via header or query param.
- [ ] Unknown domains are safely stopped with a 404 page.
- [ ] Dynamic client DB connection pool enforces read-only safety (`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`) and evicts idle pools.
- [ ] Dynamic white-label branding renders tenant name and logo.
- [ ] Full Tenant Management tab operational in Developer Control Center.
- [ ] All Vitest tests pass and `pnpm run build` succeeds without type errors.
