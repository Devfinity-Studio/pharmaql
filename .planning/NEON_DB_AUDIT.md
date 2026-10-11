# Neon (Postgres) Database Complete Audit & Zero-Table Workaround Plan

**Date:** 2026-10-11  
**Status:** Approved Architectural Decision — **Solution B (Stateless JWT + Legacy MySQL Read-Only Mapping + JSON)**  
**Constraint:** Strict prohibition against creating new tables or altering schemas in MySQL (`pdyasvmaster` and `pdyasvtrans`).

---

## 1. Architectural Decision: Solution B Selected

The project has chosen **Solution B** to eliminate Neon completely **without creating a single table in the MySQL framework**.

### How Solution B Works with Zero New MySQL Tables:

1. **Authentication (Stateless JWT in HTTP-Only Cookies):**
   - Better Auth or a stateless JWT session engine (`jose`) issues signed, encrypted JWT tokens stored in HTTP-only cookies.
   - **Zero DB tables needed for sessions:** The user identity, MR ID, role, and permissions are cryptographically verified in the cookie payload.
   - Session revocation / expiration is handled purely via cookie expiry and signing key rotation.
2. **User & MR Read-Only Mapping:**
   - On login, MR credentials and profile details are read directly from existing legacy tables:
     - `pdyasvmaster.l_mktcompany_mr` (MR profile: `ID`, `MRName`, `EmailId`, `MobileNo`, `IsInActive`)
     - `pdyasvmaster.l_mktcompany` (Division: `ID`, `Division`, `CompCode`)
     - `pdyasvmaster.m_mktcompany` (Company: `Code`, `Description`)
     - `pdyasvmaster.m_user` (ERP internal user logins)
   - Zero custom tables created for users or MR manufacturer mappings.
3. **Reports & Exports:**
   - 100% powered by the 5 legacy stored procedures in MySQL:
     - Product Wise: `pdyasvtrans.rptItemCustomerSale`
     - Party Wise: `pdyasvtrans.rptCompanyCustomerItemwiseSales`
     - Stock & Sales: `pdyasvtrans.rptStockMovementStatement`
     - Claim Qty: `pdyasvtrans.rptClaimData`
     - Overdue Statement: `pdyasvtrans.rptMRwisePeriodicalOutstanding`
4. **Notices / Announcements:**
   - Broadcast admin notices are persisted in a lightweight JSON file (`data/notices.json`) on the server.
   - Zero tables created in MySQL.

---

## 2. Where PharmaQL Reads Data From Neon (`READ` Operations)

Below is the complete inventory of all read queries hitting Neon Postgres via Drizzle (`db.select()` / `db.query`):

| # | Location / File | Postgres Table | Purpose / Query Details | Legacy MySQL Replacement |
|---|---|---|---|---|
| 1 | `src/components/mr-dashboard-content.tsx` (L56) | `mrManufacturers` | Reads MR's assigned companies/divisions. | Read from `pdyasvmaster.l_mktcompany_mr` + `l_mktcompany` + `m_mktcompany` |
| 2 | `src/components/mr-dashboard-content.tsx` (L116) | `products` | Reads products in assigned divisions. | Stored procedure output / `pdyasvmaster.m_item` |
| 3 | `src/components/mr-dashboard-content.tsx` (L149) | `mrInventory` | Reads inventory stock per product for the MR. | Stored procedure `rptStockMovementStatement` |
| 4 | `src/components/mr-dashboard-content.tsx` (L222) | `sales` | Reads sales transactions for Overview metric cards. | Stored procedure `rptItemCustomerSale` aggregation |
| 5 | `src/components/mr-dashboard-content.tsx` (L228) | `invoices` | Reads invoice records for Overview metric cards. | Stored procedure `rptMRwisePeriodicalOutstanding` |
| 6 | `src/components/mr-dashboard-content.tsx` (L232) | `outstanding` | Reads outstanding balances for Overview metric cards. | Stored procedure `rptMRwisePeriodicalOutstanding` aggregation |
| 7 | `src/components/product-report-view.tsx` (L80, L599) | `mrManufacturers`, `products`, `mrInventory`, `sales` | Fallback queries when procedure returns no rows. | Remove fallback; strictly use `rptItemCustomerSale` |
| 8 | `src/components/party-report-view.tsx` (L147) | `sales` | Fallback sales aggregation when procedure is not run. | Remove fallback; strictly use `rptCompanyCustomerItemwiseSales` |
| 9 | `src/components/stock-report-view.tsx` (L57) | `mrManufacturers` | Filters stock rows by assigned manufacturer. | Read from `l_mktcompany_mr` / stored procedure |
| 10 | `src/components/free-scheme-report-view.tsx` (L32) | `mrManufacturers`, `products`, `mrInventory` | Fallback scheme calculations. | Remove fallback; strictly use `rptClaimData` |
| 11 | `src/components/overdue-report-view.tsx` (L42) | `mrManufacturers` | Checks assigned manufacturers for overdue report. | Read from `l_mktcompany_mr` |
| 12 | `src/components/outstanding-report-view.tsx` (L27) | `mrManufacturers`, `outstanding` | Legacy outstanding view queries. | Superseded by `rptMRwisePeriodicalOutstanding` |
| 13 | `src/components/sales-report-view.tsx` (L28) | `mrManufacturers`, `products`, `sales` | Legacy sales report view. | Superseded by `rptItemCustomerSale` |
| 14 | `src/components/new-sales-report-view.tsx` (L28) | `mrManufacturers`, `products` | Experimental sales report view. | Superseded by `rptItemCustomerSale` |
| 15 | `src/app/api/reports/download-stock/route.ts` (L75) | `mrManufacturers`, `mrInventory`, `products` | Generates Stock Excel export. | Switch to `rptStockMovementStatement` |
| 16 | `src/app/api/reports/download-sales/route.ts` (L60) | `mrManufacturers`, `sales`, `products` | Generates Sales Excel export. | Switch to `rptItemCustomerSale` |
| 17 | `src/app/api/reports/download-outstanding/route.ts` (L78) | `mrManufacturers`, `outstanding` | Generates Outstanding Excel export. | Switch to `rptMRwisePeriodicalOutstanding` |
| 18 | `src/app/api/reports/download/route.ts` (L120) | `sales`, `outstanding`, `mrInventory` | Multi-report download endpoint. | Switch to live stored procedures |
| 19 | `src/app/api/products/route.ts` (L19) | `companies`, `products` | Product listing API. | Switch to `pdyasvmaster.m_item` |
| 20 | `src/app/products/[company]/page.tsx` (L19) | `products` | Company products page. | Switch to `pdyasvmaster.m_item` |
| 21 | `src/app/admin/mrs/page.tsx` (L36) | `user`, `mrManufacturers`, `session` | Admin MR listing and permission management. | Query `pdyasvmaster.l_mktcompany_mr` |
| 22 | `src/app/admin/companies/page.tsx` (L33) | `companies` | Admin companies list. | Query `pdyasvmaster.m_mktcompany` |
| 23 | `src/app/admin/notices/page.tsx` (L20) | `notices` | Admin notices page. | Read from `data/notices.json` |
| 24 | `src/server/auth.ts` | `user`, `session`, `account`, `verification` | Better Auth session verification & user lookup. | Stateless JWT token verification (Zero DB lookups) |

