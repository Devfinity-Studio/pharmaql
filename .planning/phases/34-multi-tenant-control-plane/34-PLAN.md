# Phase 34 Plan: PharmaQL Client Multi-Tenant Consumption & Edge-Safe Routing

## Objective
Refactor the PharmaQL repository into a multi-tenant client consumer backed by Neon Postgres (`@neondatabase/serverless`). 
This repository acts **strictly as the consumer**. The Developer Control Panel UI lives in a completely separate repository (`DevfinityFrontend`). This repository will dynamically resolve tenants via custom domains, apply white-label branding, and connect to client-specific read-only databases using a strictly relational state schema.

---

## Strict Architectural Guardrails
1. **Decoupled Admin UI:** Do NOT create tenant registration forms, tenant management actions, or a Dev Control Center UI in this repository. All management happens externally in `DevfinityFrontend`.
2. **Relational State Schema (No JSONB KV Stores):** State persistence must use normalized relational tables (`tenant_notices`, `tenant_features`, `tenant_licenses`, etc.), strictly scoped by `tenant_id`. Do not use a generic JSONB `control_plane_store`.
3. **Edge Runtime Safety (CRITICAL):** Next.js Middleware runs on the Edge. You must NEVER import `pg`, `net`, or `src/lib/db/tenant-pool.ts` into `src/middleware.ts` or any file it imports. Middleware must strictly use `@neondatabase/serverless` (HTTP fetch) for tenant lookups.
4. **No Kinde Auth:** Retain the existing Better Auth system. Do not install or assume Kinde Auth.
5. **Read-Only Safety:** All dynamic `pg.Pool` connections must execute `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` upon checkout.
6. **Serverless Connection Bounds:** Restrict dynamic client `pg.Pool` sizes to `max: 2` per lambda container (`idleTimeoutMillis: 300000`) and evict pools idle for > 15 minutes.
7. **Offline Dev Fallback:** If `CONTROL_PLANE_DATABASE_URL` is omitted, fallback cleanly to local `.env` and disk JSON storage (`data/`) without throwing runtime errors.

---

## Detailed File-by-File Implementation Plan

