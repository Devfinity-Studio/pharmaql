# Neon (Postgres) Database Complete Audit & Zero-Table Workaround Plan

**Date:** 2026-10-11  
**Status:** Updated with complete Read/Write matrix and Zero-MySQL-Table Workaround solutions.

---

## 1. Executive Summary

PharmaQL is actively transitioning off the cloud Postgres (Neon) database.
A critical architectural constraint has been established:
> **"We cannot create new tables in the MySQL framework."**  
> *(The MySQL databases `pdyasvmaster` and `pdyasvtrans` belong to the legacy ERP system; altering schemas or creating custom tables is strictly prohibited.)*

This document provides:
1. **The exhaustive inventory** of everywhere PharmaQL currently **reads** from and **writes** to Neon.
2. **Workaround architectures** to completely eliminate Neon without creating a single table in the legacy MySQL database.

---

## 2. Where PharmaQL Reads Data From Neon (`READ` Operations)

Below is every file, function, and table queried via `db.select()` / Drizzle:

| Location / File | Postgres Table | Purpose / Query Description |
|---|---|---|
| `src/components/mr-dashboard-content.tsx` (L56) | `mrManufacturers` | Reads MR's assigned companies/divisions. |
| `src/components/mr-dashboard-content.tsx` (L116) | `products` | Reads products belonging to assigned divisions. |
| `src/components/mr-dashboard-content.tsx` (L149) | `mrInventory` | Reads inventory stock per product for the MR. |
| `src/components/mr-dashboard-content.tsx` (L222) | `sales` | Reads sales transactions for Overview metric cards. |
| `src/components/mr-dashboard-content.tsx` (L228) | `invoices` | Reads invoice records for Overview metric cards. |
| `src/components/mr-dashboard-content.tsx` (L232) | `outstanding` | Reads outstanding balances for Overview metric cards. |
| `src/components/product-report-view.tsx` (L80) | `mrManufacturers` | Checks MR manufacturer assignments. |
| `src/components/product-report-view.tsx` (L599-658) | `products`, `mrInventory`, `sales` | Fallback query when stored procedure returns no rows. |
| `src/components/stock-report-view.tsx` (L57) | `mrManufacturers` | Checks MR assignments for filtering stock rows. |
| `src/components/party-report-view.tsx` (L147) | `sales` | Fallback sales aggregation when procedure is not run. |
| `src/components/free-scheme-report-view.tsx` (L32-70) | `mrManufacturers`, `products`, `mrInventory` | Fallback scheme calculations when `rptClaimData` has no rows. |
| `src/components/overdue-report-view.tsx` (L42) | `mrManufacturers` | Checks assigned manufacturers for overdue reporting. |
| `src/components/outstanding-report-view.tsx` (L27, L90) | `mrManufacturers`, `outstanding` | Legacy outstanding view queries. |
| `src/components/sales-report-view.tsx` (L28, L40, L74) | `mrManufacturers`, `products`, `sales` | Legacy sales report view. |
| `src/components/new-sales-report-view.tsx` (L28, L67) | `mrManufacturers`, `products` | New sales experimental view. |
| `src/app/api/reports/download-stock/route.ts` (L75, L102) | `mrManufacturers`, `mrInventory`, `products` | Generates Stock Excel export. |
| `src/app/api/reports/download-sales/route.ts` (L60, L82) | `mrManufacturers`, `sales`, `products` | Generates Sales Excel export. |
| `src/app/api/reports/download-outstanding/route.ts` (L78, L102) | `mrManufacturers`, `outstanding` | Generates Outstanding Excel export. |
| `src/app/api/reports/download/route.ts` (L120-145) | `sales`, `outstanding`, `mrInventory` | Multi-report download endpoint. |
| `src/app/api/products/route.ts` (L19, L31) | `companies`, `products` | Product listing API. |
| `src/app/products/[company]/page.tsx` (L19, L34) | `products` | Company products page. |
| `src/app/admin/mrs/page.tsx` (L36, L92, L93) | `user`, `mrManufacturers`, `session` | Admin MR listing and permission management. |
| `src/app/admin/companies/page.tsx` (L33) | `companies` | Admin companies list. |
| `src/app/admin/notices/page.tsx` (L20) | `notices` | Admin notices page. |
| `src/server/auth.ts` | `user`, `session`, `account`, `verification` | Better Auth session verification and user lookup on every authenticated request. |

