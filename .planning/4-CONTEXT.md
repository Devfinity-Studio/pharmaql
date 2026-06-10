# Phase 4 Context: Admin Global Dashboard & Order Management

This document captures the architectural decisions and functional requirements for Phase 4, resolving identified gray areas. Downstream planning and execution agents should treat these decisions as ground truth.

## 1. Company/Manufacturer Definition

- **Decision:** Products belong to manufacturers.
- **Implementation:** The `products` schema will be updated to include a `manufacturer` (or `company`) string field. The Admin reporting dashboard will include views/filters allowing the Admin to group sales and stock data by these manufacturer companies.
- _Note:_ The CSV ingestion parser (Phase 2) may need a slight update to map this if it's provided in future CSVs, but for now, it can default to "Unknown" or be editable by the Admin.

## 2. Order Completion Logic (Insufficient Stock)

- **Decision:** Admin discretion (soft warnings).
- **Implementation:** When an Admin attempts to mark a pending order as "Completed", the system will check the stock. If the requested quantity exceeds the available stock, the system will **not** strictly block the action. It will allow the Admin to force the approval (letting stock go negative if necessary), giving the Admin ultimate control over fulfillment routing.

## 3. Per-MR Reporting

- **Decision:** Auto-generated standard reporting.
- **Implementation:** The Admin dashboard will feature a "Medical Representatives" section that provides a high-level overview of each MR's performance. Metrics will include:
  - Total Sales Volume (all-time or monthly).
  - Number of pending orders vs completed orders.
  - Quick link to view a specific MR's detailed ledger.

## 4. Order Approval UI

- **Decision:** Auto-generated optimized workflow.
- **Implementation:** The Order Management tab will feature a clean, data-dense table listing all pending orders. It will include quick-action buttons (Approve / Reject) on each row for rapid processing, along with clear visual indicators of current stock vs requested quantity to inform the Admin's decision.