---

## 3. Where PharmaQL Writes Data To Neon (`WRITE` Operations)

Below is every file and function that inserts, updates, or deletes data in Neon:

| # | Location / File | Action | Postgres Table | Operation Description | Solution B Replacement (Zero MySQL Tables) |
|---|---|---|---|---|---|
| 1 | `src/server/auth.ts` | `insert`, `update`, `delete` | `user`, `session`, `account`, `verification` | Better Auth session lifecycle: inserts session tokens on login, updates expires, deletes on logout. | **Stateless JWT Cookie:** Tokens are signed with a server secret and set in cookies. No database insert or delete required. |
| 2 | `src/server/actions/notices.ts` (L35) | `insert` | `notices` | Inserts new broadcast notice. | Append to `data/notices.json`. |
| 3 | `src/server/actions/notices.ts` (L61, L80) | `update` | `notices` | Updates `isActive`, sets `expiresAt`. | Update object in `data/notices.json`. |
| 4 | `src/server/actions/notices.ts` (L96) | `delete` | `notices` | Deletes a notice. | Remove object from `data/notices.json`. |
| 5 | `src/server/actions/mrs.ts` (L40, L164) | `insert` | `mrManufacturers` | Assigns manufacturer/division to an MR. | **ERP Native:** Managed by ERP in `l_mktcompany_mr` (or persisted in local `data/mr-overrides.json` if web overrides are needed). |
| 6 | `src/server/actions/mrs.ts` (L66) | `delete` | `mrManufacturers` | Removes manufacturer/division from an MR. | Managed by ERP in `l_mktcompany_mr`. |
| 7 | `src/server/actions/mrs.ts` (L154) | `insert` | `user` | Creates new MR user record. | MR accounts exist natively in ERP (`l_mktcompany_mr` / `m_user`). |
| 8 | `src/server/actions/mrs.ts` (L84) | `update` | `user` | Blocks / unblocks an MR. | Update flag in `data/mr-overrides.json` or query ERP `IsInActive`. |
| 9 | `src/server/actions/mrs.ts` (L111) | `update` | `user` | Updates permission flags (`canViewStock`, `canViewSales`, etc.). | Store in `data/mr-overrides.json` or embed default permissions in JWT. |
| 10 | `src/server/actions/companies.ts` (L20) | `insert` | `companies` | Adds new company. | Companies are managed natively in ERP `m_mktcompany`. |
| 11 | `src/server/actions/ingest.ts` | `insert` | `mrManufacturers`, `products`, `sales`, `mrInventory` | Ingests CSV files into Postgres. | **Deprecated:** Eliminated completely since all data is live from MySQL. |

---

## 4. Unmapped Tables & Doubts File

For every legacy MySQL table mapping where exact legacy schemas, password column mechanisms, or table relations need confirmation from the user, see:
👉 [`.planning/NEON_TO_MYSQL_DOUBTS.md`](file:///e:/work/pharmaql/.planning/NEON_TO_MYSQL_DOUBTS.md)
