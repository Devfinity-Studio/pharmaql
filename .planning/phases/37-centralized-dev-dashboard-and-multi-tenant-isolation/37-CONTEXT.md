# Phase 37: Centralized Dev Platform Dashboard & Multi-Tenant Resource Isolation - Context

## 1. Goal
Properly centralize the Dev Portal dashboard and ensure all developer and administrative tools are fully multi-tenant aware, eliminating hardcoded single-tenant assumptions across dashboards, notices, audit logging, and developer panels.

## 2. Key Scope & Objectives
1. **Centralized Platform Dashboard (`/admin/dashboard`)**:
   - Dev Portal hosts (`pharmaql.devfinity.net` / `localhost:3000` in Dev Portal mode):
     - Renders a master platform operations dashboard for superusers/developers.
     - Telemetry cards: Total registered tenants, Active vs Suspended counts, Neon Control Plane latency/status, Total MRs across all tenants, and System Health.
     - Quick Navigation shortcuts: Onboard Tenant, Global Broadcast Notice, Security & Audit, Developer Telemetry.
   - Client Portal hosts (`portal.asmeepharma.com`):
     - Renders client ERP dashboard querying only that client's specific Technomax database.
2. **Multi-Tenant Scoping for Developer Panel (`/admin/dev`)**:
   - Add a global Tenant Selector dropdown on `/admin/dev` so developers can inspect and toggle licenses, feature flags, maintenance mode, and runtime configuration per tenant.
   - Clean up hardcoded metadata title (`Developer Control Center | PharmaQL | Asmee Pharma` -> `Developer Control Center | Devfinity`).
3. **Multi-Tenant Notice Board (`/admin/notices`)**:
   - Enable developers on the Dev Portal to broadcast notices either globally ("All Tenants") or target specific client organizations (`tenant_id`).
   - Store notice records in `tenant_notices` table in Neon Postgres with `tenant_id` (NULL for global broadcast).
4. **Multi-Tenant Audit Logging & Route Partitioning**:
   - Ensure `/admin/audit` supports filtering by tenant.
   - Update `src/app/admin/page.tsx` to route to `/admin/dashboard` on client portals and `/admin/tenants` (or dev dashboard) on Dev Portal.
   - Update sidebar navigation to cleanly expose the centralized dashboard on Dev Portal.

## 3. Success Criteria
- Dev Portal `/admin/dashboard` renders platform-wide analytics without single-client ERP dependency.
- Developers can switch tenants on `/admin/dev` to inspect and manage tenant-specific configs.
- Notices can be published globally or scoped to a specific tenant.
- All Vitest suites pass (16+ suites, 92+ tests).
- TypeScript typecheck (`tsc --noEmit`) passes with 0 errors.
- Clean Next.js production build (`next build`).
