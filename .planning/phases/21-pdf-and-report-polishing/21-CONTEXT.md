# Phase 21: PDF and Report Polishing - Context & Requirements

## User Requirements Breakdown

### 1. Web View Stationery Header Standardization
- **Reference Standard**: The header currently on the **Party Wise** tab (`src/components/party-report-view.tsx`) is considered perfect.
- **Goal**: Replicate this exact official stationery header format across all other report tabs:
  - `Stock` (`src/components/stock-report-view.tsx`)
  - `Sales` (`src/components/new-sales-report-view.tsx`)
  - `Product Wise` (`src/components/product-report-view.tsx`)
  - `Free Scheme` (`src/components/free-scheme-report-view.tsx`)
  - `Overdue` (`src/components/overdue-report-view.tsx`)
- **Key Elements**:
  - Asmee Pharma logo (`/logo.png`)
  - Full company name: `ASMEE PHARMA PRIVATE LIMITED`
  - Address: `BASEMENT-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD, RAOPURA, VADODARA - 390001, GUJARAT - 24`
  - Contacts: `Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com`
  - Metadata divider with Year (`2026-27`), dynamic Report Title for Period (`DD/MM/YYYY to DD/MM/YYYY`), and count/summary statistics.

### 2. PDF Download & Report Engines
- **Party Wise PDF**:
  - Currently not generated (was missing dedicated handler and misrouted to Outstanding buttons).
  - Implement dedicated `generatePartyWisePdfReport` in `src/lib/pdf.ts` and wire up in download buttons and API endpoint.
- **Product Wise PDF**:
  - Currently exports generic grouped columns instead of matching the actual web view.
  - Replicate exact web table structure: `Item Code`, `Item Name`, `Packing`, `Batch No`, `Exp Date`, `Qty`, `Free`, `Rate`, `Amount`.
- **Match Web View as Exact Replica**:
  - The generated PDF must mirror the web view's layout, columns, styling, font hierarchy, party/category group banners, and subtotals/grand totals.
- **Stock Movement PDF Zero-Transaction Filter**:
  - Web view hides items with 0 transactions.
  - Fix PDF generation (`generateStockPdfReport` and `/api/reports/download-stock`) so products with zero movement/transactions are excluded, preventing multi-page elongation.

### 3. UI Issues & Polish
- **Party Tab PDF Button Color**:
  - The download button was rendering red because `OutstandingDownloadButtons` was used on `activeTab === "party"`.
  - Fix button color to match standard blue/navy/indigo UI theme, and wire up to party sales download.
- **Sticky / Persistent Top Header**:
  - Keep MR profile name, division filter, date range picker, download buttons, and tab bar sticky/visible.
  - Avoid unmounting the entire dashboard when switching tabs or changing date ranges.
- **Targeted Loading State**:
  - Show a clear skeleton/spinner loader over the report table during data fetching, preventing stale data display and repeated button clicks.
- **Collapsible Sidebar with Icons**:
  - Add icons (using `lucide-react`) to navigation items in both MR (`src/app/(mr)/layout.tsx`) and Admin (`src/app/admin/layout.tsx`).
  - Add a collapse toggle button to allow collapsing into an icon-only or hidden rail.
- **Mobile UX**:
  - Improve touch interactability: horizontal scroll indicators/affordance for wide report tables, responsive header spacing, and touch-friendly button targets.
- **Home Page Visuals**:
  - Fix logo contrast against `#020817` dark background (add light container/pill or suitable backdrop).
  - Fix any cut-off text or responsive layout issues in hero and features section.
