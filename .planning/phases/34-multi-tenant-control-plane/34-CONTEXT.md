# Phase 34: Multi-Tenant Control Plane & Dynamic Client DB Resolution - Context & Decisions

## Context Summary
PharmaQL is transitioning from a single-tenant on-premise model into a multi-tenant cloud control plane. The control plane runs on Vercel backed by Neon Serverless Postgres (`@neondatabase/serverless`) for metadata, tenant routing, and state persistence. This permanently resolves the Vercel serverless `/tmp` ephemeral storage bug (where notices, feature toggles, and subscriptions were wiped on instance cold starts or logouts).

The Dev Portal is isolated to the developer's private domain (`DEV_PORTAL_DOMAIN`) where tenants are registered and managed securely without public exposure.

---

## Key Locked Decisions

### 1. Control Plane Architecture (Neon Serverless Postgres)
- **Database Engine**: Neon Serverless Postgres (`@neondatabase/serverless`).
- **Connection Environment Variable**: `CONTROL_PLANE_DATABASE_URL`.
- **Database Tables Managed**:
  - `tenants`: Primary tenant registry containing `id`, `slug`, `name`, `logo_url`, `custom_domain`, `db_type` (`postgres` | `api_server`), `db_connection_encrypted`, `api_server_url`, `api_server_key_encrypted`, `is_active`, `created_at`, `updated_at`.
  - `tenant_notices`: Replaces ephemeral `data/notices.json`, scoped by `tenant_id`.
  - `tenant_features`: Replaces ephemeral `data/maintenance.json` (feature toggles and maintenance mode), scoped by `tenant_id`.
  - `tenant_licenses`: Replaces ephemeral `data/license.json` (subscription status, expiration, killswitch), scoped by `tenant_id`.
  - `tenant_feedback`: Replaces ephemeral `data/feedback_reports.json`, scoped by `tenant_id`.
  - `tenant_runtime_config`: Replaces ephemeral `data/runtime-config.json`, scoped by `tenant_id`.

### 2. Secret Encryption (`src/lib/crypto.ts`)
- **Algorithm**: AES-256-GCM authenticated symmetric encryption.
- **Master Key**: `CONTROL_PLANE_ENCRYPTION_KEY` (32-byte hexadecimal or base64 key).
- **Scope**: All client database passwords, full connection URIs, and API server secret keys stored in `tenants` are encrypted at rest with random IV and authentication tag (`iv:authTag:encryptedData`).

### 3. Tenant Resolution & Routing Middleware
- **Domain Matching**: Incoming `Host` header matched against `tenants.custom_domain`.
- **Developer Portal Domain**: Requests on `process.env.DEV_PORTAL_DOMAIN` (`devfinity.net`, `pharmaql.devfinity.net`, or `localhost`) set `isDevPortal: true` and allow tenant switching via `x-tenant-slug` header or `?tenant=` query parameter.
- **Edge Middleware Safety**: Strictly zero `pg` or Node.js native `net` imports in middleware. Queries run via `@neondatabase/serverless` over HTTP (`neon(process.env.CONTROL_PLANE_DATABASE_URL)`).
- **Unmapped / Unknown Domains**: Returns a clean HTTP 404 / "Tenant Not Found" page to avoid leaking routes or portal structure.
- **Caching**: Multi-layer caching combines an in-memory TTL map (5 minutes) with Next.js `unstable_cache` tagged with `tenant-lookup`. Cache is invalidated via `revalidateTag` upon tenant updates.

### 4. Hybrid Client Database Resolution Model
- **Direct PostgreSQL Connection Pools**:
  - For cloud/accessible PostgreSQL client databases, `tenant-pool.ts` instantiates connection pools keyed by `tenant.id`.
  - Configures serverless pool bounds: `max: 2` per lambda container and `idleTimeoutMillis: 300000` (5 min).
  - Enforces `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` on `'connect'` event to guarantee 100% ERP read-only safety.
  - Automatically evicts idle pools after 15 minutes of inactivity to prevent connection exhaustion.
- **On-Premise API Server (.exe) Proxying**:
  - For client ERPs residing behind corporate firewalls (such as Windows MySQL servers running `api-server.exe` managed by NSSM), the app routes requests to the tenant's configured `api_server_url` using decrypted `api_server_key_encrypted`.

### 5. Dynamic UI Branding & Identity Context
- Hardcoded logos, titles, and portal headers (formerly hardcoded to "Asmee Pharma") are abstracted into dynamic tenant branding.
- A central `useTenant()` context / server-side tenant resolver provides `name`, `logo_url`, `slug`, and styling tokens to:
  - Root layout and navigation headers.
  - Printable reports (Stock, Sales, Product Wise, Free Scheme, Overdue) stationery headers.
  - Page titles, metadata, and mobile PWA manifests.

### 6. Developer Control Center (Hosted in DevfinityFrontend)
- The developer control plane is completely decoupled from the tenant-facing `pharmaql` app.
- Instead of exposing superuser management inside client builds, the Dev Control Center is integrated directly as a dedicated module inside the user's existing `DevfinityFrontend` repo, hosted on `dev.yourdomain.com` (or developer subdomain).
- `DevfinityFrontend` and `pharmaql` share:
  - `CONTROL_PLANE_DATABASE_URL` (Neon Serverless Postgres)
  - `CONTROL_PLANE_ENCRYPTION_KEY` (AES-256-GCM master key)
- A standalone exportable module (`packages/control-plane` or `src/modules/dev-control-center/`) with all server actions, UI components, and Neon client schemas will be generated so it can be dropped directly into `DevfinityFrontend`.

### 7. Initial State & Onboarding
- **Blank Slate**: Starts with empty `tenants` table.
- Developer logs into their Dev Control Center in `DevfinityFrontend` on `dev.yourdomain.com` to configure tenants.
- Tenant portal (`pharmaql`) checks incoming `Host` against Neon `tenants.custom_domain`. Unknown domains receive a clean 404 / "Tenant Not Found".
- Existing JSON files serve as seed templates or local development fallbacks when `CONTROL_PLANE_DATABASE_URL` is not configured.

---

## Out of Scope for Phase 34
- Kinde Auth integration (Better Auth / JWT authentication remains active and unchanged).
- Automated customer billing/invoicing (handled manually or via existing license toggles).
- Client write-back to ERP (remains strictly 100% read-only).