---

## 3. Where PharmaQL Writes Data To Neon (`WRITE` Operations)

Below is every file and function that inserts, updates, or deletes data in Neon:

| Location / File | Action | Postgres Table | Description |
|---|---|---|---|
| `src/server/auth.ts` | `db.insert`, `db.update`, `db.delete` | `user`, `session`, `account`, `verification` | **Better Auth Lifecycle:** Writes user record on registration/login, inserts active session tokens on login, deletes session tokens on logout. |
| `src/server/actions/notices.ts` (L35) | `db.insert` | `notices` | **Create Notice:** Inserts new broadcast notice. |
| `src/server/actions/notices.ts` (L61, L64, L80) | `db.update` | `notices` | **Publish / Expire Notice:** Toggles `isActive`, sets `expiresAt`. |
| `src/server/actions/notices.ts` (L96) | `db.delete` | `notices` | **Delete Notice:** Removes a notice. |
| `src/server/actions/mrs.ts` (L40, L164) | `db.insert` | `mrManufacturers` | **Assign Manufacturer:** Adds division assignment to an MR. |
| `src/server/actions/mrs.ts` (L66) | `db.delete` | `mrManufacturers` | **Unassign Manufacturer:** Removes division assignment from an MR. |
| `src/server/actions/mrs.ts` (L154) | `db.insert` | `user` | **Create MR Account:** Creates new user record with role `MR`. |
| `src/server/actions/mrs.ts` (L84) | `db.update` | `user` | **Block / Unblock MR:** Toggles `isBlocked` on user. |
| `src/server/actions/mrs.ts` (L111) | `db.update` | `user` | **Update Permissions:** Toggles `canViewStock`, `canViewSales`, `canViewPartyWise`, etc. |
| `src/server/actions/companies.ts` (L20) | `db.insert` | `companies` | **Add Company:** Adds company entry. |
| `src/server/actions/ingest.ts` (L82, 106, 132, 148) | `db.insert` | `mrManufacturers`, `products`, `sales`, `mrInventory` | **Legacy Ingest:** Ingests CSV/SQL files into Postgres tables. |

---

## 4. Why We Cannot Use MySQL for Custom Tables

The legacy ERP database has two production schemas:
1. `pdyasvmaster` (Master data: items, companies, MRs, customers)
2. `pdyasvtrans` (Transactional data: sales, purchases, batches, vouchers)

**Restrictions:**
- The ERP software strictly controls schema versioning.
- Running `CREATE TABLE user`, `CREATE TABLE session`, or custom PharmaQL tables in `pdyasvmaster` or `pdyasvtrans` is prohibited because it could interfere with ERP upgrades, backups, and audits.
- We cannot run migrations on the MySQL server.

---

## 5. Workaround Solutions: Completely Eliminating Neon with Zero MySQL Tables

To eliminate Neon without creating a single table in MySQL, we have two practical, production-grade solutions:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PROPOSED ARCHITECTURES                          │
└────────────────────────────────────────────────────────────────────────┘

 SOLUTION A: Embedded SQLite (Zero Cloud + Zero MySQL Tables) [RECOMMENDED]
 ┌──────────────────────┐         ┌──────────────────────────────────────┐
 │ Next.js Server       │         │ Legacy MySQL (pdyasvmaster/trans)   │
 │                      │  READ   │                                      │
 │   Reporting UI       │────────▶│  Live Stored Procedures:             │
 │   Export Endpoints   │         │  - rptItemCustomerSale               │
 │   MR Profiles        │         │  - rptCompanyCustomerItemwiseSales   │
 └──────────┬───────────┘         │  - rptStockMovementStatement         │
            │                     │  - rptClaimData                      │
            │ READ / WRITE        │  - rptMRwisePeriodicalOutstanding    │
            ▼                     │  - l_mktcompany_mr (MR master)       │
 ┌──────────────────────┐         └──────────────────────────────────────┘
 │ Local SQLite File    │         * ZERO TABLES CREATED IN MYSQL *
 │ (data/app.db)        │
 │ - Better Auth (Users)│
 │ - Sessions / Tokens  │
 │ - Notices            │
 └──────────────────────┘

 SOLUTION B: Stateless JWT / Cookie Auth + Pure MySQL Native Data
 ┌──────────────────────┐         ┌──────────────────────────────────────┐
 │ Next.js Server       │  READ   │ Legacy MySQL (pdyasvmaster/trans)   │
 │                      │────────▶│                                      │
 │ - Stateless JWT Auth │         │  - Credentials & MRs:                │
 │   (Zero DB storage)  │         │    l_mktcompany_mr / m_user          │
 │ - Notices in JSON    │         │  - Division assignments:             │
 │   (data/notices.json)│         │    Native l_mktcompany_mr            │
 └──────────────────────┘         │  - All Reports: Stored Procedures    │
                                  └──────────────────────────────────────┘
                                  * ZERO TABLES CREATED ANYWHERE *
