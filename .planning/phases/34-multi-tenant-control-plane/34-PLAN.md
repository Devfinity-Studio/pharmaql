# Phase 34 Plan: Multi-Tenant Architecture, Dynamic White-Labeling & Dev Portal Isolation

## Objective
Refactor PharmaQL from a single-tenant on-premise application to an enterprise multi-tenant cloud control plane backed by Neon Postgres (`@neondatabase/serverless`):
1. **Developer Control Panel (`devfinity.net` / `pharmaql.devfinity.net`):** An administrative suite to register and manage client tenants, configure branding, encrypt and store credentials, test connectivity, and toggle active status.
2. **Client Frontends (e.g., `portal.asmeepharma.com`, `clientb.com`):** Identical core portal codebase dynamically white-labeled per domain with client-specific branding (name, logo, address, contact, GSTIN, report stationery), connecting exclusively to each client's dedicated read-only database or on-premise API server.
3. **State Persistence:** Replace ephemeral local file/JSON writes with tenant-scoped storage in Neon (`control_plane_store`) to permanently resolve Vercel serverless `/tmp` cold-start wipes.

---

## Strict Constraints & Safety Guardrails
1. **No Kinde Auth:** Retain the existing authentication system (Better Auth / session headers). Do NOT install, import, or assume Kinde Auth.
2. **Read-Only Safety:** All dynamic client PostgreSQL connection pools must strictly enforce `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` upon connection checkout.
3. **Edge / Serverless Compatibility:**
   - Do NOT import `pg` or Node.js native `net` inside Next.js Edge Middleware.
   - Run tenant metadata queries using `@neondatabase/serverless` over HTTP (`neon(process.env.CONTROL_PLANE_DATABASE_URL)`).
   - Restrict dynamic client `pg.Pool` sizes to `max: 2` per lambda container (`idleTimeoutMillis: 300000`) to prevent exhausting client database connection limits.
4. **Offline Dev Fallback:** If `CONTROL_PLANE_DATABASE_URL` is omitted, fallback cleanly to local `.env` and disk JSON storage (`data/` or `/tmp`) without throwing runtime errors.

---

## Tasks & Implementation Plan

