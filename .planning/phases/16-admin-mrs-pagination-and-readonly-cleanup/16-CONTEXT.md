# Phase 16 Context: Admin MR Pagination, Infinite Scroll & Read-Only Cleanup

## Background & Problem Statement
The `/admin/mrs` page suffers from severe latency and page load times because:
1. It queries the entire MR directory from the database on initial render (`getAllMRUsers()`).
2. Even worse, it executes `evaluateMROverdueStatus(lmr.id)` across **every MR simultaneously in parallel** via `Promise.all()`. Each evaluation invokes the heavy `rptMRwisePeriodicalOutstanding` stored procedure through HTTP round-trips to the `api-server`. Running dozens of procedure executions on a single page load saturates database connections and degrades performance.
3. The page currently includes an "Add MR" button and dialog (`add-mr-button.tsx`) invoking `createMR()`. However, the software connects to a read-only legacy ERP database and cannot insert new user records into the ERP tables.

## Scope of Phase 16
1. **Paginated & Infinite Scroll Loading for `/admin/mrs`**:
   - Provide a paginated API/Server Action (`getPaginatedMRs(page, pageSize, searchQuery, sortQuery)`) returning 10 MRs per batch with total count and hasMore indicators.
   - Implement client-side infinite scroll or interactive batch loading in `/admin/mrs` using an IntersectionObserver or paginated card feed.
   - Defer overdue evaluation: only evaluate overdue status for the visible/loaded 10 MRs, or lazy-load overdue badges so initial render is instantaneous.
2. **Read-Only Cleanup & Removal of "Add MR"**:
   - Remove the "Add MR" button from `/admin/mrs`.
   - Delete `src/app/admin/mrs/add-mr-button.tsx`.
   - Remove `createMR` action from `src/server/actions/mrs.ts`.
3. **Database Write Audit**:
   - Audit and document all persistence mechanisms across the codebase to prove that the database layer is 100% read-only and highlight any file-based fallback stores.
