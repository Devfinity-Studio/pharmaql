# Neon (Postgres) Database Audit Report

**Date:** 2026-10-11  
**Objective:** Identify every location where the Neon / Postgres database (`@/server/db`) is still in use, categorize dependencies, and provide a migration roadmap to eliminate Neon entirely in favor of MySQL.

---

## Executive Summary

The project originally ran on Postgres (Neon) using Drizzle ORM, with Technomax CSV / SQL dumps ingested into Postgres tables (`sales`, `invoices`, `outstanding`, `products`, `mrInventory`). 

Recently, the core MR reports were switched to direct MySQL stored procedures (`pdyasvtrans` and `pdyasvmaster`), making the ingested Postgres reporting tables redundant. However, **Neon Postgres is still actively used in 4 major areas**:

| Category | Postgres Tables / Features | Current Role | Migration Strategy to MySQL |
|---|---|---|---|
| **1. Authentication & Sessions** | `user`, `session`, `account`, `verification` | Better Auth user login, session tokens, permissions | Migrate Better Auth adapter to MySQL (`mysql2` or MySQL Drizzle) |
| **2. Admin Portal & Metadata** | `mrManufacturers`, `notices` | MR-to-Division assignments, Admin broadcast notices | Move `mrManufacturers` & `notices` to MySQL tables or resolve directly from `l_mktcompany_mr` |
| **3. Report Export API Endpoints** | `sales`, `outstanding`, `mrInventory` | Generates Excel/CSV downloads for Stock, Sales, Outstanding | Re-route exports to call the live MySQL stored procedures |
| **4. Redundant Ingestion & Reporting Tables** | `products`, `companies`, `sales`, `invoices`, `outstanding`, `mrInventory` | Fallback data when procedures are uncalled | Remove entirely; all 5 reports now run on live stored procedures |

---

## Detailed File-by-File Breakdown

### 1. Authentication & Session Management
- **[`src/server/db/schema.ts`](file:///e:/work/pharmaql/src/server/db/schema.ts)**
  - Defines `user`, `session`, `account`, `verification` with `pgTable`.
- **[`src/server/auth.ts`](file:///e:/work/pharmaql/src/server/auth.ts)**
  - Initializes Better Auth using `drizzleAdapter(db, { provider: "pg" })`.
- **[`src/server/db/index.ts`](file:///e:/work/pharmaql/src/server/db/index.ts)**
  - Connects to `env.DATABASE_URL` via `postgres.js` and Drizzle.

### 2. Export API Endpoints (Still Querying Postgres!)
- **[`src/app/api/reports/download-stock/route.ts`](file:///e:/work/pharmaql/src/app/api/reports/download-stock/route.ts)**
  - Queries `mrInventory` and `products` from `db`. Needs to use `getStockMovement` (`rptStockMovementStatement`).
- **[`src/app/api/reports/download-sales/route.ts`](file:///e:/work/pharmaql/src/app/api/reports/download-sales/route.ts)**
  - Queries `sales` and `products` from `db`. Needs to use `getItemCustomerSale` (`rptItemCustomerSale`).
- **[`src/app/api/reports/download-outstanding/route.ts`](file:///e:/work/pharmaql/src/app/api/reports/download-outstanding/route.ts)**
  - Queries `outstanding` from `db`. Needs to use `getMRwisePeriodicalOutstanding` (`rptMRwisePeriodicalOutstanding`).
- **[`src/app/api/reports/download/route.ts`](file:///e:/work/pharmaql/src/app/api/reports/download/route.ts)**
  - Master export router querying Postgres `sales`, `outstanding`, `mrInventory`.

### 3. Server Actions & Admin Pages
- **[`src/server/actions/mrs.ts`](file:///e:/work/pharmaql/src/server/actions/mrs.ts)**
  - Creates, updates, and deletes `user` and `mrManufacturers` in Neon.
- **[`src/server/actions/notices.ts`](file:///e:/work/pharmaql/src/server/actions/notices.ts)**
  - CRUD operations on `notices` table in Neon.
- **[`src/server/actions/companies.ts`](file:///e:/work/pharmaql/src/server/actions/companies.ts)**
  - Queries distinct manufacturers from Postgres `products` table.
- **[`src/server/actions/ingest.ts`](file:///e:/work/pharmaql/src/server/actions/ingest.ts)**
  - CSV/SQL ingestion parser inserting rows into Neon Postgres tables.
- **[`src/app/admin/dashboard/page.tsx`](file:///e:/work/pharmaql/src/app/admin/dashboard/page.tsx)**
  - Aggregates stats from Neon `sales`, `products`, `user`.
- **[`src/app/admin/mrs/page.tsx`](file:///e:/work/pharmaql/src/app/admin/mrs/page.tsx)**
  - Lists MR accounts from Neon `user`.
- **[`src/app/admin/companies/page.tsx`](file:///e:/work/pharmaql/src/app/admin/companies/page.tsx)**
  - Lists companies from Neon `companies` and `products`.
- **[`src/app/admin/notices/page.tsx`](file:///e:/work/pharmaql/src/app/admin/notices/page.tsx)**
  - Lists and manages broadcast notices in Neon `notices`.

### 4. Components with Fallbacks to Neon
- **[`src/components/mr-dashboard-content.tsx`](file:///e:/work/pharmaql/src/components/mr-dashboard-content.tsx)**:
  - Overview metric cards query `sales`, `invoices`, `outstanding` (all 0 rows).
  - Division assignment mapping reads `mrManufacturers`.
- **[`src/components/stock-report-view.tsx`](file:///e:/work/pharmaql/src/components/stock-report-view.tsx)**:
  - Reads `mrManufacturers` for assignment checks.
- **[`src/components/product-report-view.tsx`](file:///e:/work/pharmaql/src/components/product-report-view.tsx)**:
  - Fallback view queries `products` and `sales`.
- **[`src/components/party-report-view.tsx`](file:///e:/work/pharmaql/src/components/party-report-view.tsx)**:
  - Fallback view queries `sales`.
- **[`src/components/free-scheme-report-view.tsx`](file:///e:/work/pharmaql/src/components/free-scheme-report-view.tsx)**:
  - Reads `mrInventory` and `products`.

---

## Action Plan to Completely Remove Neon Database

1. **Immediate Step (Phase 10):**
   - Update export API routes (`download-stock`, `download-sales`, `download-outstanding`) to fetch data directly via the MySQL stored procedures instead of querying Neon.
   - Update Overview tab metric cards to aggregate live MySQL procedure totals instead of querying empty Postgres tables.
   - Hide on-screen debug banners behind `?debug=1`.

2. **Next Step (Phase 11 - Auth & Admin MySQL Migration):**
   - Migrate Better Auth to MySQL database schema.
   - Create tables in MySQL for `user`, `session`, `account`, and `notices`.
   - Resolve MR division assignments directly from `pdyasvmaster.l_mktcompany_mr`.
   - Remove `postgres`, `drizzle-orm/pg-core`, and `DATABASE_URL` (Neon) entirely from `package.json` and `.env`.
