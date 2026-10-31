# Phase 42 Plan: Overdue Report Alignment with Technomax ERP & Dynamic Tenant Thresholds

## Overview
Align the Overdue (MRwise Periodical Outstanding) report display, data calculations, Excel/PDF exports, and overdue blocking thresholds with the official Technomax ERP statement format (`rptMRwisePeriodicalOutstanding`).

---

## 1. Key Objectives & Deliverables

### A. API Procedure Call Parameter Fix (`api-server/src/routes/reports.ts`)
- In `reportsRouter.post("/mr-overdue")`:
  - Parameter 4 (`p_Recdate` in the stored procedure) was previously hardcoded to `odbcFinYearStart` (`2026-04-01`), discarding all receipt voucher adjustments made during the financial year.
  - Fix: Set `p_Recdate` to `odbcToDate` (or cutoff date), ensuring `left outer join view_adjdetails as V on B.AgainstLedgerID=V.LedgerID and V.DocDate<=p_Recdate` includes all payment adjustments up to the requested statement date.

### B. Exact Layout & Hierarchy Match in Portal View (`src/components/overdue-report-view.tsx`)
- Transform the report table to match the exact ERP printout hierarchy:
  - **MR Header**: `MR : <MR Name>`
  - **City / Area Header**: `City/Area: <City> - <Area>`
  - **Party Header**: `<CustCode> - <Customer>, <Address1>` with `Opening :`
  - **Table Columns**:
    1. `Doc Type` (e.g. `SALE`)
    2. `Inv. Date` (`DD/MM/YYYY`)
    3. `Invoice No.` (e.g. `R08519`)
    4. `Due Date` (`DD/MM/YYYY`)
    5. `Due Days` (raw signed integer from ERP: e.g. `-24`, `+20`)
    6. `Invoice Amount` (`Amount` formatted to 2 decimals)
    7. `Received Amount` (`AdjAmt` formatted to 2 decimals)
    8. `Received Date` (`RecDate` / `DD/MM/YYYY` if adjusted)
    9. `Pending Amount` (`Invoice Amount - Received Amount`)
    10. `Cumm. Total` (running cumulative total of pending balance per party)
  - **Subtotals & Summaries**:
    - Party Subtotal: `Outstanding of <Customer> : <Inv Amount> | <Received Amount> | <Pending Amount>`
    - MR Subtotal: `Outstanding of <MR Name> : <Inv Amount> | <Received Amount> | <Pending Amount>`
    - Grand Total: `<Total Inv Amount> | <Total Received Amount> | <Total Pending Amount>`
  - **Overdue Styling**:
    - Highlight rows in amber/red when `Due Days <= -tenant.overdueDirectBlockDays` (or nearing threshold).

### C. Dynamic Tenant Overdue Blocking Days Mapping (`src/lib/overdueUtils.ts` & `src/server/actions/overdueEngine.ts`)
- Replace hardcoded `90` / `95` days with dynamic tenant configuration:
  - Accept `directBlockDays` (from `tenant.overdueDirectBlockDays` or header `x-tenant-overdue-direct`, default 90) and `divisionBlockDays` (from `tenant.overdueDivisionBlockDays`, default 95).
  - Warning threshold dynamically set to `(directBlockDays - 10)` to `directBlockDays`.
  - Block calculation evaluates overdue days against dynamic limit.

### D. Excel & PDF Export Standardization (`src/app/api/reports/download-outstanding/route.ts` & `src/components/outstanding-download-buttons.tsx`)
- Update Excel export and PDF generation:
  - Columns: `Doc Type`, `Inv. Date`, `Invoice No.`, `Due Date`, `Due Days`, `Invoice Amount`, `Received Amount`, `Received Date`, `Pending Amount`.
  - Grouping by `MR Name` -> `City / Area` -> `Party`.
  - Dynamic company letterhead branding matching client onboarding parameters (`displayName`, `address`, `phone`, `email`, `gstin`, `logoUrl`).

---

## 2. Verification Plan
- [ ] TypeScript compilation (`pnpm exec tsc --noEmit`).
- [ ] Vitest unit tests execution (`pnpm test`).
- [ ] Next.js production build (`pnpm run build`).
- [ ] Preview smoke test on Vercel (`prod` branch).
