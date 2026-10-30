# Phase 39 Context: Production Neon Database Persistence & Dynamic Multi-Tenant State Isolation

## Background & Problem Statement

Users reported that on production:
1. **Adding a new tenant wrote nothing to Neon**:
   The Developer Control Center (`/admin/tenants/new`) appeared to succeed or fail silently, and no rows were persisted in the Neon PostgreSQL database.
2. **Deleting tenants did not work**:
   Deleting `santram pharma` or `asmee pharma` and refreshing the page caused both tenants to reappear immediately.
3. **Repeated Server Warnings in Vercel Logs**:
   ```
   [ControlPlaneDB] Schema initialization warning: duplicate key value violates unique constraint "tenants_slug_key"
   ```
   This warning appeared on almost every request (`POST /admin/tenants`, `GET /admin/dashboard`, `GET /admin/mrs`), severely degrading response latency.

## Root Cause Analysis

1. **Hardcoded Static Seeding in Schema Initialization**:
   In `src/lib/control-plane-db.ts`, `initControlPlaneRelationalSchema()` contained a loop iterating over `staticTenants` (`data/tenants.json`) and executing `INSERT INTO tenants ... ON CONFLICT (id) DO UPDATE`.
   - When tenants in Neon had different UUIDs than the hardcoded seeds, `ON CONFLICT (id)` did not trigger, and PostgreSQL rejected the query with a unique constraint violation on `tenants_slug_key`.
   - Because `initControlPlaneRelationalSchema()` caught this error and returned `false`, `schemaInitialized = true` was never set. The initialization failed and re-ran on **every single server action and page request**.
   - Every time `listTenantsAction` was called, it executed `initControlPlaneRelationalSchema()`, which automatically re-inserted `santram` and `asmee` into Neon from `data/tenants.json`, instantly resurrecting them after deletion!

2. **Secondary Static Fallback in Tenant Resolver**:
   In `src/lib/tenant-resolver.ts`, `resolveTenantByHost()` had a secondary fallback:
   ```ts
   if (!tenant) {
       tenant = findStaticTenant(targetSlug, host, strippedHost, rootDomain, firstSubdomain);
   }
   ```
   Even if a tenant was deleted from Neon, the resolver pulled it back from `data/tenants.json` and cached it in memory!

3. **Dual-Mode Mirroring Ambiguity**:
   When Neon was connected, `saveTenantAction` was still attempting to mirror data into `data/tenants.json` on Vercel's ephemeral serverless filesystem, while `deleteTenantAction` only touched Neon. This caused local files to be out-of-sync with the cloud database.

## Architecture Decisions & Scope Boundaries

1. **Neon PostgreSQL is the Sole Source of Truth When Connected**:
   - `initControlPlaneRelationalSchema()` must strictly manage DDL (`CREATE TABLE`, `ALTER TABLE ADD COLUMN`). It must NEVER execute DML `INSERT` statements from static JSON on runtime requests.
   - When `getControlPlaneSql()` is active, `tenant-resolver.ts` must query Neon exclusively. If Neon returns no record, the tenant does not exist. No fallback to `staticTenants`.
2. **Offline Fallback Isolation**:
   - `data/tenants.json` and `findStaticTenant()` are reserved strictly for offline local development when `process.env.CONTROL_PLANE_DATABASE_URL` is omitted and `!process.env.VERCEL`.
   - In cloud serverless environments (`process.env.VERCEL`), mutations must fail explicitly if `CONTROL_PLANE_DATABASE_URL` is missing, preventing phantom writes.
3. **Cookie Hygiene**:
   - Verified that cookies are only used for user authentication sessions (`pharmaql_session`) and MR impersonation (`pharmaql_impersonate`). No tenant state is stored in cookies.
4. **Cache Invalidation Guarantee**:
   - Every tenant mutation (`saveTenantAction`, `deleteTenantAction`, `toggleTenantStatusAction`) must invalidate the memory cache for both the tenant slug and custom domain, and trigger Next.js path revalidation for `/admin/tenants` and `/admin/dashboard`.