```

---

### Solution A: Embedded SQLite (`better-sqlite3` / Drizzle SQLite) — ⭐ RECOMMENDED

1. **How It Works:**
   - Instead of Neon (Postgres over internet), Drizzle connects to a local, file-based SQLite database located at `data/app.db` on the server.
   - Drizzle ORM supports SQLite natively with identical syntax (`drizzle-orm/better-sqlite3` or `@libsql/client`).
2. **What Goes in SQLite:**
   - Better Auth tables (`user`, `session`, `account`, `verification`).
   - Admin `notices`.
   - Custom MR permission overrides.
3. **What Stays in MySQL:**
   - All 5 reports (`rptItemCustomerSale`, `rptCompanyCustomerItemwiseSales`, `rptStockMovementStatement`, `rptClaimData`, `rptMRwisePeriodicalOutstanding`).
   - All MR master data (`l_mktcompany_mr`, `m_item`, `m_mktcompany`).
4. **Benefits:**
   - **Zero tables created in MySQL.**
   - **Completely eliminates Neon.** No database bills, no internet latency on session lookups, no cloud dependencies.
   - Code changes are minimal: simply switch `pgTable` to `sqliteTable` in `schema.ts`.
   - Single-file database backup: `data/app.db` can be backed up with a simple file copy.

---

### Solution B: Native MySQL Read-Only Mapping + Stateless Cookie Auth

If you want **zero local database files as well**:

1. **Authentication:**
   - Switch Better Auth to **Stateless JWT tokens** stored in encrypted HTTP-only cookies (`jose` or Better Auth cookie plugin).
   - Sessions require **zero database storage** — the user identity and role are verified via cryptographic signature in the cookie.
   - On login, verify credentials directly against `pdyasvmaster.l_mktcompany_mr` / `m_user`.
2. **MR Division Assignments:**
   - Remove the `mrManufacturers` table completely.
   - Read division and company assignments directly from `pdyasvmaster.l_mktcompany_mr`:
     ```sql
     SELECT mr.ID, mr.MRName, l.Division, m.Code AS CompanyCode, m.Description AS CompanyName
     FROM pdyasvmaster.l_mktcompany_mr mr
     LEFT JOIN pdyasvmaster.l_mktcompany l ON mr.DivisionID = l.ID
     LEFT JOIN pdyasvmaster.m_mktcompany m ON l.CompCode = m.Code
     WHERE mr.ID = ?
     ```
3. **Notices:**
   - Store broadcast notices in a lightweight local JSON file (`data/notices.json`).
4. **Benefits:**
   - Zero database tables created anywhere.
   - 100% powered by the existing MySQL tables and Next.js memory/cookies.

---

## 6. Migration Steps

| Phase | Milestone | Actions |
|---|---|---|
| **Phase 10** | **Clean Up Reports & Exports** | • Re-route all export routes (`download-stock`, `download-sales`, `download-outstanding`) to MySQL stored procedures.<br>• Populate Overview cards from MySQL procedure summaries.<br>• Remove Postgres fallback code from report components. |
| **Phase 11** | **Eliminate Neon DB** | • Implement Solution A (SQLite for Auth/Notices) or Solution B (Stateless JWT + native `l_mktcompany_mr`).<br>• Remove `DATABASE_URL`, `@neondatabase/serverless`, `postgres`, and `drizzle-orm/pg-core`.<br>• Uninstall Postgres packages from `package.json`. |
