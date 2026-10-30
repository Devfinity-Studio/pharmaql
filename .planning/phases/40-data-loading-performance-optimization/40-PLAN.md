# Phase 40 Plan: Data Loading Performance Optimization & Query Latency Reduction

## Objective

Radically reduce data loading times for Medical Representatives and Administrators across all statement views (Stock Movement, Stock & Sales, Outstandings, and Item Catalogs). Address the root causes of latency: uncompressed multi-megabyte JSON network payloads, repetitive cold stored procedure executions on the on-premise ERP MySQL database, and lack of client-side request deduplication and caching.

---

## Architectural Guardrails

1. **Multi-Tenant Safety & Data Isolation**:
   - Cache keys must ALWAYS incorporate `tenantId` (or `tenantSlug`), `compNo`, `locNo`, and user scope parameters (such as `mrCode` or `assignedCompanies`) to ensure zero cross-tenant or cross-MR data leakage.
2. **Freshness & Invalidation**:
   - Master data (catalogs, company lists, MR profiles) can safely be cached for 10-15 minutes.
   - Dynamic transactional reports (Stock Movement, Stock & Sales, Outstandings) should use a 2 to 5-minute cache with a manual "Refresh / Sync Now" button that busts the cache for the active tenant.
3. **Payload Compression (Gzip / Brotli)**:
   - On the on-premise `api-server`, enable standard HTTP `compression` middleware to reduce 2-8MB raw JSON payloads down to ~200-500KB (85-90% network transfer time reduction).
4. **Zero-Latency In-Flight Request Deduplication**:
   - When multiple MRs or views request identical statement parameters simultaneously, deduplicate the in-flight promise in `src/lib/api-client.ts` so the legacy database is only queried once.
5. **Edge & Serverless Compatibility**:
   - Caching mechanisms in Next.js must remain serverless-safe (using in-memory LRU / Next.js Data Cache / Upstash key-value store where available) without memory leak risks.
6. **Zero Regression Guarantee**:
   - All 21 Vitest test suites (118 tests) must pass throughout and after all changes.
   - TypeScript checks (`tsc --noEmit`) and production build (`next build`) must compile cleanly.

---

## Detailed Task Breakdown

### Task 1: On-Premise API Server Compression & Stored Procedure Caching
- **Files**:
  - `api-server/package.json`
  - `api-server/src/index.ts`
  - `api-server/src/cache.ts`
  - `api-server/src/routes/reports.ts`
  - `api-server/src/routes/master.ts`
- **Implementation**:
  1. Install `compression` and `@types/compression` in `api-server`.
  2. In `api-server/src/index.ts`, mount `compression()` middleware right before routing to automatically gzip/deflate all outgoing JSON responses over 1KB.
  3. In `api-server/src/cache.ts`:
     - Enhance `getOrSetCache` with an LRU capacity cap (max 200 entries) to prevent unbounded memory growth on long-running Windows services.
     - Add `cacheStats()` diagnostic helper to monitor cache hit ratios and memory footprint.
  4. In `api-server/src/routes/reports.ts`:
     - Wrap heavy report endpoints (`/stock-movement`, `/stock-and-sales`, `/customer-item-sale`, `/party-item-sale`, `/mr-overdue`, `/claim-data`) in `getOrSetCache` with a 180-second (3-minute) TTL keyed by normalized parameters:
       `cacheKey = reports:${route}:${compNo}:${locNo}:${effectiveFrom}:${effectiveTo}:${sortedCompanyCodes}`
     - Allow an optional header `x-bypass-cache: true` for forced revalidation.
  5. In `api-server/src/routes/master.ts`:
     - Cache `/api/master/catalog` and `/api/master/mrs` with a 600-second (10-minute) TTL.
     - Add `/api/cache/flush` endpoint protected by API key to allow manual cache clearing.

---

### Task 2: PharmaQL Server-Side In-Flight Request Deduplication & Tier-2 Caching
- **Files**:
  - `src/lib/api-client.ts`
  - `src/lib/__tests__/api-client.test.ts`
- **Implementation**:
  1. In `src/lib/api-client.ts`:
     - Implement in-memory cache and in-flight promise deduplication map:
       ```ts
       const inFlightRequests = new Map<string, Promise<any>>();
       const serverCache = new Map<string, { data: any; expiresAt: number }>();
       ```
     - For `apiGet` and `apiPost`, calculate a deterministic cache key:
       `${tenantSlug}:${method}:${path}:${hashOfParams}`
     - If an identical query is already pending execution, join the existing promise instead of opening a second HTTP connection to the on-premise ERP.
     - Support optional `ttlSeconds` parameter in `apiGet` and `apiPost` (defaulting to 60s for statements, 300s for master data).
     - When `forceRefresh: true` is passed, bypass the server cache and fetch fresh data from the bridge.
  2. Update unit tests in `src/lib/__tests__/api-client.test.ts` to verify in-flight deduplication and cache TTL behavior.

---

### Task 3: React Query Cache Tuning & Background Revalidation
- **Files**:
  - `src/trpc/query-client.ts`
  - `src/components/stock-report-view.tsx`
  - `src/components/stock-and-sales-view.tsx`
  - `src/components/outstanding-view.tsx`
- **Implementation**:
  1. In `src/trpc/query-client.ts`:
     - Tune React Query default options:
       - `staleTime: 2 * 60 * 1000` (2 minutes before marking data stale)
       - `gcTime: 10 * 60 * 1000` (10 minutes in memory before garbage collecting)
       - `refetchOnWindowFocus: false` (stops jarring full-table reloads whenever user switches windows/tabs)
       - `refetchOnReconnect: true`
  2. Add an explicit **"Sync / Refresh Data"** button with a spinning refresh icon on statement views:
     - Allows users to force-refresh when they know an order was just booked in Technomax.
     - Clears the active query cache and passes `forceRefresh: true` to the server action.

---

### Task 4: UI Streaming, Suspense Skeletons & Rendering Performance
- **Files**:
  - `src/app/dashboard/loading.tsx`
  - `src/components/table-skeleton.tsx`
  - `src/components/stock-report-view.tsx`
- **Implementation**:
  1. Create lightweight, realistic SVG/CSS skeleton placeholders ([`src/components/table-skeleton.tsx`](file:///e:/work/pharmaql/src/components/table-skeleton.tsx)) matching the exact grid geometry of statement tables.
  2. Ensure React Suspense boundaries wrap large statement grids so navigation is instant, displaying immediate skeleton feedback instead of a white screen or frozen browser tab.
  3. Optimize client-side table rendering with virtualized pagination (or 50/100 row batch rendering with Next.js page controls) so client mobile devices don't choke when rendering 1,500+ DOM rows.

---

### Task 5: End-to-End Latency Benchmarking & Production Verification
- **Files**:
  - `scripts/benchmark_latency.mjs`
  - `40-UAT.md`
- **Implementation**:
  1. Create a latency measurement script to benchmark:
     - Cold query response time vs. Cached response time.
     - Uncompressed payload size vs. Gzipped payload size.
     - Concurrent request handling under simulated multi-MR load.
  2. Verify:
     - `pnpm test` (all 21 test suites pass).
     - `pnpm exec tsc --noEmit` (0 type errors).
     - `pnpm run build` (Next.js production build passes).
  3. Deploy to `dev`, merge to `prod`, sync to `deploymment`, and verify live performance improvements on `pharmaql.devfinity.net` and `asmeepharma.com`.
