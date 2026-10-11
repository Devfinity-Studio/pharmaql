# Phase 10: Legacy Stored Procedure Transition & Cleanup - Context & Decisions

**Phase:** Phase 10 - Legacy Stored Procedure Transition & Cleanup  
**Date:** 2026-10-11  

---

## Locked Decisions from Discussion

### 1. Debug Query Banners
- **Decision:** Hide on-screen debug banners by default on all report pages and the overview tab.
- **Trigger:** Only show the debug banner when `?debug=1` or `?debug=true` is present in the URL query string.
- **Server Logging:** Keep query logs in the server terminal for backend visibility.
- **Print:** Keep `print:hidden` so prints and PDF renders never display debug banners.

### 2. Overview Dashboard Metrics
- **Decision:** Populate the 3 overview metric cards (Total Sales Volume, Total Invoices, Outstanding Balance) directly from the live stored procedure data:
  - **Sales Volume:** Sum of quantities from `rptItemCustomerSale`.
  - **Total Invoices:** Sum of invoice amounts from `rptItemCustomerSale` or `rptMRwisePeriodicalOutstanding`.
  - **Outstanding Balance:** Total balance (`Amount - AdjAmt`) from `rptMRwisePeriodicalOutstanding`.
- **Reason:** Local Postgres tables currently contain 0 rows for the MR, causing the overview cards to show ₹0.00. Using live procedures ensures consistency between the Overview tab and individual report tabs.

### 3. PDF & Excel Downloads
- **Decision:** Re-route the report export API endpoints (`/api/reports/download-stock`, `/api/reports/download-sales`, `/api/reports/download-outstanding`, `/api/reports/download`) to fetch data from the live MySQL stored procedures instead of querying the Neon database.
- **Scope:**
  - Stock export $\to$ `getStockMovement` (`rptStockMovementStatement`)
  - Sales export $\to$ `getItemCustomerSale` (`rptItemCustomerSale`)
  - Outstanding export $\to$ `getMRwisePeriodicalOutstanding` (`rptMRwisePeriodicalOutstanding`)

### 4. Neon Database Elimination Roadmap
- **Decision:** Fully audited all usages of Neon Postgres in `.planning/NEON_DB_AUDIT.md`.
- **Phase 10 Target:** Remove Neon dependency from all reporting views, overview cards, and export routes.
- **Phase 11 Target:** Complete migration of Better Auth and admin metadata to MySQL, allowing complete removal of `@neondatabase`, `postgres`, and `drizzle-orm/pg-core`.
