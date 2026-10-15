# Phase 23: Developer Options & Developer Account - Context & Requirements

## Objectives
Introduce a comprehensive Developer role and Developer Control Center in PharmaQL. Provide engineering diagnostics, system telemetry, safe read-only procedure testing, MR view-as simulation, and runtime rate-limit/cache management—while guaranteeing zero database writes to the read-only ERP database.

---

## 1. Developer Role Architecture & Access Control
- **Role Differentiation**:
  - `ADMIN`: Business administrator (manages notices, company mappings, unblock overrides, view reports).
  - `DEVELOPER`: Superuser engineer (all admin capabilities + low-level system diagnostics, runtime cache flushes, MR impersonation, and stored procedure benchmarks).
- **Layout & Middleware Gates**:
  - Update `src/app/admin/layout.tsx` to permit both `ADMIN` and `DEVELOPER`.
  - Display distinct purple/cyan "DEVELOPER" pill badge in header and sidebar.
  - Route `/admin/dev` (or `/admin/developer-options`) restricted strictly to `session.user.role === "DEVELOPER"`.

---

## 2. Developer Control Center (`/admin/dev`)
A single command-center screen for developers containing:
- **System Telemetry & Health Cards**:
  - Express API Server latency & connectivity.
  - Database pool status (active connections, idle connections).
  - Node.js runtime metrics (process uptime, RSS memory, heap usage, Node version).
  - Environment sanity check (API Secret set, DB host, ERP database name).
- **Rate Limit & Security Reset Tool**:
  - View currently tracked IP / account rate limit buckets.
  - One-click "Flush Rate Limits" action to instantly unban/unlock a locked IP during testing.
- **Cache Management**:
  - Flush in-memory master data caches (`m_customer`, `m_item`, `m_mktcompany`).
  - Reload `mr_overrides.json` and verify sync state.

---

## 3. MR Impersonation & "View-As" Mode
- **Feature**:
  - Allow developers to view the platform as any specific MR (e.g. testing MR with Rank 1 Stock only vs. Rank 2 vs. Rank 3, or overdue blocked MR).
  - Implemented via a temporary preview cookie or developer session switch that does not modify the database or destroy the developer's master session.
  - Sticky top amber/purple banner: `"Viewing as MR: [MR Name] ([Code]) - [Exit Preview]"`.
  - One-click exit back to Developer Panel.

---

## 4. Stored Procedure Playground & Benchmark Tool
- **Sandbox**:
  - Safe interface to run read-only stored procedures:
    - `rptStockMovementStatement`
    - `rptItemCustomerSale`
    - `rptMRwisePeriodicalOutstanding`
    - `rptClaimData`
  - Input custom parameters: `from`, `to`, `mrId`, `companyCode`, `locNo`.
  - Returns row count, execution duration (ms), column schema, and formatted JSON/table snippet.
  - Strictly blocked from running `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`.

---

## 5. Verification & Quality Gates
- Verify developer login with `DEV_EMAIL` and `DEV_PASSWORD`.
- Verify `/admin/dev` access control (denied for MR and pure ADMIN; granted for DEVELOPER).
- Verify MR "View-As" mode and return to Developer portal.
- Verify rate limit flush and cache reload.
- Full TypeScript typecheck and production Next.js build validation.
