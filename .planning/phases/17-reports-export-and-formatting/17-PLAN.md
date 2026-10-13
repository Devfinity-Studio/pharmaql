# Phase 17 Plan: Reports Export and Formatting Improvements

## Objectives
1. Standardize and enhance report export formats (CSV / Excel / PDF) across Stock, Sales, Overdue, and Free Scheme reports.
2. Ensure consistent date filtering with financial year defaults, range presets, and seamless propagation to export endpoints.
3. Polish PDF generation and print formatting in `src/lib/pdf.ts` to prevent column clipping and ensure crisp multi-page table outputs.
4. Validate end-to-end download workflows and confirm zero TypeScript errors and clean production builds.

---

## Tasks & Waves

### Wave 1: Date Filter Synchronization & Presets
- [x] Audit date filter state across all report views (`stock-report-view.tsx`, `party-report-view.tsx`, `product-report-view.tsx`, `overdue-report-view.tsx`, `free-scheme-report-view.tsx`).
- [x] Ensure date ranges consistently default to FY 2026-27 (`2026-04-01` to current date) and respect URL parameters.
- [x] Add quick date range selection presets (e.g. "Full FY", "This Month", "Last Month", "Last 90 Days") in date filter bars.

### Wave 2: Export Data & Filename Standardization
- [x] Standardize CSV/Excel export endpoints (`download-stock`, `download-sales`, `download-outstanding`) with clean column ordering, numeric decimal formatting, and summary total rows.
- [x] Ensure standardized export filenames: `<MRName>_<Division>_<ReportType>_<FromDate>_to_<ToDate>.<ext>`.
- [x] Align download modal dialogs in `report-download-buttons.tsx` and `outstanding-download-buttons.tsx` with synchronized date boundaries.

### Wave 3: PDF Generation & Print Layout Polish
- [x] Refine `generateStockPdfReport`, `generatePdfReport`, and specialized PDF formatters in `src/lib/pdf.ts`.
- [x] Optimize column widths and autoTable styles for dense table views (Stock balance, Outstanding ageing buckets).
- [x] Ensure header logo, title, MR name, and generation timestamps are cleanly positioned on every page.

### Wave 4: Verification & Build
- [x] Run `pnpm run check:write` with Biome.
- [x] Run `pnpm run typecheck` (`tsc --noEmit`).
- [x] Run `pnpm run build` and `npm run build` in `api-server` to confirm 0 build errors.
- [x] Commit and push to `localdb` and `prod`.
