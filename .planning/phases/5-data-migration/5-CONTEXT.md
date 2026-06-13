# Phase 5 Context: Data Migration (SQL Import)

## Domain

Parse and ingest a legacy MySQL dump (`demo data/APBARODA.sql`) into our Postgres database.

## Decisions

### Handling Existing Data

- Upsert data (update existing products if ItemId matches, insert new ones).

### Field Mapping

- Auto map the columns based on the SQL schema. For example:
  - `ItemId` -> `id`
  - `ItemName` -> `name`
  - `Code` -> `manufacturer`
  - `Packing` -> `freeScheme`

### Execution Method

- A dedicated standalone CLI script (e.g., `npm run migrate-sql`) run from the terminal.

### Performance / Execution

- Script should be built but **DO NOT execute the insertion now**. The script will be run by the user when they are ready.

## Canonical Refs

- `demo data/APBARODA.sql`
- `src/server/db/schema.ts`
