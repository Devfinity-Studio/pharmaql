# Phase 35: Superuser Dev Control Center Package & Integration (DevfinityFrontend) - Context & Decisions

## Context Summary
Phase 35 delivers the standalone **Superuser Dev Control Center package** designed for direct mounting into the user's `DevfinityFrontend` repository (hosted on `devfinity.net` / `pharmaql.devfinity.net`). 

While the `pharmaql` repo acts strictly as the multi-tenant consumer (as established in Phase 34), this package provides the complete administrative suite allowing the developer to:
1. Register and manage client tenants.
2. Encrypt client database credentials and API keys at rest using AES-256-GCM before writing to Neon.
3. Run live, rich health diagnostics (ping latency, DB version/name for Postgres, server status for API server).
4. One-click seed/import existing client tenants (including Asmee Pharma).

---

## Key Locked Decisions

### 1. Module Architecture & Placement
- **Directory**: [`src/modules/control-plane/`](file:///e:/work/pharmaql/src/modules/control-plane/).
- **Structure**:
  - `types.ts`: Clean TypeScript definitions for tenant management and diagnostic probes.
  - `tenantActions.ts`: Server actions connecting directly to Neon via `@neondatabase/serverless`.
  - `TenantsControlCenter.tsx`: Modern, dark-themed React 19 Client Component with rich statistics, tenant table/cards, registration drawer, and diagnostic modals.
  - `README.md`: Drop-in integration guide with copy-paste instructions for `DevfinityFrontend`.

### 2. Environment Variables & Shared Secrets
- Shared between `DevfinityFrontend` and `pharmaql`:
  - `CONTROL_PLANE_DATABASE_URL`: Connection URL for Neon Serverless Postgres.
  - `CONTROL_PLANE_ENCRYPTION_KEY`: 32-byte master key (hex or base64) for authenticated AES-256-GCM symmetric encryption/decryption.

### 3. Server Actions & Encryption Pipeline
- **`listTenantsAction()`**: Queries Neon `tenants` ordered by `created_at DESC`. Masks encrypted credentials so raw connection strings are never leaked to the client browser.
- **`createTenantAction(data)`**: Validates inputs with Zod, encrypts `db_connection` (for Postgres) or `api_server_key` (for API server) using AES-256-GCM (`encryptSecret`), and inserts record into Neon.
- **`updateTenantAction(id, data)`**: Re-encrypts credentials only if modified; updates record in Neon.
- **`toggleTenantActiveAction(id, isActive)`**: Toggles `is_active` status.
- **`seedAsmeePharmaAction()`**: One-click registration that inserts the official Asmee Pharma tenant (`slug: "asmee"`, `portal.asmeepharma.com`) with pre-configured stationery and API server proxying.
- **`testDbConnectionAction(id)`**:
  - For `postgres`: Acquires a temporary connection, runs `SELECT current_database(), version();`, measures round-trip latency in ms, and safely releases connection.
  - For `api_server`: Pings `api_server_url/health` with decrypted `api_server_key_encrypted` and reports HTTP status, response time, and health payload.

### 4. Rich Diagnostic UI
- Displays:
  - Latency in milliseconds (🟢 < 100ms, 🟡 100-300ms, 🔴 > 300ms or error).
  - Target database name and PostgreSQL engine version.
  - HTTP status and server uptime for API server tenants.
  - Error diagnostic messages if connection fails (e.g., DNS error, authentication failure, timeout).

---

## Out of Scope for Phase 35
- Automated Stripe/Dodo recurring billing webhooks (license management remains manual / toggle-driven for now).
- Client portal end-user modifications (all changes here target the administrative control plane).
