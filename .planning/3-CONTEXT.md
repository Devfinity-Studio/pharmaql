# Phase 3 Context: MR Dashboard & Order Placement

This document captures the architectural decisions and functional requirements for Phase 3, resolving identified gray areas. Downstream planning and execution agents should treat these decisions as ground truth.

## 1. MR Dashboard Layout & Metrics

- **Decision:** Auto-generated standard view.
- **Implementation:** The MR dashboard will automatically display key contextual metrics without requiring strict pre-definition. This includes:
  - Total Personal Sales (aggregate).
  - A table of recent personal sales.
  - A view of available products and stock.
  - A list of their pending and completed orders.
- **Data Isolation:** All database queries for these metrics must strictly filter by `mrId` matching the currently logged-in user.

## 2. Order Placement Rules

- **Decision:** Deferred Stock Deduction.
- **Implementation:** When an MR places an order, the status defaults to "Pending". The stock is **NOT** deducted immediately. Stock will only be deducted when the Admin manually marks the order as "Completed" (which will be implemented in Phase 4).
- _Note:_ MRs will see the current stock when ordering to guide their quantities, but the actual deduction is deferred.

## 3. Editing Sales Records

- **Decision:** Unrestricted editing.
- **Implementation:** MRs have full CRUD (Create, Read, Update, Delete) access to their own sales records. There are no time limits or state constraints preventing them from editing past sales.

## 4. UI & Styling Aesthetics

- **Decision:** "Clean but colorful"
- **Implementation:** The UI built with Stitch MCP will feature a clean, uncluttered layout (ample whitespace, crisp typography) combined with vibrant, colorful accents (e.g., dynamic gradients, vibrant primary buttons, colorful charts/cards). The design should look premium and modern without being overwhelmingly dark or busy.
