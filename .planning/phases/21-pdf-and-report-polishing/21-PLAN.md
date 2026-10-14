# Phase 21: PDF, Excel, and Report Polishing Plan

## Objective
Polishing PharmaQL's reporting system across both Web and Export (PDF & Excel) views:
1. Replicate the reference stationery header from the Party Wise tab across all report tabs.
2. Fix and standardize high-fidelity PDF generation across ALL tabs (Stock, Party Wise, Product Wise, Sales, Free Scheme, Overdue), eliminating zero-movement clutter in Stock reports.
3. Overhaul Excel (`.xlsx`) generation with auto-fitted column widths, bold headers, and styled summary rows across all download endpoints.
4. Correct download button styling and routing on the Party Wise tab (replacing red button with standard theme).
5. Implement a sticky top control bar with targeted report loaders to eliminate UI freeze/stale data.
6. Enhance sidebars with Lucide icons and smooth collapse/expand functionality.
7. Polish mobile touch interactability and resolve homepage logo contrast/text clipping.

---

## Detailed Implementation Tasks

### Task 1: Reusable Report Stationery Header
- **Create**: `src/components/report-stationery-header.tsx`
  - Replicate the exact design from `party-report-view.tsx`:
    - Asmee Pharma logo (`/logo.png`)
    - Full legal company name: `ASMEE PHARMA PRIVATE LIMITED`
    - Registered office address: `BASEMENT-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD, RAOPURA, VADODARA - 390001, GUJARAT - 24`
    - Contact details & email: `Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com`
    - Divider row with `Year : 2026-27`, dynamic centered report title for date period (`{Title} for Period of {fromDisplay} to {toDisplay}`), and customizable right-aligned summary text/stat badge.
- **Refactor Report Views to use `ReportStationeryHeader`**:
  - `src/components/stock-report-view.tsx`
  - `src/components/new-sales-report-view.tsx`
  - `src/components/product-report-view.tsx`
  - `src/components/free-scheme-report-view.tsx`
  - `src/components/overdue-report-view.tsx`
  - `src/components/party-report-view.tsx`

---

### Task 2: High-Fidelity PDF Generation Engines across All Tabs
- **File**: `src/lib/pdf.ts`
  - **Party Wise PDF (`generatePartyWisePdfReport`)**:
    - Build dedicated jsPDF generator mirroring the web view table.
    - Render stationery header, party grouping headers (`Customer Name [Code] - Area, City`), item rows, party subtotals (`Total for {Customer}`), and grand totals in blue accent font.
  - **Product Wise PDF (`generateProductPdfReport`)**:
    - Align columns to match the 9-column web table: `Item Code`, `Item Name`, `Packing`, `Batch No`, `Exp Date`, `Qty`, `Free`, `Rate`, `Amount`.
    - Group by product / batch with subtotals and grand totals.
  - **Stock Movement PDF (`generateStockPdfReport`)**:
    - Filter out items where Opening Qty, Inward/Purchase, Outward/Sales, and Closing Balance are all zero (no transactions), matching the web view.
    - Ensure clean landscape/portrait auto-wrapping and column width balance.
  - **Sales / Free Scheme / Overdue PDFs**:
    - Verify and standardize header letterhead, column widths, number formatting (`₹` / 2 decimals), page numbering (`Page X of Y`), and typography across `generateSalesPdfReport`, `generateFreeSchemePdfReport`, and `generateGroupedPdfReport`.

---

### Task 3: Excel Generation Overhaul (`.xlsx`)
- **Files**:
  - `src/app/api/reports/download-stock/route.ts`
  - `src/app/api/reports/download-sales/route.ts`
  - `src/app/api/reports/download-outstanding/route.ts`
