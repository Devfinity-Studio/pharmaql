# Phase 49 Context: Discussion & Strategy for Adding an ORM Layer

## Overview & Executive Summary
This document formalizes the architectural decisions and implementation boundaries for introducing an ORM / type-safe query builder to PharmaQL. Following in-depth architectural evaluation and discussion with the user, **Drizzle ORM** was selected and scoped exclusively to the **Neon PostgreSQL Control Plane**, while strictly isolating the **ERP Bridge** and preserving the existing **Local File Store fallback**.

Before any code modifications begin, a formal production release (`v1.8.0-stable-prod`) was tagged and published to GitHub.

---

## Locked Decisions & Boundaries

### 1. ORM Candidate Selection: Drizzle ORM
- **Selected Library**: `drizzle-orm` with `drizzle-kit` for CLI schema management and migrations.
- **Why Drizzle over Prisma / Kysely**:
  - **Zero Binary Engine**: Unlike Prisma, Drizzle has zero Rust engine binaries, adding <5 kB to serverless function bundles instead of 15–30 MB.
  - **Serverless & Edge Native**: Native first-class support for `@neondatabase/serverless` over HTTP (`drizzle-orm/neon-http`). Queries are stateless HTTPS requests with sub-10ms cold starts and zero TCP connection pool exhaustion.
  - **Type Inference**: Schema-defined TypeScript types without manual code generation build steps.
  - **Raw SQL Escape Hatch**: `sql` template tag provides seamless raw SQL execution when needed.

### 2. Strict Architectural Scope & Boundaries
- **IN SCOPE: Neon PostgreSQL Control Plane**
  - Tenant records & settings (`tenants`)
  - Superuser / developer admin credentials (`admin_credentials`)
  - Multi-tenant licensing records (`tenant_licenses` / tenant license columns)
  - System notices & broadcasts (`system_notices`)
  - Web Push notification subscriptions (`push_subscriptions`)
  - Live user presence sessions (`user_presence`)
- **OUT OF SCOPE: Technomax ERP Bridge (`api-server/`)**
  - **Strict Prohibition**: No ORM models will be introduced to the ERP database layer.
  - The ERP database relies on proprietary legacy stored procedures (`rptPartyWiseSaleStatement`, `rptStockStatementWithValuation`, `rptMRwisePeriodicalOutstanding`, `rptExpiryStockStatement`) with temporary tables, complex parameter signatures, and ODBC streaming.
  - The ERP bridge remains 100% read-only raw stored procedure execution via `api-server/`.

### 3. Directory Organization
- All Drizzle schemas, connection initialization, and relations must reside cleanly in `src/db/`:
  - `src/db/index.ts`: Database client export (`export const db = drizzle(sql, { schema });`).
  - `src/db/schema/`:
    - `tenants.ts`: Tenants table schema and TypeScript inferred types.
    - `admin-credentials.ts`: Admin/dev credentials table.
    - `licenses.ts`: Tenant license statuses, expiry, grace days, and killswitches.
    - `notices.ts`: System notices with role and tenant scoping.
    - `presence.ts`: Active sessions with tenant tagging.
    - `push-subscriptions.ts`: Web Push subscriptions.
    - `index.ts`: Barrel export of all schemas.
  - `drizzle.config.ts`: Configuration for `drizzle-kit` pointing to `src/db/schema/index.ts` and outputting migrations to `drizzle/`.

### 4. Migration & Schema Synchronization Strategy
- **Dual Migration Workflow**:
  1. **Runtime Lightweight Verification**: Execute a safe, lightweight startup synchronization check on server boot to ensure all required tables and columns exist on Neon.
  2. **Developer & CI/CD CLI**: Provide `drizzle-kit push` and `drizzle-kit generate` scripts in `package.json` for rapid schema development and reproducible migrations.

### 5. Transparent Local Store Fallback
- PharmaQL supports zero-database development and offline testing via `src/lib/local-tenants-store.ts`.
- If `NEON_DATABASE_URL` (or `DATABASE_URL`) is unset, empty, or unreachable, control plane actions must transparently fall back to the local JSON store without crashing or throwing unhandled database connection errors.

---

## Pre-Implementation Release & Verification
- Prior to code changes for Phase 49:
  - Working release **`v1.8.0-stable-prod`** created and published on GitHub.
  - Base tag: `v1.8.0-stable-prod` (commit `81c4ce6`).
  - Current Git working directory: Clean on `dev` branch.
