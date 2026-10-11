# Phase 11 Context: Neon DB Elimination & Pure Legacy MySQL Transition

**Date:** 2026-10-11  
**Status:** Ready for Execution  
**Goal:** Completely eliminate the Neon Postgres database while strictly respecting the architectural constraint: **Zero new tables created in MySQL** (`pdyasvmaster` and `pdyasvtrans`).

---

## Locked Decisions & Clarifications from User

1. **Authentication:**
   - **MR Users:** Authenticate exclusively via **OTP / Mobile Number**.
     - Look up MR by mobile number or email in `pdyasvmaster.l_mktcompany_mr`.
     - Generate secure OTP, verify, and issue signed stateless JWT cookie.
   - **Admin & Developer Accounts:**
     - Explicit accounts configured in `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEV_EMAIL`, `DEV_PASSWORD`).
     - Standard email + password login verified against env credentials.
   - **Session Storage:**
     - 100% **Stateless JWT in HTTP-only signed cookies** using `jose`.
     - Zero database records stored or queried for active sessions.

2. **MR & Manufacturer Division Mapping:**
   - Single source of truth is `pdyasvmaster.l_mktcompany_mr` joined with `pdyasvmaster.l_mktcompany` and `pdyasvmaster.m_mktcompany`.
   - `mrManufacturers` Postgres table is completely removed.

3. **Product Catalog:**
   - Read directly from `pdyasvmaster.m_item` using the exact user-specified projection:
     ```sql
     SELECT 
       ID, AWACSCode, SeriesID, ItemCode, ItemName, PrintName, Packing,
       BaseUnit, PurcUnit, QtyPerPurcUnit, MktByID, MktBy, MfgByID,
       DivisionId, Division, AllowInvDisc, DiscPer, MinNetQty, MultipleOfQty,
       MinSaleQty, AllowSLRT, AllowChangePTR, IncSS, ItemCatgID, ItemCategory,
       IsColdChain, ItemGroup, MISRate, HSN, TaxGrpCode, GeneralTaxP, CompNo,
       PriQty, PriContains, PriContainsUnit, LBatchNo, LPrate, LPTR, LMRP,
       LExpDt, PTRMarginP, PRateMarginP, InActive
     FROM pdyasvmaster.m_item
     ```

4. **Notices / Announcements:**
   - Stored in server-side local JSON file `data/notices.json`.
   - `notices` Postgres table is eliminated.

5. **Legacy Cloud Cleanup:**
   - All reports already use live stored procedures (`rptItemCustomerSale`, `rptCompanyCustomerItemwiseSales`, `rptStockMovementStatement`, `rptClaimData`, `rptMRwisePeriodicalOutstanding`).
   - Remove Drizzle Postgres dependencies (`@neondatabase/serverless`, `postgres`, `drizzle-orm/pg-core`) and delete unused Postgres schemas.