### Task 1: Package Dependencies & Authenticated Secret Decryption
- **Files**:
  - [`package.json`](file:///e:/work/pharmaql/package.json)
  - [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts)
  - [`src/lib/__tests__/crypto.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/crypto.test.ts)
- **Details**:
  - Run `pnpm add @neondatabase/serverless pg` and `pnpm add -D @types/pg`.
  - In [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts):
    - Implement `decryptSecret(cipherPayload: string): string` using Node.js `node:crypto` (`aes-256-gcm`).
    - Read `CONTROL_PLANE_ENCRYPTION_KEY` to decrypt client database passwords and API keys stored in Neon.
    - Include an `encryptSecret` helper solely for local Vitest mocking/testing, as actual encryption happens in the admin repo.
  - Create Vitest test suite in [`src/lib/__tests__/crypto.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/crypto.test.ts) validating decryption round-trips, key length validation, and tampering rejection.

### Task 2: Neon Relational Schema & Client Initialization
- **Files**:
  - [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts)
- **Details**:
  - Initialize `@neondatabase/serverless` HTTP client (`neon`) using `CONTROL_PLANE_DATABASE_URL`.
  - Expose an initialization function that ensures the following **relational** tables exist (idempotent DDL):
    - `tenants` (`id UUID PRIMARY KEY`, `slug VARCHAR(64) UNIQUE NOT NULL`, `custom_domain VARCHAR(255) UNIQUE`, `is_active BOOLEAN NOT NULL DEFAULT true`, `display_name VARCHAR(255) NOT NULL`, `short_name VARCHAR(64)`, `logo_url TEXT`, `address TEXT`, `contact_phone VARCHAR(64)`, `contact_email VARCHAR(128)`, `gstin VARCHAR(64)`, `db_type VARCHAR(32) NOT NULL DEFAULT 'postgres'`, `db_connection_encrypted TEXT`, `api_server_url TEXT`, `api_server_key_encrypted TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    - `tenant_notices` (`id UUID PRIMARY KEY`, `tenant_id UUID REFERENCES tenants(id)`, `title TEXT NOT NULL`, `content TEXT NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    - `tenant_features` (`tenant_id UUID REFERENCES tenants(id) PRIMARY KEY`, `maintenance_mode BOOLEAN NOT NULL DEFAULT false`, `feature_flags JSONB NOT NULL DEFAULT '{}'`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    - `tenant_licenses` (`tenant_id UUID REFERENCES tenants(id) PRIMARY KEY`, `status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'`, `expires_at TIMESTAMPTZ`, `plan_type VARCHAR(64) NOT NULL DEFAULT 'ENTERPRISE'`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    - `tenant_runtime_config` (`tenant_id UUID REFERENCES tenants(id) PRIMARY KEY`, `settings JSONB NOT NULL DEFAULT '{}'`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)

### Task 3: Server Storage Adapter (Relational Mapping)
- **Files**:
  - [`src/lib/server-storage.ts`](file:///e:/work/pharmaql/src/lib/server-storage.ts)
  - [`src/lib/__tests__/server-storage.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/server-storage.test.ts)
- **Details**:
  - Refactor `readServerJson` and `writeServerJson` helper methods to query the new relational tables instead of ephemeral Vercel `/tmp` files.
  - Map legacy file keys to their respective relational queries:
    - `"notices.json"` -> query `tenant_notices` (`SELECT * FROM tenant_notices WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC`).
    - `"maintenance.json"` -> query `tenant_features` (`SELECT maintenance_mode, feature_flags FROM tenant_features WHERE tenant_id = $1`).
    - `"license.json"` -> query `tenant_licenses` (`SELECT status, expires_at, plan_type FROM tenant_licenses WHERE tenant_id = $1`).
    - `"runtime-config.json"` -> query `tenant_runtime_config` (`SELECT settings FROM tenant_runtime_config WHERE tenant_id = $1`).
  - If `CONTROL_PLANE_DATABASE_URL` is omitted, retain the fallback to local `.env` and disk JSON storage (`data/`).

### Task 4: Edge-Safe Tenant Resolution & Middleware
- **Files**:
  - [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts)
  - [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts)
  - [`src/lib/__tests__/tenant-resolver.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/tenant-resolver.test.ts)
- **Details**:
  - **`src/lib/tenant-resolver.ts`**:
    - Must be 100% Edge-compatible (strictly zero Node.js native `net`, `pg`, or file system modules).
    - Expose `resolveTenantByHost(host: string)` using the Neon HTTP client (`@neondatabase/serverless`) to fetch the tenant matching `custom_domain = host AND is_active = true`.
    - Handle `process.env.DEV_PORTAL_DOMAIN` (e.g., `devfinity.net`, `pharmaql.devfinity.net`, or `localhost`): allow tenant simulation via `x-tenant-slug` header or `?tenant=` query parameter.
    - Implement caching via Next.js `unstable_cache` tagged with `tenant-lookup`.
  - **`src/middleware.ts`**:
    - Intercept requests, extract `Host` header, and call `resolveTenantByHost(host)`.
    - Pass `x-tenant-id`, `x-tenant-slug`, `x-tenant-name`, and `x-tenant-domain` downstream via request headers.
    - If a domain is unrecognized or inactive, rewrite to a clean 404 "Tenant Not Found" page to avoid leaking routes or portal structure.

### Task 5: Node.js Client Database Pool (Strictly Isolated from Edge)
- **Files**:
  - [`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts)
  - [`src/lib/__tests__/tenant-pool.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/tenant-pool.test.ts)
- **Details**:
  - *Crucial:* This file uses `pg.Pool` and must NEVER be imported by edge middleware. It is purely server-side (Node.js runtime).
  - Maintain an in-memory connection pool registry: `Map<string, { pool: Pool, lastUsed: number }>`.
  - For `postgres` tenants:
    - Decrypt database credentials using `decryptSecret`.
    - Create a `pg.Pool` with serverless bounds (`max: 2`, `idleTimeoutMillis: 300000`).
    - Hook into the pool's `'connect'` event to execute `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`.
  - Implement a cleanup routine to evict pools idle for more than 15 minutes.

### Task 6: Dynamic API Proxying
- **Files**:
  - [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts)
- **Details**:
  - Modify existing external fetch logic:
    - When `tenant.db_type === 'api_server'`, override the base URL with `tenant.api_server_url`.
    - Decrypt `tenant.api_server_key_encrypted` and inject into `Authorization: Bearer <decryptedKey>` header.
    - Ensure tenant-specific timeout and error handling.

### Task 7: Dynamic UI White-Labeling Injection
- **Files**:
  - [`src/lib/tenant-context.tsx`](file:///e:/work/pharmaql/src/lib/tenant-context.tsx)
  - [`src/app/layout.tsx`](file:///e:/work/pharmaql/src/app/layout.tsx)
  - [`src/components/ReportHeader.tsx`](file:///e:/work/pharmaql/src/components/ReportHeader.tsx)
  - [`src/app/manifest.ts`](file:///e:/work/pharmaql/src/app/manifest.ts)
- **Details**:
  - **`src/lib/tenant-context.tsx`**: Create `<TenantProvider>` supplying `shortName`, `displayName`, `logoUrl`, `address`, `phone`, `email`, and `gstin`.
  - **`src/app/layout.tsx`**: Parse tenant headers server-side, inject into `<TenantProvider>`, and dynamically render HTML `<title>` (`{pageTitle} | {tenant.shortName}`) and `<link rel="icon">`.
  - **`src/components/ReportHeader.tsx` & PDF Generators**: Remove all hardcoded instances of "Asmee Pharma". Bind all stationery headers, tax IDs, and logos directly to properties exposed by `useTenant()`.

### Task 8: Verification, Automated Vitest Suite & Build Validation
- **Files**:
  - Vitest test suites (`src/lib/__tests__/*.test.ts`)
- **Details**:
  - Run Vitest unit tests verifying AES-256-GCM decryption, server storage relational fallback, and pool lifecycle (`pnpm test`).
  - Run TypeScript verification (`pnpm run typecheck`).
  - Run Next.js production build (`pnpm run build`).

---

## Verification & Acceptance Criteria
1. **Vitest Unit Tests:** Run `pnpm test` (verify AES-256-GCM encryption/decryption, server storage fallback, and pool lifecycle).
2. **Type Safety:** Run `pnpm run typecheck` (zero TypeScript errors).
3. **Build:** Run `pnpm run build` (Next.js production build succeeds cleanly).
4. **Behavioral Checks:**
   - Middleware is 100% Edge-safe: zero imports of `pg`, `net`, or `tenant-pool.ts`.
   - Navigating to `process.env.DEV_PORTAL_DOMAIN` (`devfinity.net`, `pharmaql.devfinity.net`, or `localhost`) allows tenant simulation via `x-tenant-slug` header or `?tenant=` query parameter.
   - Navigating to a registered client domain (e.g., `portal.asmeepharma.com`) loads the application with that client's specific branding, stationery, and read-only data.
   - Navigating to an unmapped domain returns an HTTP 404 page.
   - Dynamic client database transactions are strictly read-only (`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`).
   - Relational tables (`tenant_notices`, `tenant_features`, `tenant_licenses`, `tenant_runtime_config`) persist data across Vercel cold starts.
