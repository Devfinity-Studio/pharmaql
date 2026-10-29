# Phase 35 UAT & Verification Report: Monolithic Dev Control Center & Superuser Admin Portal

## Executive Summary
Phase 35 successfully integrates the Superuser Dev Control Center directly into the monolithic PharmaQL application, serving two distinct architectural experiences based on incoming domain names:
1. **Dev Portal (`pharmaql.devfinity.net` / `DEV_PORTAL_DOMAIN` / `localhost` in dev mode):** Root (`/`) and administrative routes serve the Superuser Dev Control Center where administrators register client organizations, manage white-label branding, encrypt database secrets, and run live connectivity benchmarks.
2. **Client Portals (e.g., `portal.asmeepharma.com`):** Direct traffic to the white-labeled PharmaQL ERP consumer UI, strictly isolating client domains from accessing `/admin` or Dev Portal control pages.

---

## Architectural Guardrails Verified

| Guardrail | Status | Verification Detail |
| :--- | :---: | :--- |
| **Edge Runtime Safety** | **PASS** | [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts) imports only Edge-safe HTTP fetch logic via `@neondatabase/serverless`. ZERO imports of native Node modules (`net`, `tls`) or `pg` or `tenant-pool.ts` in middleware. |
| **Node.js DB Driver Isolation** | **PASS** | `pg` is strictly isolated to Node.js Server Actions (`src/modules/control-plane/tenantActions.ts`) and server connection pool (`src/lib/db/tenant-pool.ts`). |
| **Encrypted Secrets (AES-256-GCM)** | **PASS** | Database connection strings and API keys are encrypted via [`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts) before persisting in Neon. Secret strings are masked in API projections (`has_db_connection`, `has_api_key`). |
| **Client Ingress Route Partitioning** | **PASS** | Non-dev-portal domains attempting to access `/admin/*` are intercepted by Edge middleware and rewritten to `/tenant-not-found` (404). Dev Portal root (`/`) redirects directly to `/admin/tenants`. |
| **Relational State Schema** | **PASS** | Data persists in normalized relational tables in Neon (`tenants`, `tenant_notices`, `tenant_features`, `tenant_licenses`, `tenant_runtime_config`). |

---

## Automated Verification Results

### 1. Vitest Test Suites
- **Command:** `pnpm test`
- **Result:** **13 passed, 66/66 tests passed** (100% pass rate).
- **Key Test Coverage:**
  - `src/modules/control-plane/__tests__/tenantActions.test.ts`:
    - Slug & display name validation
    - AES-256-GCM encryption of database URI and API keys on save
    - Safe credential projection (masking raw credentials)
    - Active status toggling
    - Live database ping diagnostics & error handling
  - `src/lib/__tests__/tenant-resolver.test.ts`: Edge-safe host resolution & TTL caching
  - `src/lib/__tests__/crypto.test.ts`: Authenticated encryption/decryption roundtrip
  - `src/lib/__tests__/server-storage.test.ts`: Relational Neon table mapping

### 2. TypeScript Typecheck
- **Command:** `pnpm run typecheck`
- **Result:** **0 errors**.

### 3. Next.js Production Build
- **Command:** `pnpm run build`
- **Result:** **17/17 routes compiled successfully**:
  - `ƒ /admin` (redirects to `/admin/tenants`)
  - `ƒ /admin/tenants` (Dev Control Center dashboard)
  - `ƒ Middleware` (77.3 kB Edge bundle)

---

## Deliverables Summary

1. **Edge Middleware Ingress Isolation:**
   - Updated [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts) to restrict `/admin` routes strictly to `isDevPortal` requests and redirect root (`/`) to `/admin/tenants`.
2. **Control Plane Server Actions:**
   - Created [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts) with `listTenantsAction`, `saveTenantAction`, `toggleTenantStatusAction`, `deleteTenantAction`, and `testDbConnectionAction`.
3. **Superuser Dev Control Center UI:**
   - Built [`src/components/tenants-control-center.tsx`](file:///e:/work/pharmaql/src/components/tenants-control-center.tsx) with metric summary cards, real-time search & status filtering, status toggling, and live latency diagnostics.
   - Built [`src/components/tenant-modal.tsx`](file:///e:/work/pharmaql/src/components/tenant-modal.tsx) featuring multi-tab configuration and inline "Test Connection" diagnostics.
   - Built [`src/app/admin/tenants/page.tsx`](file:///e:/work/pharmaql/src/app/admin/tenants/page.tsx) and [`src/app/admin/page.tsx`](file:///e:/work/pharmaql/src/app/admin/page.tsx).
   - Integrated "Tenant Control" into [`src/components/collapsible-sidebar.tsx`](file:///e:/work/pharmaql/src/components/collapsible-sidebar.tsx).
