# Architecture

**Date Mapped:** 2026-10-23  
**Project:** PharmaQL (B2B Medicine Supplier Portal)

---

## 1. System Overview

PharmaQL operates on a **decoupled, multi-tier enterprise architecture** designed to bridge a modern web interface with a legacy on-premises ERP database:

```
[ Browser / PWA Client ]
         │  (HTTPS / Next.js Server Actions / Cookies)
         ▼
[ Next.js 15 App Router (BFF Layer) ]
   ├── Authentication & RBAC (Stateless JWT / Jose)
   ├── Domain Rule Engines (Overdue Cascading Blocking, MR Ranking)
   ├── Resilient Storage Engine (data/*.json ⇄ /tmp fallback)
   └── PDF / Excel Export Pipeline
         │  (Internal HTTPS / Bearer Token Auth)
         ▼
[ PharmaQL API Gateway (api-server) ]
   ├── Express.js REST Service (Port 9443)
   ├── IP Rate Limiting & Auth Middleware
   └── In-Memory Response Caching
         │  (mysql2 Connection Pool)
         ▼
[ On-Premises Legacy MySQL ERP ]
   ├── pdyasvtrans (Transactional: Sales, Stock, Outstandings)
   └── pdyasvmaster (Master: MRs, Divisions, Companies)
```

---

## 2. Key Architecture Layers

### A. Presentation Layer (Frontend & Client)
- **Next.js 15 App Router (`src/app/`):** Utilizes React Server Components (RSC) for page data fetching, layouts, and initial renders, dramatically reducing client-side bundle size.
- **Client Components (`src/components/`):** Loaded on demand for interactive widgets:
  - `mr-dashboard-content.tsx`: Dynamic MR dashboard with live overdue notices, report tabs, and company filter selectors.
  - `free-scheme-report-view.tsx`, `stock-report-view.tsx`, `overdue-report-view.tsx`: Client-side virtualized report tables with sorting, search filtering, and pagination.
  - `dev-control-center.tsx`: Comprehensive administrative diagnostics and runtime management dashboard.
  - `offline-report-viewer.tsx` & `offline-indicator.tsx`: PWA offline snapshot visualization.

### B. Backend-For-Frontend (BFF) & Server Actions (`src/server/actions/`)
- Instead of traditional REST controller endpoints, data operations, form submissions, and database proxy calls are implemented as **Next.js Server Actions** (`"use server"`).
- Each Server Action handles request validation (`zod`), checks stateless session authentication (`src/server/auth.ts`), enforces permissions, logs audit events, and communicates with `api-server` via `src/lib/api-client.ts`.

### C. Authentication & Role-Based Access Control (RBAC)
- **Stateless JWT (`jose`):** Eliminates database lookups for session validation. The user payload is cryptographically signed and stored in the HTTP-only `pharmaql_session` cookie.
- **Three Core Roles:**
  1. **ADMIN:** Supplier management with global visibility across all MRs, companies, and reports.
  2. **DEVELOPER:** Super-admin account with full system diagnostics, live user presence monitoring, license controls, and the ability to **impersonate any MR** without knowing their credentials.
  3. **MEDICAL REPRESENTATIVE (MR):** Isolated field representatives who can only access data belonging to their assigned companies, divisions, and MR IDs. Login is strictly passwordless via 6-digit numeric OTP sent to their registered ERP email.

---

## 3. Core Domain & Business Rule Engines

### 1. Overdue & Cascading Blocking Engine (`src/server/actions/overdueEngine.ts`)
A critical business requirement for Asmee Pharma: field representatives are held accountable for overdue client invoice payments.
- **Evaluation States:**
  - `CLEAN`: No outstanding invoices exceeding payment thresholds.
  - `WARNING` (80–90 days overdue): Banner notifications and impending block modals alert the MR to follow up on collection.
  - `DIRECT_BLOCKED` (>90 days overdue): The MR's account is locked immediately. Access is restricted to a "Contact Admin" notice.
  - `DIVISION_BLOCKED` (>95 days overdue): **Cascading Collateral Block**. If any MR in a shared division has an overdue invoice exceeding 95 days, all peer MRs in that division are blocked to encourage collective team accountability. The UI explicitly identifies the responsible MR and invoice.
  - `MANUAL_BLOCKED`: Explicit administrative lock.
- **Admin Exemptions:** Admins can grant temporary overrides with structured reasons and expiry timestamps.

### 2. MR Ranking-Based Permission Matrix (`src/lib/permissions.ts`)
MR accounts possess a hierarchical Rank (1, 2, or 3) derived from ERP job profiles (`JobProfile`) or database rank columns:
- **Rank 1 (MR):** Stock Movement Statement and Stock & Sales Statement reports only.
- **Rank 2 (ABM / Area Business Manager):** Stock reports + Claim Quantity (Free Scheme) reports.
- **Rank 3 (RSM / Regional Sales Manager / Top Reps):** Full access to all reports including sales, party-wise, and product-wise breakdowns.

### 3. Commercial Licensing & Killswitch (`src/lib/license.ts`)
- Manages subscription status (`ACTIVE`, `EXPIRED`, `SUSPENDED`).
- Enforces hard expiration dates with an automated 7-day grace period.
- Includes a remote killswitch toggle and automated email alerts sent to developers when licenses near expiration.

### 4. Dynamic Maintenance & Feature Toggles (`src/lib/maintenance.ts`)
- Allows runtime activation of maintenance mode (`DISABLED`, `MRS_ONLY`, `ALL_USERS`) with custom ETA and reason messaging.
- Granular feature toggling per report module (Stock, Sales, Claim, Overdue, Export).

### 5. Resilient Server Storage (`src/lib/server-storage.ts`)
- Solves the serverless read-only filesystem problem on Vercel and AWS Lambda (`EROFS`).
- Reads from local `process.cwd()/data` or fallback bundled data, and atomically writes to `os.tmpdir()/pharmaql-data` whenever running under serverless environments.

### 6. Sanitized Offline Storage (`src/lib/offline-store.ts`)
- Client-side IndexedDB store (`pharmaql_offline_db`) caching report snapshots for field reps in low-connectivity areas.
- Guarantees strict cryptographic per-MR fencing, automatic multi-MR purge on device switch/logout, and automated 48-hour TTL eviction.

---

## 4. Security Architecture & Request Flow

1. **Edge Middleware (`src/middleware.ts`):**
   - Injects a unique `x-request-id` (Correlation UUID) on every inbound request.
   - Normalizes client IP addresses (`x-client-ip`).
   - Restricts `/admin` paths to authorized administrative IP addresses/ranges.
   - Protects `/api/debug` in production environments.
2. **HTTP Headers (`next.config.js`):**
   - Implements HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).
   - Strict Content Security Policy (CSP), Frame Options (`DENY`), and nosniff rules.
3. **Sliding-Window Rate Limiting (`src/lib/rate-limit.ts`):**
   - In-memory rate limiting prevents credential stuffing on login, OTP spamming (5 requests/10 min), and report export flooding.
4. **Audit Trail (`src/lib/audit-logger.ts`):**
   - Automatically records all security events, logins, failures, OTP verifications, admin unblocks, and rate-limit violations into a sliding 1,000-entry immutable log.
