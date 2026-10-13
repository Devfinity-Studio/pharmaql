# Phase 19: Admin MR Management & UI Diagnostics Hardening Plan

## Phase Goal
1. Completely remove all debug query banners and diagnostic blocks from report components in the codebase (not just visually gating them behind URL query parameters).
2. Cleanly harden MR pagination (10 items per batch), instant live search across all MR and assigned manufacturer fields, and multi-option sorting on `/admin/mrs`.
3. Verify clean TypeScript compilation and production build stability.

---

## Tasks

### Task 1: Complete Removal of Debug Query Banners from Component Code
- **Files**:
  - `src/components/overdue-report-view.tsx`
  - `src/components/product-report-view.tsx`
  - `src/components/stock-report-view.tsx`
  - `src/components/party-report-view.tsx`
  - `src/components/mr-dashboard-content.tsx`
  - `src/components/free-scheme-report-view.tsx`
- **Action**: Completely remove the JSX debug banner blocks and unused debug code instead of hiding behind `searchParams?.debug`.

### Task 2: Robust MR 10-Item Batch Pagination, Search, and Sort
- **Files**:
  - `src/server/actions/mrInfo.ts`
  - `src/app/admin/mrs/MRSearchForm.tsx`
  - `src/app/admin/mrs/MRListInfiniteScroll.tsx`
- **Action**:
  - Perform in-memory multi-field search and sorting on merged MR data before slicing 10 items per page.
  - Ensure debounced search and instant sort push cleanly without race conditions.
  - Ensure infinite scroll loads next batches and resets on filter changes.

### Task 3: Verification & Build Validation
- **Action**: Run `pnpm run typecheck` (`tsc --noEmit`) and verify clean console and UI without errors.
