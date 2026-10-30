# Phase 39 Plan: Production Neon Database Persistence & Dynamic Multi-Tenant State Isolation

## Objective

Fix production Neon PostgreSQL writing, eliminate tenant resurrection upon page refresh (prevent hardcoded `santram` and `asmee` from reappearing after deletion), resolve the repeated `duplicate key value violates unique constraint "tenants_slug_key"` schema warning in Vercel runtime logs, decouple static JSON seeding from runtime migrations, and ensure all tenant mutations and resolutions operate directly and reliably against Neon with zero stale fallbacks.

---

## Architectural Guardrails

1. **Edge Runtime Invariant (CRITICAL)**:
   - Next.js Edge Middleware ([`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts)) and [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts) run in Vercel Edge Runtime.
   - ZERO imports of Node.js native modules (`net`, `dns`, `pg`) in middleware or resolver.
   - Database operations in Edge execute purely via native HTTP fetch (`@neondatabase/serverless`).
2. **Neon as Single Source of Truth**:
   - When `CONTROL_PLANE_DATABASE_URL` is set, Neon PostgreSQL is the sole source of truth.
   - Schema initialization must NEVER execute DML `INSERT` statements from static JSON. DDL migrations (`CREATE TABLE`, `ALTER TABLE`) only.
   - If a tenant is deleted in Neon, it must stay deleted and never be resurrected by fallback to `data/tenants.json`.
3. **Fail-Fast in Cloud Environments**:
   - In cloud serverless environments (`process.env.VERCEL`), tenant mutations must fail explicitly if `CONTROL_PLANE_DATABASE_URL` is missing, preventing phantom writes.
4. **Zero Test Regressions**:
   - All 20 existing Vitest suites (104 tests) must pass.
   - New tests must verify that deleted tenants are not resurrected by static fallbacks and that schema initialization runs without unique constraint violations.

---

## Detailed Task Breakdown

### Task 1: Decouple Hardcoded Static Seeding from Schema Initialization
- **Files**:
  - `src/lib/control-plane-db.ts`
- **Implementation**:
  - Remove `import staticTenants from "../../data/tenants.json";`.
  - In `initControlPlaneRelationalSchema()`:
    - Remove the entire step 6 block (lines 188–252) that iterates over `staticTenants` and executes `INSERT INTO tenants ... ON CONFLICT (id) DO UPDATE`.
    - Ensure `initControlPlaneRelationalSchema()` only executes DDL statements:
      1. `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
      2. `CREATE TABLE IF NOT EXISTS tenants (...);`
      3. `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ...;`
      4. `CREATE TABLE IF NOT EXISTS tenant_notices (...);`
      5. `CREATE TABLE IF NOT EXISTS tenant_features (...);`
      6. `CREATE TABLE IF NOT EXISTS tenant_licenses (...);`
      7. `CREATE TABLE IF NOT EXISTS tenant_runtime_config (...);`
    - Verify `schemaInitialized = true` is cleanly set on completion so that subsequent queries in the same process do not re-run DDL.
    - If an error occurs, log it and return `false` without crashing the process.

---

### Task 2: Eliminate Static JSON Fallback in Tenant Resolution When Cloud DB is Active
- **Files**:
  - `src/lib/tenant-resolver.ts`
  - `src/lib/__tests__/tenant-resolver.test.ts`
- **Implementation**:
  - In `src/lib/tenant-resolver.ts`:
    - In `resolveTenantByHost(rawHost, options)`:
      - If `sql` (Neon client) is connected:
        - Query Neon via SQL.
        - If `rows.length === 0`: return `{ tenant: null, isDevPortal: isDev }`.
        - **Do NOT execute** secondary fallback `findStaticTenant(...)`. A tenant that does not exist in Neon must resolve as `null` (triggering branded 404).
      - If `!sql` (offline local development mode without Neon):
        - Call `findStaticTenant(...)` as the offline development fallback.
    - In `invalidateTenantCache(slugOrDomain)`:
      - Ensure cache entries for `slug:${clean}` and `host:${clean}` are purged immediately.
  - Update `src/lib/__tests__/tenant-resolver.test.ts`:
    - Add tests verifying that when `sql` returns empty rows, `resolveTenantByHost` returns `tenant: null` and does not fall back to static JSON.

---

### Task 3: Streamline Tenant Mutations & Eradicate Redundant Local File Mirroring
- **Files**:
  - `src/modules/control-plane/tenantActions.ts`
  - `src/modules/control-plane/__tests__/tenantActions.test.ts`
- **Implementation**:
  - In `src/modules/control-plane/tenantActions.ts`:
    - In `saveTenantAction(input)`:
      - When `sql` is active:
        - Remove `saveLocalTenant` mirroring (lines 447–478 and 555–587). Neon is the sole store; writing to local JSON in serverless causes desynchronization.
        - Handle duplicate slug and duplicate domain errors from PostgreSQL gracefully:
          - If `err.message` contains `tenants_slug_key`, return `{ success: false, error: "A tenant with slug '${cleanSlug}' already exists. Please choose a different slug." }`.
          - If `err.message` contains `tenants_custom_domain_key`, return `{ success: false, error: "Custom domain '${cleanDomain}' is already registered to another tenant." }`.
    - In `deleteTenantAction(tenantId)`:
      - Query `custom_domain` and `slug` before deleting the row:
        ```ts
        const rows = await sql`SELECT custom_domain, slug FROM tenants WHERE id = ${tenantId} LIMIT 1;`;
        ```
      - Execute `DELETE FROM tenants WHERE id = ${tenantId};`.
      - Invalidate cache for both `slug` and `custom_domain`:
        ```ts
        if (slug) invalidateTenantCache(slug);
        if (domain) invalidateTenantCache(domain);
        invalidateTenantCache();
        ```
      - Call `safeRevalidatePath("/admin/tenants")` and `safeRevalidatePath("/admin/dashboard")`.
    - In `toggleTenantStatusAction(tenantId, isActive)`:
      - Query slug and domain to invalidate caches specifically on status toggle.
  - Update `src/modules/control-plane/__tests__/tenantActions.test.ts`:
    - Test that duplicate slug returns a clear error message.
    - Test that deleting a tenant invalidates both slug and domain cache.

---

### Task 4: UI Error Feedback, Cache Invalidation, and Verification
- **Files**:
  - `src/components/tenant-form.tsx`
  - `src/components/tenants-control-center.tsx`
- **Implementation**:
  - In `src/components/tenant-form.tsx`:
    - Ensure `formError` displays the descriptive server error returned by `saveTenantAction` (e.g. duplicate slug or duplicate domain message).
  - In `src/components/tenants-control-center.tsx`:
    - On tenant delete or status toggle, ensure optimistic state update is paired with clean cache invalidation.
- **Verification**:
  - Run full Vitest suite (`pnpm test`).
  - Run TypeScript typecheck (`pnpm typecheck`).
  - Execute live test script against Neon to verify:
    1. Creating a brand new tenant persists to Neon.
    2. Deleting the tenant removes it completely from Neon.
    3. Refreshing/re-querying does NOT resurrect the deleted tenant.
    4. Schema initialization runs with ZERO unique constraint warnings.

---

## Verification Plan

### Automated Tests
1. `pnpm test`: All 20 test suites must pass (104+ tests).
2. `pnpm typecheck`: Zero TypeScript compiler errors (`tsc --noEmit`).

### Live Database & State Verification
1. Run standalone script against `process.env.CONTROL_PLANE_DATABASE_URL`:
   - Initialize schema -> verify zero warnings.
   - Insert new tenant `test-phase39-verify` -> verify row is in Neon.
   - Query tenant via `resolveTenantByHost` -> verify found.
   - Delete tenant `test-phase39-verify` -> verify row is gone from Neon.
   - Re-run schema initialization and tenant resolution -> verify tenant does NOT reappear.
