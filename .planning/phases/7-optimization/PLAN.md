# Phase 7 Plan: Performance Optimization & UI Loading States

## 1. Goal
Dramatically improve the application's speed, especially report loading times, and enhance the UX by implementing skeleton loaders, explicit loading states, and smooth transitions during tab and date changes.

## 2. Solutions for Loading Times

### Database Level (The core bottleneck)
The legacy tables (`pg-drizzle_legacy_h_sale`, `pg-drizzle_legacy_l_sale`, etc.) contain hundreds of thousands of rows. Without proper indexing, every report query performs a full table scan.
- **Action**: Add B-Tree indexes on frequently filtered and joined columns.
  - Columns: `MR Name`, `Company`, `Inv. Dt.`, `Party`, `Item Code`.

### React / Frontend Level
Currently, changing a tab or a date might block the UI or leave the old data on the screen until the new data arrives, which feels unresponsive.
- **Action 1 (useTransition)**: Wrap state updates (like tab switching and date changes) in `startTransition`. This keeps the UI responsive while the next report fetches.
- **Action 2 (Suspense & Skeletons)**: Instead of the UI looking frozen, we will show "Skeleton" loading rows (animated placeholders) when data is being fetched.
- **Action 3 (Button Loaders)**: Any button that triggers a heavy action (like downloading a PDF or saving a form) will display a spinner and enter a disabled state.

## 3. Step-by-Step Implementation Plan

### Step 1: Database Indexing
- Update `src/server/db/schema.ts` to add `index(...)` to the legacy tables.
  - E.g., `index("idx_legacy_l_sale_mr_company").on(table["MR Name"], table["Company"])`
- Run `db:push` or generate a migration to apply these indexes to the Postgres database.

### Step 2: Tab & Date Filter Transitions
- In `src/app/(mr)/dashboard/page.tsx` (and other heavy pages), use `useTransition` or manage `isPending` states when URL search parameters (`tab`, `from`, `to`) change.
- When `isPending` is true, render a Skeleton component instead of the stale data table.

### Step 3: Implement Skeleton Components
- Create a `TableSkeleton` component in `src/components/ui/skeleton.tsx` (using standard `shadcn` skeleton or custom Tailwind pulse animations).
- Integrate it into the `ReportTable`, `StockTable`, and `OverdueTable` components to show a loading state when data is being fetched or when a transition is active.

### Step 4: Component-Level Preloaders
- Ensure `ReportDownloadButtons` and `OutstandingDownloadButtons` properly show a loading spinner on the button itself while the PDF is generating, preventing double-clicks and providing immediate feedback.

### Step 5: Data Fetching Optimization (If necessary)
- Audit the API routes (`/api/reports/...`) to ensure Drizzle queries are as lean as possible.
- If data size is still an issue, implement pagination or lazy loading for the data tables.

## 4. Verification
- Verify that clicking different tabs immediately shows a skeleton loader instead of stalling.
- Verify that changing date filters shows a loading state.
- Verify that DB query times are significantly reduced (from multiple seconds down to milliseconds).
- Ensure no PDF or report button can be spammed while it's already generating.
