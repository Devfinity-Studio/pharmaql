# Phase 49: Drizzle ORM Layer Implementation Plan

## Goal
Integrate **Drizzle ORM** (`drizzle-orm` and `drizzle-kit`) for the Neon PostgreSQL Control Plane in PharmaQL, establishing compile-time type safety, declarative schemas in `src/db/`, and automated runtime schema checks, while leaving the Technomax ERP bridge untouched and preserving zero-downtime local JSON fallbacks.

## Execution Waves

### Wave 1: Package Installation & Configuration
- **Plan 49.1: Install Drizzle ORM and Configure Drizzle Kit**
  - Install `drizzle-orm` and `drizzle-kit` as production / development dependencies.
  - Create `drizzle.config.ts` configuring schema paths (`src/db/schema/index.ts`), PostgreSQL dialect, and migration output directory (`drizzle/`).
  - Add `db:generate` and `db:push` scripts in `package.json`.

### Wave 2: Schema Definitions & Database Client
- **Plan 49.2: Schema Definitions in `src/db/schema/`**
  - Create `src/db/schema/tenants.ts`: `tenants` table with all fields (`id`, `name`, `slug`, `domain`, `license_status`, `license_expires_at`, `license_grace_days`, `is_license_blocked`, etc.).
  - Create `src/db/schema/admin-credentials.ts`: `admin_credentials` table with secure hashes, salt, role.
  - Create `src/db/schema/notices.ts`: `system_notices` table with role and tenant scoping.
  - Create `src/db/schema/presence.ts`: `user_presence` table with tenant metadata.
  - Create `src/db/schema/push-subscriptions.ts`: `push_subscriptions` table with tenant ID tagging.
  - Create `src/db/schema/index.ts`: Unified barrel export of all tables and relations.
- **Plan 49.3: Drizzle Neon Client & Startup Schema Initialization**
  - Create `src/db/index.ts`: Initialize `drizzle-orm/neon-http` database client using `@neondatabase/serverless` connection.
  - Create `src/db/init.ts`: Implement safe, lightweight startup synchronization that ensures tables exist on Neon upon boot without crashing if offline or if `NEON_DATABASE_URL` is omitted.

### Wave 3: Integration with Control Plane Actions & Store Fallback
- **Plan 49.4: Refactor `control-plane-db.ts` to use Drizzle Client**
  - Refactor `src/lib/control-plane-db.ts` queries to use typed Drizzle queries (`db.select()`, `db.insert()`, `db.update()`) while retaining fallback to `local-tenants-store.ts`.
  - Ensure compatibility with `tenantActions.ts`, `licenseActions.ts`, `presenceActions.ts`, `notices.ts`, and `pushActions.ts`.

### Wave 4: Verification, UAT & Promotion
- **Plan 49.5: Automated Verification & Production Build**
  - Run `pnpm exec tsc --noEmit` to verify complete type safety.
  - Run `pnpm test` across all 25 test suites.
  - Run `pnpm build` (`next build`) to ensure Next.js production build succeeds.
- **Plan 49.6: Documentation & 3-Stage Promotion**
  - Create `49-UAT.md`.
  - Update `ROADMAP.md` and `STATE.md` marking Phase 49 as completed.
  - Execute 3-stage promotion workflow (`dev` -> `prod` -> `deploymment`).
