# Roadmap

## Phase 1: Database Schema & Authentication

- Set up Drizzle schema for Users, Roles, Products, Sales, and Orders.
- Implement Better Auth with credential support for MR authentication.
- Create initial Admin user via seeding or script.

## Phase 2: Admin Data Ingestion

- Build API routes for parsing CSVs from Technomax.
- Implement business logic to populate Stock, Sales, and Free Schemes data into the DB.

## Phase 3: MR Dashboard & Order Placement

- Build the MR portal UI (responsive for mobile/desktop) using Stitch MCP.
- Implement row-level or query-level data isolation for MR sales views.
- Build form and server actions for MRs to create/edit sales and place orders.

## Phase 4: Admin Global Dashboard & Order Management

- Build Admin reporting UI (per-company, per-MR).
- Implement order management dashboard for Admins to view and complete orders.

## Phase 5: Data Migration (SQL Import)

- Parse and ingest legacy MySQL dumps (e.g. `demo data/APBARODA.sql`) into the Postgres database.
- Map and seed product data correctly for MR assignments.

## Phase 6: Overdue (Purchase Days & Outstanding)

- Implement the backend logic to calculate purchase days and outstanding amounts per party.
- Complete the "Overdue" tab in the MR Dashboard UI to render this data.

## Phase 7: Performance Optimization & UI Loading States

- Add DB indexes to improve query speeds on large tables.
- Implement React Suspense, skeleton loaders, and `useTransition` for tabs and date filters.
- Optimize data fetching for reports with caching or efficient aggregations.

## Phase 8: Full Data Ingestion & Masterdata Integration (April–October 2026) [COMPLETED]

- [x] Ingest all multi-month AP Baroda SQL datasets (April through October 2026: April, May, June, July, August, September, October).
- [x] Ingest and map `masterdata.sql` (schemes, tax/calculation parameters, customers, products).
- [x] Ensure 100% transaction coverage (zero dropped rows, full MR mapping & auto-fallback reps).
- [x] Validate database counts, calculations, and performance across all report views.

## Phase 9: Legacy MySQL MR User Integration [COMPLETED]

- [x] Create centralized server action `src/server/actions/mrInfo.ts` querying `pdyasvmaster.m_user` with lean column projection.
- [x] Migrate MR lookup across all report views (Stock, Sales, Product, Overdue, Outstanding, Free Schemes).
- [x] Migrate MR dashboard and admin MR inspection pages to use `mrInfo.ts`.
- [x] Update API report download endpoints to resolve MR access from legacy MySQL.
- [x] Verify build and validate end-to-end user navigation.

## Phase 10: Legacy Stored Procedure Transition & Cleanup [ACTIVE]

- [ ] Gate raw SQL debug query banners behind URL toggle (`?debug=1`).
- [ ] Align Overview Dashboard metric cards with live procedure aggregations.
- [ ] Verify export endpoints and print formats against live procedure datasets.
- [ ] Run full TypeScript validation and commit cleanly to `localdb`.
