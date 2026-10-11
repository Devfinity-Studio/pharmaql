# Phase 13: Cleanup, Performance & Loading Speed Optimization - Context

## Objective
Thoroughly clean up remaining dead legacy artifacts, eliminate unused dependencies, and drastically improve data fetching and page rendering speeds across the application.

## Core Directives
1. **Dead Artifact & Code Pruning:**
   - Remove unused Postgres/Drizzle code files (`src/server/db/schema.ts`, `src/server/db/index.ts`, `drizzle.config.ts`).
   - Remove obsolete packages (`@neondatabase/serverless`, `postgres`, `drizzle-orm` if unused, `@auth/drizzle-adapter`).
   - Clean up unused routes/scripts that were designed for old Neon DB migrations.

2. **Database Pooling & Concurrency Optimization:**
   - Optimize MySQL pool configurations (`connectionLimit`, `idleTimeout`, keep-alive, query timeouts).
   - Ensure connections are properly released back to the pool immediately after execution.

3. **Master Data & Procedure Caching (Speedup):**
   - Implement fast memory caching (e.g., 5-minute to 1-hour TTL) for invariant master tables:
     - Marketing Companies & Divisions (`m_mktcompany`, `l_mktcompany`).
     - Customer blocking flags map (`m_customer`).
     - Item catalog metadata (`m_item`).
   - Cache expensive dashboard overview metrics so reloads don't re-run multiple heavy stored procedures synchronously on every page refresh.

4. **UI Performance & Instant Perceived Loading:**
   - Implement React Suspense boundaries with skeleton loaders for dashboard tabs (Overview, Stock & Sales, Party, Overdue, Product).
   - Tab switching should feel instantaneous using React `useTransition`.
