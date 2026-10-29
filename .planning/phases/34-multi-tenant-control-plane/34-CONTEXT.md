# Phase 34: PharmaQL Client Multi-Tenant Consumption & Edge-Safe Routing - Context & Decisions

## Context Summary
PharmaQL is refactored into a **multi-tenant client consumer** backed by Neon Postgres (`@neondatabase/serverless`). 
This repository acts **strictly as the consumer application**. The Developer Control Panel UI lives in a completely separate repository (`DevfinityFrontend`). 

This application dynamically resolves tenants via custom domains, applies dynamic white-label branding across layout and reports, and connects to client-specific read-only databases or on-premise API servers using a strictly relational state schema in Neon Postgres.

---

## Strict Architectural Guardrails

1. **Decoupled Admin UI**:
   - Do NOT create tenant registration forms, tenant management actions, or a Dev Control Center UI in this repository.
   - All tenant onboarding, credential encryption, and management happens externally in `DevfinityFrontend`.
2. **Relational State Schema (No Generic KV Stores)**:
   - State persistence uses normalized relational tables strictly scoped by `tenant_id`:
     - `tenants` (`id UUID PRIMARY KEY`, `slug`, `custom_domain`, `is_active`, `display_name`, `short_name`, `logo_url`, `address`, `contact_phone`, `contact_email`, `gstin`, `db_type`, `db_connection_encrypted`, `api_server_url`, `api_server_key_encrypted`)
     - `tenant_notices` (`id UUID`, `tenant_id UUID REFERENCES tenants(id)`, `title`, `content`, `is_active`, `created_at`)
     - `tenant_features` (`tenant_id UUID REFERENCES tenants(id)`, `maintenance_mode BOOLEAN`, `feature_flags JSONB`, `PRIMARY KEY(tenant_id)`)
     - `tenant_licenses` (`tenant_id UUID REFERENCES tenants(id)`, `status`, `expires_at`, `plan_type`, `PRIMARY KEY(tenant_id)`)
     - `tenant_runtime_config` (`tenant_id UUID REFERENCES tenants(id)`, `settings JSONB`, `PRIMARY KEY(tenant_id)`)
   - Replaces ephemeral Vercel `/tmp` storage bug without using an un-typed generic KV store.
3. **Edge Runtime Safety (CRITICAL)**:
   - Next.js Middleware runs on the Edge.
   - NEVER import `pg`, `net`, or `src/lib/db/tenant-pool.ts` into `src/middleware.ts` or any file it imports.
   - Middleware strictly uses `@neondatabase/serverless` (HTTP fetch) for tenant lookups.
   - `src/lib/tenant-resolver.ts` must be 100% Edge-compatible (no Node.js native modules).
4. **No Kinde Auth**:
   - Retain the existing Better Auth / session authentication system.
   - Do NOT install, import, or assume Kinde Auth.
5. **Read-Only Safety**:
   - All dynamic client `pg.Pool` connections must execute `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` upon checkout.
6. **Serverless Connection Bounds**:
   - Dynamic client `pg.Pool` instances are bounded to `max: 2` per container (`idleTimeoutMillis: 300000`).
   - Evict pools idle for > 15 minutes.
7. **Offline Dev Fallback**:
   - If `CONTROL_PLANE_DATABASE_URL` is omitted, fallback cleanly to local `.env` and disk JSON storage (`data/`) without throwing runtime errors.
