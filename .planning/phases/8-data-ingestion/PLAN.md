# Phase 8 Plan: Complete Multi-Month Data Ingestion & Masterdata Integration (April–October 2026 & Masterdata)

## 1. Goal
Ingest the complete historical and current dataset from all AP Baroda monthly SQL dumps (April 2026 through October 2026) and the `masterdata.sql` dump. Ensure 100% of transaction entries (`t_item_sales`, `t_dailyss`, `t_invoices`, `t_outstanding`) are included without dropping any records, map all MRs and manufacturers, and ingest calculation rules/schemes/master records from `masterdata.sql`.

## 2. Dataset Analysis & Ingestion Scope

### A. Monthly AP Baroda Transaction Dumps
- **April 2026**: `demo data/APBARODAAPRIL2026.sql` (69,411 rows, Date range: 2026-04-01 to 2026-04-30)
- **May 2026**: `demo data/APBARODAMAY2026.sql` (79,501 rows, Date range: 2026-05-01 to 2026-05-31)
- **June 2026**: `demo data/APBARODAJUNE2026.sql` (99,409 rows, Date range: 2026-06-01 to 2026-06-30)
- **July 2026**: `demo data/APBARODAJULY2026.sql` (Date range: 2026-07-01 to 2026-07-31)
- **August 2026**: `demo data/APBARODAAUG2026.sql` (Date range: 2026-08-01 to 2026-08-31)
- **September 2026**: `demo data/APBARODASEP2026.sql` / `APBARODA.sql` (Date range: 2026-09-01 to 2026-09-30)
- **October 2026**: `demo data/APBARODAOCT2026.sql` (Date range: 2026-10-01 to 2026-10-11)

*Note on deduplication*: Several files in `demo data/` are legacy duplicates (`APBARODA_1.sql` == `APBARODA-JUNE2026.sql`, `APBARODA_2.sql` == `APBARODA-MAY2026.sql`, `APBARODA.sql` == `APBARODASEP2026.sql`). The non-hyphenated files (`APBARODAAPRIL2026.sql`, `APBARODAMAY2026.sql`, `APBARODAJUNE2026.sql`) represent the latest full-count versions and will be the canonical sources to avoid duplicate insertions.

### B. Masterdata Dump (`demo data/masterdata.sql` - 62.8 MB)
Contains core master references and calculation/business logic tables:
- `schemes` & `m_scheme`: Product free-scheme definitions and slab structures.
- `gst_2_mrp_calc`, `l_tax`, `m_tax`: Tax percentages, MRP recalculation formulas, and tax slabs.
- `m_customer`, `l_m_cust_bankdet`: Master party/customer directories and ledger mappings.
- `m_mktcompany`: Marketing companies and division codes.
- `h_batch` & `itembatchstock`: Batch-level pricing (`MRP`, `PTR`, `PRate`) and inventory.

### C. Zero-Drop Isolation Strategy
- Parse all `m_mr` definitions across all dumps to construct registered MR users.
- Collect every unique `(LocNo, Code)` key across all transaction records in all monthly files.
- If any transaction references a `(LocNo, Code)` not present in `m_mr`, synthesize representative accounts (e.g. `${code}_rep`) so that **no transaction record is skipped or discarded**.
- Generate deterministic composite IDs to enable idempotent batch upserts and allow rerunability without duplicate bloat.

## 3. Step-by-Step Implementation Plan

### Step 1: Masterdata & Calculation Schema Alignment
- Inspect `masterdata.sql` for tables needed in database reports and business logic (`schemes`, `gst_2_mrp_calc`, `m_customer`, `h_batch`).
- Add or update Drizzle table definitions in `src/server/db/schema.ts` (e.g. `schemes`, `customers`, `batches` if not already present or represented).
- Apply migrations or run `db:push` to ensure Postgres tables and indexes are ready.

### Step 2: High-Performance Multi-Month Ingestion Pipeline
- Build an ingestion engine script (`scripts/import-all-months.ts`) utilizing Node.js streaming readline and batch chunking (2,000–5,000 records per transaction).
- **Phase A (Metadata Pass)**:
  - Stream all monthly files to collect all `m_item` (products) and `m_mr` (MRs).
  - Scan all transaction tables (`t_dailyss`, `t_item_sales`, `t_invoices`, `t_outstanding`) to catalogue all `(LocNo, Code)` pairs.
  - Flush all products, users, credentials, and `mr_manufacturers` in atomic batches.
- **Phase B (Transaction Pass)**:
  - Sequentially stream April, May, June, July, August, September, and October files.
  - Ingest `t_item_sales` -> `sales` table.
  - Ingest `t_dailyss` -> `mr_inventory` table.
  - Ingest `t_invoices` -> `invoices` table.
  - Ingest `t_outstanding` -> `outstanding` table.
- **Phase C (Masterdata Pass)**:
  - Stream `demo data/masterdata.sql` and ingest `schemes`, `customers`, and calculation rules.

### Step 3: Verification & Reconciliation
- Create a reconciliation script (`scripts/verify-ingestion-counts.ts`) that counts raw rows in each SQL file and verifies against PostgreSQL row counts.
- Ensure:
  - 100% of transactions across all 7 months are present in the database.
  - Zero unmapped transactions or dropped rows.
  - Date ranges span correctly from April 1, 2026 to October 11, 2026.

### Step 4: UI & Report Validation
- Verify MR Dashboard and Admin Dashboard across the expanded 7-month date range:
  - Sales reports (party-wise, product-wise).
  - Stock reports.
  - Overdue & Outstanding reports.
  - Performance & pagination with large multi-month data.

## 4. Verification Criteria
- [ ] Database row counts match expected sums from April through October 2026.
- [ ] Ingestion script finishes cleanly without memory errors or transaction drops.
- [ ] Login works for all MRs and representative users.
- [ ] All reports accurately display transactions across the entire 7-month timeframe.
- [ ] `pnpm run build` succeeds without type errors.
