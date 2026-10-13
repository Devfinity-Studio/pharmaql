# Phase 16 Plan: Admin MR Pagination, Infinite Scroll & Read-Only Cleanup

## Objectives
1. Eliminate page freeze and slow query performance on `/admin/mrs` by transitioning from eager bulk loading to paginated 10-per-batch loading with infinite scroll.
2. Remove the "Add MR" button and obsolete write actions (`createMR`) since the database is read-only.
3. Optimize overdue evaluation so it only evaluates visible MRs or executes on-demand, rather than running stored procedures on all MRs at once.
4. Verify TypeScript compilation and production builds with zero errors.

---

## Tasks & Waves

### Wave 1: Read-Only Cleanup (Removal of "Add MR")
- [ ] Remove `<AddMRButton />` from [src/app/admin/mrs/page.tsx](file:///e:/work/pharmaql/src/app/admin/mrs/page.tsx).
- [ ] Delete dead component file `src/app/admin/mrs/add-mr-button.tsx`.
- [ ] Remove `createMR` server action from [src/server/actions/mrs.ts](file:///e:/work/pharmaql/src/server/actions/mrs.ts).

### Wave 2: Backend Pagination & Overdue Scoping
- [ ] Add pagination support in [src/server/actions/mrInfo.ts](file:///e:/work/pharmaql/src/server/actions/mrInfo.ts) (or API endpoint): `getPaginatedMRs({ page, limit, search, sort })`.
- [ ] Scope overdue status evaluation so only the active batch (10 MRs) evaluates overdue status, or provide an on-demand server action for overdue badges.
- [ ] Keep the top summary overdue section decoupled or cached with a lightweight summary.

### Wave 3: Frontend Infinite Scroll UI for `/admin/mrs`
- [ ] Create a client-side MR feed component `MRListInfiniteScroll.tsx` (or update `/admin/mrs/page.tsx`) with an IntersectionObserver trigger.
- [ ] Initial render renders the first 10 MRs immediately with instant response time.
- [ ] Scrolling near the bottom automatically fetches the next batch of 10 MRs without page refresh.
- [ ] Provide seamless search and sort state integration.

### Wave 4: Verification & Build
- [ ] Run `pnpm run check:write` to ensure Biome formatting and lint compliance.
- [ ] Run `pnpm run typecheck` to verify zero TypeScript errors.
- [ ] Run `pnpm run build` and `npm run build` in `api-server` to confirm production bundle readiness.
- [ ] Git commit and push changes.