- **Improvements**:
  - **Auto-Fit Column Widths**: Implement dynamic column width calculation (`worksheet['!cols'] = ...`) based on max cell text length + safety padding so text is never truncated.
  - **Header & Totals Styling**: Ensure column headers and summary/total rows are clearly identified and formatted.
  - **Party Sales Export**: Add `tab=party` support in `download-sales` API returning structured Party Wise customer and item sales data for Excel download.
  - **Numeric Precision**: Format numerical columns with appropriate decimal places instead of raw unpadded floats.

---

### Task 4: Download Buttons & Party Tab Wiring
- **File**: `src/components/mr-dashboard-content.tsx`
  - Fix conditional download buttons on `activeTab === "party"`:
    - Replace `<OutstandingDownloadButtons mrId={mrId} />` with `<ReportDownloadButtons mrId={mrId} />` on the Party tab.
    - Keep `<OutstandingDownloadButtons mrId={mrId} />` strictly for `activeTab === "overdue"`.
- **File**: `src/components/report-download-buttons.tsx`
  - Add `currentTab === "party"` handling:
    - Route to `/api/reports/download-sales?tab=party` (or dedicated party handler).
    - Trigger `generatePartyWisePdfReport` for PDF/print actions.
    - Download formatted `.xlsx` for Excel actions.
- **File**: `src/components/outstanding-download-buttons.tsx`
  - Update PDF button styling from harsh `bg-red-600` to standard `bg-[#0B2545]` / `bg-[#0071BC]` palette to match the rest of the application.

---

### Task 5: Sticky Top Header & Targeted Loading State
- **File**: `src/components/mr-dashboard-content.tsx`
  - Wrap the MR identity card, division switcher, date picker, download buttons, and tab bar in a sticky header container (`sticky top-0 z-30 bg-[#F8FAFC]/95 backdrop-blur-md pb-2`).
- **File**: `src/components/report-loading-container.tsx` (or inline transition wrapper):
  - Isolate the report view rendering below the tab bar so changing tabs or date filters keeps the top controls intact and shows a sleek skeleton/spinner over the data table area instead of unmounting the entire page.

---

### Task 6: Collapsible Sidebar with Lucide Icons
- **Create**: `src/components/collapsible-sidebar.tsx`
  - Reusable client sidebar with expand/collapse state toggle (collapses to a compact 16-18 tailwind width rail with icons, or full width with labels).
  - Add icons using `lucide-react`:
    - MR Portal: `BarChart3` (Overview), `FileSpreadsheet` (Reports), `LogOut`.
    - Admin Portal: `Users` (MR Management), `Building2` (Company Display), `Bell` (Notice Board), `LogOut`.
- **Integrate into**:
  - `src/app/(mr)/layout.tsx`
  - `src/app/admin/layout.tsx`

---

### Task 7: Mobile Responsiveness & Home Page Visual Polish
- **Home Page (`src/app/page.tsx` & `src/components/Header.tsx`)**:
  - Place `/logo.png` in a crisp white/translucent pill badge (`bg-white/95 rounded-xl px-3 py-1.5 shadow-sm border border-white/20`) in `Header.tsx` so the logo is distinctly visible and never blends into `#020817`.
  - Fix any text wrapping/overflow on hero headings and subtitle copy.
- **Mobile Touch Interactability**:
  - Add visible horizontal scroll hint indicators on wide report tables for mobile viewports.
  - Ensure all action buttons and tab links meet standard mobile touch target guidelines (min 44px).

---

### Task 8: Verification & Quality Gates
1. Run `pnpm exec tsc --noEmit` to verify 0 TypeScript compiler errors.
2. Verify all 6 report tabs render the unified stationery header cleanly in web view.
3. Verify PDF generation across all tabs:
   - Stock (zero transactions filtered out)
   - Party Wise (exact replica of web view)
   - Product Wise (exact 9-column table)
   - Sales, Free Scheme, Overdue
4. Verify Excel download across all tabs:
   - Columns are auto-spaced with proper padding.
   - Headers and totals are clear.
5. Verify sticky top bar, targeted loader, collapsible sidebar, and mobile/homepage UI polish.
