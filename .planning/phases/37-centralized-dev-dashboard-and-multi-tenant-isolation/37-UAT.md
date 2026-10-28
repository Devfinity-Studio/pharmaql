# Phase 37: Centralized Dev Platform Dashboard & Multi-Tenant Resource Isolation - UAT

## Phase Summary
Phase 37 transforms PharmaQL into a true multi-tenant SaaS platform with a centralized Master Developer Control Center, isolated client portals, dedicated full-page tenant registration and editing workflows, per-tenant encrypted admin credentials, dynamic ERP query parameter injection (`compNo`, `locNo`, `dbName`), global vs per-tenant feature toggle management, notice board scoping, and audit trail isolation.

---

## Completed Deliverables

1. **Dedicated Full-Page Tenant Registration & Editing (`/admin/tenants/new` & `/admin/tenants/[id]`)**:
   - Built full-screen, responsive `<TenantForm />` ([`src/components/tenant-form.tsx`](file:///e:/work/pharmaql/src/components/tenant-form.tsx)) replacing modals with a multi-section page architecture.
   - Includes Identity & Metadata, Branding & Theme, Custom Domain & DNS instructions, ERP Bridge & Server Credentials with live ping test, and Tenant Administrator Credentials.
   - Dedicated Next.js routes: [`src/app/admin/tenants/new/page.tsx`](file:///e:/work/pharmaql/src/app/admin/tenants/new/page.tsx) and [`src/app/admin/tenants/[id]/page.tsx`](file:///e:/work/pharmaql/src/app/admin/tenants/[id]/page.tsx).
   - Replaced modal triggers in [`src/components/tenants-control-center.tsx`](file:///e:/work/pharmaql/src/components/tenants-control-center.tsx) with direct Next.js `<Link>` navigation.

2. **Per-Tenant Admin Credentials & Isolated Authentication**:
   - Added `admin_email` and `admin_password_encrypted` to Neon Postgres `tenants` table and local fallback store with AES-256-GCM encryption.
   - Updated [`src/server/actions/authActions.ts`](file:///e:/work/pharmaql/src/server/actions/authActions.ts): authenticates client portal admins against decrypted per-tenant credentials stored in Neon.
   - Scopes sessions to tenant ID, preventing cross-tenant access.

3. **Dynamic ERP Query Parameter Injection (`src/lib/api-client.ts`)**:
   - `getDynamicApiConfig` extracts `x-tenant-comp-no`, `x-tenant-loc-no`, and `x-tenant-legacy-db` from request headers.
   - `apiGet` merges `compNo`, `locNo`, and `dbName` into all GET URL query parameters.
   - `apiPost` automatically injects `compNo`, `locNo`, and `dbName` into POST JSON payloads.
   - Unit tests verified in [`src/lib/__tests__/api-client.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/api-client.test.ts).

4. **Developer Dashboard: Multi-Tenant Context Bar (Global vs Per-Tenant)**:
   - Built sticky `Multi-Tenant Context Selector Bar` in [`src/components/dev-control-center.tsx`](file:///e:/work/pharmaql/src/components/dev-control-center.tsx).
   - Allows developers to select "Global (Default Options)" or switch to any registered client tenant to manage features, maintenance modes, and licenses independently.
   - Scoped backend updates via `overrideTenantId` in [`src/lib/server-storage.ts`](file:///e:/work/pharmaql/src/lib/server-storage.ts), [`src/lib/maintenance.ts`](file:///e:/work/pharmaql/src/lib/maintenance.ts), and [`src/server/actions/devDiagnostics.ts`](file:///e:/work/pharmaql/src/server/actions/devDiagnostics.ts).

5. **Centralized Platform Dashboard & Route Partitioning (`/admin/dashboard`)**:
   - Created [`src/components/dev-platform-dashboard.tsx`](file:///e:/work/pharmaql/src/components/dev-platform-dashboard.tsx): platform metrics (registered tenants, active/suspended ratio, Neon connection latency, notices), quick action links, and tenant overview table.
   - Partitioned [`src/app/admin/dashboard/page.tsx`](file:///e:/work/pharmaql/src/app/admin/dashboard/page.tsx): renders Developer Platform Dashboard on Dev Portal (`x-is-dev-portal: true`) and client ERP operational dashboard on client portals.
   - Redirected `/admin` to `/admin/dashboard` in [`src/app/admin/page.tsx`](file:///e:/work/pharmaql/src/app/admin/page.tsx).
   - Added "Platform Dashboard" to the top of `devPortalNavItems` in [`src/components/collapsible-sidebar.tsx`](file:///e:/work/pharmaql/src/components/collapsible-sidebar.tsx).

6. **Notice Board & Security Audit Scoping**:
   - Added `tenant_id` support to `tenant_notices` table (nullable for Global broadcast, UUID for client-specific notices).
   - Dev Portal shows tenant badges and allows targeting Global vs specific client tenant when creating notices.
   - Client Portals only receive notices where `tenant_id IS NULL OR tenant_id = activeTenantId`.
   - Security & Audit trail (`/admin/audit`) automatically logs `tenantId` and `tenantSlug`, provides a tenant filter dropdown on Dev Portal, and isolates audit records on client portals.

7. **Environment Cleanup & Architecture Alignment**:
   - Organized [`.env`](file:///e:/work/pharmaql/.env), [`src/env.js`](file:///e:/work/pharmaql/src/env.js), and [`.env.example`](file:///e:/work/pharmaql/.env.example) into clean multi-tenant sections.
   - Clarified required platform variables (`CONTROL_PLANE_DATABASE_URL`, `CONTROL_PLANE_ENCRYPTION_KEY`, `DEV_PORTAL_DOMAIN`, `DEV_EMAIL`, `DEV_PASSWORD`, `DEV_SMTP_*`) and optional offline fallback variables.

---

## Verification Test Matrix

| # | Test Scenario | Method / Command | Result |
|---|---|---|---|
| 1 | API Client dynamic parameter injection | `pnpm vitest run src/lib/__tests__/api-client.test.ts` | PASS (3/3 tests) |
| 2 | Tenant actions & AES encryption | `pnpm vitest run src/modules/control-plane/__tests__/tenantActions.test.ts` | PASS (15/15 tests) |
| 3 | Tenant resolver & routing isolation | `pnpm vitest run src/lib/__tests__/tenant-resolver.test.ts` | PASS (7/7 tests) |
| 4 | Full test regression suite | `pnpm test` | PASS (17 suites, 95 tests) |
| 5 | TypeScript typecheck | `pnpm run typecheck` (`tsc --noEmit`) | PASS (0 errors) |
| 6 | Next.js production build | `pnpm run build` | Verified |