### Task 1: Package Dependencies & Authenticated Secret Encryption
- **Files**:
  - [`package.json`](file:///e:/work/pharmaql/package.json)
  - [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts)
  - [`src/lib/__tests__/crypto.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/crypto.test.ts)
- **Details**:
  - Install dependencies: `pnpm add @neondatabase/serverless pg && pnpm add -D @types/pg`.
  - Create [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts):
    - Implement `encryptSecret(plainText: string): string` and `decryptSecret(cipherPayload: string): string` using Node.js `node:crypto` with `aes-256-gcm`.
    - Read `CONTROL_PLANE_ENCRYPTION_KEY` (32 bytes from hex or base64), with deterministic fallback generation for local development.
    - Serialize payloads as `ivHex:authTagHex:encryptedHex` and validate authentication tags prior to decryption.
  - Create Vitest test suite in [`src/lib/__tests__/crypto.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/crypto.test.ts) validating encryption round-trips, key length validation, and tampering rejection.

### Task 2: Neon Control Plane Client & Persistent Storage Adapter
- **Files**:
  - [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts)
  - [`src/lib/server-storage.ts`](file:///e:/work/pharmaql/src/lib/server-storage.ts)
  - [`src/lib/__tests__/server-storage.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/server-storage.test.ts)
- **Details**:
  - Build [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts) utilizing `@neondatabase/serverless` connected via `CONTROL_PLANE_DATABASE_URL`:
    - Handle initialization checks and idempotent migrations for `tenants` and `control_plane_store` records:
      - `tenants` (`id UUID PRIMARY KEY`, `slug VARCHAR(64) UNIQUE NOT NULL`, `name VARCHAR(255) NOT NULL`, `short_name VARCHAR(64)`, `logo_url TEXT`, `address TEXT`, `contact_phone VARCHAR(64)`, `contact_email VARCHAR(128)`, `gstin VARCHAR(64)`, `custom_domain VARCHAR(255) UNIQUE`, `db_type VARCHAR(32) NOT NULL DEFAULT 'postgres'`, `db_connection_encrypted TEXT`, `api_server_url TEXT`, `api_server_key_encrypted TEXT`, `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
      - `control_plane_store` (`tenant_id VARCHAR(64) NOT NULL DEFAULT 'global'`, `key VARCHAR(128) NOT NULL`, `data JSONB NOT NULL`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `PRIMARY KEY (tenant_id, key)`)
  - Refactor [`src/lib/server-storage.ts`](file:///e:/work/pharmaql/src/lib/server-storage.ts):
    - Route `readServerJson(key)` and `writeServerJson(key, data)` to `control_plane_store` scoped by current tenant ID (or `'global'`) when `CONTROL_PLANE_DATABASE_URL` is configured.
    - Fall back automatically to local filesystem storage (`/tmp` or `data/`) when offline.
    - Permanently resolves Vercel cold-start wipes for notices, feature toggles, licenses/subscriptions, and feedback.

### Task 3: Host Resolution Middleware & Multi-Layer Caching
- **Files**:
  - [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts)
  - [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts)
  - [`src/lib/__tests__/tenant-resolver.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/tenant-resolver.test.ts)
- **Details**:
  - Build [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts):
    - Inspect incoming `Host` header.
    - **Developer Portal Context:** If `host` matches `process.env.DEV_PORTAL_DOMAIN` (e.g., `devfinity.net`, `pharmaql.devfinity.net`, or `localhost`), set `isDevPortal: true`. Support tenant simulation via `x-tenant-slug` header or `?tenant=` query parameter.
    - **Client Custom Domain Context:** Query active tenant record matching the incoming custom domain.
    - Implement caching: combine an in-memory TTL map (5 minutes) with Next.js `unstable_cache` tagged with `tenant-lookup`.
    - Expose `invalidateTenantCache(slugOrDomain?: string)` utilizing `revalidateTag`.
  - Update [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts):
    - Ensure zero `pg` / `net` imports in middleware (Edge/serverless safe).
    - For Dev Portal requests: forward `x-is-dev-portal: "true"` downstream.
    - For client domains: forward `x-tenant-id`, `x-tenant-slug`, `x-tenant-name`, and `x-tenant-domain` headers downstream.
    - For unknown or inactive domains: rewrite or respond with a clean 404 "Tenant Not Found" page to avoid leaking routes or portal structure.

### Task 4: Dynamic Client DB Connection Pool & API Proxy
- **Files**:
  - [`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts)
  - [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts)
  - [`src/lib/__tests__/tenant-pool.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/tenant-pool.test.ts)
- **Details**:
  - Implement [`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts):
    - Maintain an in-memory connection pool registry: `Map<string, { pool: Pool, lastUsed: number }>`.
    - If tenant uses direct PostgreSQL:
      - Decrypt database credentials with `decryptSecret`.
      - Instantiate a `pg.Pool` with serverless bounds (`max: 2`, `idleTimeoutMillis: 300000`).
      - Listen to pool `'connect'` event and enforce `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`.
      - Evict pools idle for > 15 minutes.
  - Update [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts):
    - If tenant uses an on-premise proxy server, proxy queries through the tenant's API server URL using the decrypted API key.

### Task 5: Dynamic White-Label UI Branding & Identity Context
- **Files**:
  - [`src/lib/tenant-context.tsx`](file:///e:/work/pharmaql/src/lib/tenant-context.tsx)
  - [`src/app/layout.tsx`](file:///e:/work/pharmaql/src/app/layout.tsx)
  - [`src/components/ReportHeader.tsx`](file:///e:/work/pharmaql/src/components/ReportHeader.tsx)
  - [`src/app/manifest.ts`](file:///e:/work/pharmaql/src/app/manifest.ts)
- **Details**:
  - Create [`src/lib/tenant-context.tsx`](file:///e:/work/pharmaql/src/lib/tenant-context.tsx):
    - Export `TenantProvider` and `useTenant()` hook exposing tenant identity, white-label details, and portal flags.
  - Update [`src/app/layout.tsx`](file:///e:/work/pharmaql/src/app/layout.tsx):
    - Resolve tenant context server-side from headers and inject into `<TenantProvider>`.
    - Dynamically generate HTML `<title>` (`{pageTitle} | {tenant.shortName}`) and favicon `<link>`.
  - De-hardcode branding:
    - Replace all hardcoded occurrences of "Asmee Pharma" with dynamic tenant naming properties.
    - In [`ReportHeader.tsx`](file:///e:/work/pharmaql/src/components/ReportHeader.tsx), printable invoices, and PDF exports, render tenant logo, address, phone, email, and tax identification dynamically.

### Task 6: Dev Portal Management Suite
- **Files**:
  - [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts)
  - [`src/modules/control-plane/TenantsControlCenter.tsx`](file:///e:/work/pharmaql/src/modules/control-plane/TenantsControlCenter.tsx)
  - [`src/components/dev-control-center.tsx`](file:///e:/work/pharmaql/src/components/dev-control-center.tsx)
  - [`src/modules/control-plane/README.md`](file:///e:/work/pharmaql/src/modules/control-plane/README.md)
- **Details**:
  - Mount tenant management controls when `isDevPortal === true`:
    - Server actions: `listTenantsAction`, `createTenantAction`, `updateTenantAction`, `toggleTenantActiveAction`, `testDbConnectionAction`.
    - Management UI: list registered tenants, configure custom domains, edit white-label details (branding, address, contact, tax/registration details), select connectivity type (direct Postgres vs. on-premise API server), input encrypted credentials, and run live ping connectivity checks.
  - Provide a portable, drop-in integration package and `README.md` for mounting directly into `DevfinityFrontend` (`devfinity.net`).

### Task 7: Verification, Automated Vitest Suite & Build Validation
- **Files**:
  - Vitest test suites (`src/lib/__tests__/*.test.ts`)
  - Integration sanity checks
- **Details**:
  - Run Vitest unit tests verifying AES-256-GCM encryption/decryption, server storage fallback, and pool lifecycle (`pnpm test`).
  - Run type safety validation (`pnpm run typecheck`).
  - Run production build validation (`pnpm run build`).

---

## Verification & Acceptance Criteria
1. **Vitest Unit Tests:** Run `pnpm test` (verify AES-256-GCM encryption/decryption, server storage fallback, and pool lifecycle).
2. **Type Safety:** Run `pnpm run typecheck` (zero TypeScript errors).
3. **Build:** Run `pnpm run build` (Next.js production build succeeds cleanly).
4. **Behavioral Checks:**
   - Navigating to `process.env.DEV_PORTAL_DOMAIN` (`devfinity.net`, `pharmaql.devfinity.net`, or `localhost`) loads the Developer Control Center.
   - Navigating to a registered client domain (e.g., `portal.asmeepharma.com`) loads the application with that client's specific branding, stationery, and read-only data.
   - Navigating to an unmapped domain returns an HTTP 404 page.
   - Dynamic client database transactions are strictly read-only (`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`).
