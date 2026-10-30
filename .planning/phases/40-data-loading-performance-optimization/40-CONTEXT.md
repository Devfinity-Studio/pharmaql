# Phase 40 Context: Data Loading Performance Optimization & Query Latency Reduction

## Problem Statement
The client reports that data loading speeds across the application are too slow. Medical representatives and administrators encounter noticeable latency when fetching large ERP statements (Stock Movement, Stock & Sales, Outstandings, and Party lists).

## Key Goals
1. **Profile & Diagnose**:
   - Measure request latencies across ERP bridge endpoints, database execution times, and network serialization overhead.
   - Identify whether bottlenecks originate in ODBC stored procedure execution, server-to-client payload sizes, or client-side re-rendering.

2. **Multi-Tier Caching with Background Revalidation**:
   - Implement stale-while-revalidate / TTL caching for static or slow-changing master records (Party catalogs, Company lists, Division mappings).
   - Add cache layer in `api-server` or Next.js server actions to prevent hitting slow legacy ODBC stored procedures on identical consecutive requests.

3. **Payload Optimization & Compression**:
   - Compress high-volume JSON datasets (gzip / brotli).
   - Implement server-side pagination / limit-offset filtering so the client doesn't pull tens of thousands of unused rows at once.

4. **Client-Side Query Optimization**:
   - Optimize React Query `staleTime`, `gcTime`, and prefetching behaviors on hover or route navigation.
   - Implement optimistic transitions and lightweight skeletons to minimize perceived load times.

5. **Legacy ERP Server Connection Pool Tuning**:
   - Review ODBC connection pool sizing and stored procedure parameters in `api-server` to eliminate connection queuing delays.
