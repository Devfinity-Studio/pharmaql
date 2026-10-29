# Phase 34: Multi-Tenant Control Plane & Dynamic Client DB Resolution - Research

## Architectural Discovery & Findings

### 1. Root Cause of Vercel State Loss & Storage Architecture
- **Finding**: Every stateful server action (`notices.ts`, `maintenance.ts`, `license.ts`, `feedback.ts`, `runtime-config.ts`, `push-notifications.ts`, `mr_overrides.json`) uses `readServerJson` and `writeServerJson` from `src/lib/server-storage.ts`.
- **The Bug**: On Vercel, `getServerDataDir()` resolves to `os.tmpdir()/pharmaql-data`. Each Vercel serverless function execution environment is ephemeral and isolated. When cold starts occur or different lambdas handle requests, `/tmp` does not persist, causing state to revert to git-bundled JSON files in `data/`.
- **Solution**: Back `readServerJson` and `writeServerJson` with a persistent PostgreSQL key-value / document table (`control_plane_store` with `tenant_id`, `key`, `data JSONB`, `updated_at`) in Neon Serverless Postgres when `CONTROL_PLANE_DATABASE_URL` is present, with automatic fallback to local filesystem when in offline/local dev mode.

### 2. Neon Serverless Postgres Client Integration
- **Package**: `@neondatabase/serverless` (fast HTTP-based SQL queries for serverless edge and Node.js runtimes).
- **Control Plane Queries**: `const sql = neon(process.env.CONTROL_PLANE_DATABASE_URL)` allows lightning-fast, connectionless SQL queries that never exhaust connection limits on Vercel.
- **Dedicated Tables**:
  - `tenants`: Primary tenant registry (`id UUID PRIMARY KEY`, `slug VARCHAR(64) UNIQUE`, `name VARCHAR(255)`, `logo_url TEXT`, `custom_domain VARCHAR(255) UNIQUE`, `db_type VARCHAR(32)`, `db_connection_encrypted TEXT`, `api_server_url TEXT`, `api_server_key_encrypted TEXT`, `is_active BOOLEAN`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`).
  - `control_plane_store`: General tenant-scoped persistent store (`tenant_id VARCHAR(64)`, `key VARCHAR(128)`, `data JSONB`, `updated_at TIMESTAMPTZ`, `PRIMARY KEY (tenant_id, key)`).

### 3. AES-256-GCM Secret Encryption (`src/lib/crypto.ts`)
- **Crypto Subsystem**: Uses Node.js native `crypto` (`createCipheriv`, `createDecipheriv`, `randomBytes`).
- **Algorithm**: `aes-256-gcm`.
- **Key Requirement**: 32-byte key (256-bit) provided via `CONTROL_PLANE_ENCRYPTION_KEY` in hex or base64.
- **Payload Format**: `ivHex:authTagHex:ciphertextHex`.
- **Security Guarantee**: Authenticated encryption ensures ciphertext cannot be tampered with or modified without triggering decryption failure.

### 4. Tenant Resolution Middleware & Caching
- **Resolution Strategy**:
  1. Inspect `request.headers.get("host")`.
  2. If host matches `DEV_PORTAL_DOMAIN`:
     - Allow tenant switching via `x-tenant-slug` header or `?tenant=` query parameter.
     - Set `x-is-dev-portal: "true"`.
  3. If host is a standard custom domain:
     - Query tenant registry where `custom_domain = host` AND `is_active = true`.
  4. In-memory cache with 5-minute TTL:
     - Cache resolved tenant summary `{ id, slug, name, logoUrl, dbType, isActive }`.
     - Invalidate cache when tenants are created or updated via Dev Control Center.
  5. Unknown or inactive domain:
     - Terminate with 404 / "Tenant Not Found" to prevent leaking portal structure or unauthorized access.

### 5. Dynamic Hybrid Client DB Resolution
- **PostgreSQL Pool Management (`src/lib/db/tenant-pool.ts`)**:
  - Maintained pool map: `Map<string, { pool: Pool, lastUsed: number }>`.
  - When a tenant has `db_type === 'postgres'`, decrypt `db_connection_encrypted` and acquire a connection pool using `pg.Pool`.
  - On pool checkout, execute `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` to strictly enforce zero-write safety to the client ERP.
  - Periodic / on-demand sweep evicts pools idle for > 15 minutes (`idleTimeoutMillis: 900000`).
- **On-Premise API Server Proxy**:
  - When `db_type === 'api_server'`, queries route to `tenant.api_server_url` with decrypted `tenant.api_server_key_encrypted` via `api-client.ts`.

### 6. Dynamic White-Label UI Branding
- Extract tenant branding from `x-tenant-name`, `x-tenant-slug`, and `x-tenant-logo` headers populated by middleware or layout loader.
- Inject into `TenantProvider` / server layout components.
- Replace hardcoded "Asmee Pharma" stationery headers, portal titles, and logos with dynamic tenant props.

### 7. Dev Control Center Tenant Management
- Add `"tenants"` tab in `src/components/dev-control-center.tsx`.
- Connect to server actions in `src/server/actions/tenantActions.ts`:
  - List tenants.
  - Create/edit tenant with encrypted secret inputs.
  - Toggle `is_active`.
  - Ping test database connectivity (PostgreSQL handshake or API server `/health` check).
