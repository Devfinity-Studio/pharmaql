# Phase 2 Context: Admin Data Ingestion

This document captures the architectural decisions and functional requirements for Phase 2, resolving identified gray areas. Downstream planning and execution agents should treat these decisions as ground truth.

## 1. Technomax CSV Format Assumption
- **Decision:** Since the exact structure of the Technomax CSV export is currently unknown, we will implement an intelligent, flexible CSV parser.
- **Implementation:** The parser will assume a flat, combined structure containing: `ProductName`, `StockQty`, `FreeScheme`, `MR_Email`, `SaleQty`, and `SaleNotes`. This baseline can be easily refactored once a sample CSV is obtained from Technomax.

## 2. Sync Strategy (Incremental vs. Full)
- **Decision:** The system will support **BOTH** strategies.
- **Implementation:** 
  - The Admin UI (`/admin/ingest`) will include a toggle or dropdown letting the Admin choose the sync mode for **Stock**.
  - **Full Sync Mode:** The CSV's `StockQty` will completely *replace* the existing stock value in the database.
  - **Incremental Mode:** The CSV's `StockQty` will be *added* to the existing stock value.
  - *Note on Sales:* Sales records (`SaleQty`) will always be treated as incremental (appended as new records).

## 3. Error Handling & Missing Entities
- **Decision:** Auto-creation (Upsert).
- **Implementation:** If the parser encounters a `ProductName` or `MR_Email` that does not currently exist in the database, the ingestion process will **not** fail. Instead, it will automatically create a stub record (auto-generating an ID and defaulting a password if it's an MR). 
- *Rationale:* As requested, once the basic entities are auto-created by the ingestion, the Admin can manually "feed the remaining fields" later via the Admin Dashboard.

## 4. Free Scheme Logic
- **Decision:** Handled as unstructured text.
- **Implementation:** Because "free schemes are decided by the company and can be any way", the `freeScheme` column will simply be parsed and stored as a string in the `products` table (e.g., "10+1" or "Buy 5 Get 2"). 
- *Future Scope:* If mathematical automation is required during order placement later, the string parsing logic will be updated, but for now, it simply acts as an informational label for the MRs.
