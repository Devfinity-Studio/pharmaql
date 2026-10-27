# Phase 35 Plan: Superuser Dev Control Center Package & Integration (DevfinityFrontend)

## Objective
Build and package the complete **Superuser Dev Control Center** in [`src/modules/control-plane/`](file:///e:/work/pharmaql/src/modules/control-plane/) designed for direct mounting into the user's `DevfinityFrontend` repository (hosted on `devfinity.net` / `pharmaql.devfinity.net`). 

This package enables the developer to:
1. Register and manage client tenants with Zod validation.
2. Symmetrically encrypt client database credentials and API keys at rest using AES-256-GCM (`CONTROL_PLANE_ENCRYPTION_KEY`) before saving to Neon.
3. Perform rich, live connectivity ping tests (measuring round-trip latency in ms, database name/engine version for PostgreSQL, or server health status for API servers).
4. One-click seed/import existing client tenants (including Asmee Pharma).
5. Provide a plug-and-play mounting guide (`README.md`) for seamless integration into `DevfinityFrontend`.

---

## Tasks

### Task 1: Control Plane Types & Server Actions
- **Files**:
  - [`src/modules/control-plane/types.ts`](file:///e:/work/pharmaql/src/modules/control-plane/types.ts)
  - [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts)
  - [`src/modules/control-plane/__tests__/tenantActions.test.ts`](file:///e:/work/pharmaql/src/modules/control-plane/__tests__/tenantActions.test.ts)
- **Description**:
  - Create `types.ts` defining:
    - `TenantRecord`, `TenantMaskedRecord`, `CreateTenantInput`, `UpdateTenantInput`, `DbPingResult`.
  - Create `tenantActions.ts`:
    - `listTenantsAction()`: Queries Neon `tenants`, masks sensitive credentials (`postgresql://***@***` or `sk_live_***`), and returns the tenant list.
    - `createTenantAction(data)`: Validates input with Zod, encrypts client credentials using AES-256-GCM (`encryptSecret`), and inserts the record into Neon.
    - `updateTenantAction(id, data)`: Updates tenant metadata and re-encrypts credentials only if a new credential is provided.
    - `toggleTenantActiveAction(id, isActive)`: Toggles tenant active status in Neon.
    - `seedAsmeePharmaAction()`: Idempotently seeds the official Asmee Pharma tenant (`slug: "asmee"`, `portal.asmeepharma.com`) with complete stationery details and API proxy configuration.
    - `testDbConnectionAction(id)`: Runs a live connectivity probe:
      - For `postgres`: Acquires a temporary connection, runs `SELECT current_database(), version();` with a 5s timeout, and reports latency (ms), database name, and engine version.
      - For `api_server`: Pings `api_server_url/health` with the decrypted API key and reports HTTP status, response time, and payload.
  - Create Vitest test suite in `tenantActions.test.ts` validating action logic, encryption, masking, and validation schemas.

### Task 2: Superuser Management UI (`TenantsControlCenter.tsx`)
- **Files**:
  - [`src/modules/control-plane/TenantsControlCenter.tsx`](file:///e:/work/pharmaql/src/modules/control-plane/TenantsControlCenter.tsx)
- **Description**:
  - Build modern dark-theme React 19 Client Component matching Devfinity's sleek design aesthetics:
    - **Header & Metric Cards**: Total tenants count, active tenants, direct Postgres vs. API server distribution, and system connection health.
    - **Toolbar**: Search by tenant name/slug/domain, filter by active/inactive, "Seed Asmee Pharma" one-click button, and "Register Tenant" button.
    - **Tenant Grid / Table**:
      - Custom domain pill, slug badge, logo preview, display name.
      - Connectivity type badge (`PostgreSQL` / `On-Premise API Server`).
      - Live connection ping indicator (🟢 Live / 🟡 Degraded / 🔴 Error).
      - Active toggle switch and "Edit" button.
    - **Registration & Edit Modal / Drawer**:
      - Form fields for Display Name, Short Name, Slug, Logo URL, Custom Domain.
      - Stationery fields: Address, Phone, Email, GSTIN.
      - Dynamic connectivity fields based on DB Type (`postgres` connection string vs. `api_server` URL and key).
    - **Live Diagnostic Modal**:
      - Displays latency in ms, database name, engine version, or API server payload with clear error diagnostics if unreachable.

### Task 3: Portable Integration Package & Mounting Documentation
- **Files**:
  - [`src/modules/control-plane/index.ts`](file:///e:/work/pharmaql/src/modules/control-plane/index.ts)
  - [`src/modules/control-plane/README.md`](file:///e:/work/pharmaql/src/modules/control-plane/README.md)
- **Description**:
  - Export all actions, types, and the main `TenantsControlCenter` component from `index.ts`.
  - Write a comprehensive `README.md` guide explaining:
    - How to copy/mount the module into `DevfinityFrontend` (`src/app/dev/pharmaql/page.tsx` or similar route).
    - Required environment variables: `CONTROL_PLANE_DATABASE_URL` and `CONTROL_PLANE_ENCRYPTION_KEY`.
    - Dependencies required in `DevfinityFrontend` (`@neondatabase/serverless`, `pg`, `lucide-react`, `zod`).

### Task 4: Verification, Automated Vitest Suite & Build Validation
- **Files**:
  - Vitest test suites (`src/modules/control-plane/__tests__/*.test.ts`)
- **Description**:
  - Run all Vitest unit tests verifying tenant actions, secret encryption, and masking (`pnpm test`).
  - Run TypeScript verification (`pnpm run typecheck`).
  - Run Next.js production build (`pnpm run build`).

---

## Success Criteria
- [ ] Complete portable control plane module implemented in `src/modules/control-plane/`.
- [ ] Server actions handle tenant CRUD, AES-256-GCM encryption, and secret masking.
- [ ] `seedAsmeePharmaAction()` allows one-click seeding of the existing Asmee Pharma tenant into Neon.
- [ ] `testDbConnectionAction()` performs live latency and health diagnostics for both Postgres and API server tenants.
- [ ] `TenantsControlCenter.tsx` delivers a rich, dark-themed UI with metric cards, tenant management, and diagnostic modals.
- [ ] `README.md` provides clear drop-in mounting instructions for `DevfinityFrontend`.
- [ ] All Vitest unit tests pass and `next build` compiles cleanly.
