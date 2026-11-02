# Phase 45: Expiry Reporting for Company Items - Context

## Overview
Implement comprehensive Batch Expiry & Near-Expiry Reporting for company items across Technomax ERP, allowing Medical Representatives (MRs), Area Managers, and Administrators to monitor stock batches nearing expiration or already expired, analyze financial risk, and prevent unsaleable inventory buildup.

## Core Requirements & Domain Logic
1. **Target Audience & Scope**:
   - Company/Division-wide listing of products with their active batch numbers, expiration dates, and current stock balances.
   - Filterable by Company/Division, Manufacturer, Expiry Horizon (Expired, 30 days, 60 days, 90 days, 180 days, All), and Search (Item Name, Item Code, Batch No).

2. **Key Data Fields Required**:
   - `ItemCode`: Product Code in ERP
   - `ItemName`: Product Brand Name
   - `Packing`: Packaging description (e.g., `10x10`, `100ml`)
   - `Division` / `CompCode`: Marketing company / division
   - `BatchNo`: Manufacturing batch identifier
   - `ExpDate`: Expiration date (MM/YYYY or DD/MM/YYYY)
   - `DaysToExpiry`: Signed integer (negative = expired, positive = days remaining)
   - `StockQty` / `ClosingQty`: Physical/saleable units available in stock
   - `PTR`: Price to Retailer
   - `MRP`: Maximum Retail Price
   - `StockValue`: `StockQty * PTR` (financial exposure value)

3. **Urgency Classification**:
   - **EXPIRED** (`DaysToExpiry <= 0`): Red badge, critical alert.
   - **CRITICAL** (`1 <= DaysToExpiry <= 30`): Orange badge, immediate liquidation / field action required.
   - **WARNING** (`31 <= DaysToExpiry <= 90`): Yellow badge, monitor closely.
   - **NORMAL** (`DaysToExpiry > 90`): Green badge, standard stock.

4. **Multi-Format Exports**:
   - **PDF & Print**: Styled landscape statement with tenant letterhead stationery, urgency indicators, division headers, subtotals by division/item, and grand total stock & value.
   - **Excel**: Formatted workbook with columns for Batch No, Expiry Date, Days to Expiry, Qty, PTR, MRP, and Total Value with numeric formatting.
   - **CSV**: Complete flat data export for accounting and inventory audits.
