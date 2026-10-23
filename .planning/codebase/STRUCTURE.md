# Directory & Codebase Structure

**Date Mapped:** 2026-10-23  
**Project:** PharmaQL (B2B Medicine Supplier Portal)

---

## 1. High-Level Workspace Layout

```
pharmaql/
├── api-server/           # Standalone Express.js API Gateway to legacy MySQL ERP
├── data/                 # JSON file-based application storage (license, audit, toggles)
├── public/               # Static assets, web manifest, icons, favicons
├── scripts/              # Build, asset generation, and utility scripts
├── src/                  # Next.js App Router application source code
│   ├── app/              # Routes, pages, layouts, and API route handlers
│   ├── components/       # Reusable React UI components and report viewers
│   ├── lib/              # Core utility libraries, cryptographic helpers, clients
│   ├── server/           # Server actions, authentication verification, tRPC
│   ├── styles/           # Global styles and Tailwind v4 CSS directives
│   └── trpc/             # Client-side tRPC and React Query configuration
├── .planning/            # GSD project management, roadmap, and state documentation
├── biome.jsonc           # Biome formatting and linting configuration
├── next.config.js        # Next.js runtime configuration & security headers
├── package.json          # Root application dependencies and scripts
├── pnpm-workspace.yaml   # Workspace declaration for root and api-server
└── tsconfig.json         # TypeScript compiler configuration
```

---

## 2. Next.js App Router (`src/app/`)

```
src/app/
├── (mr)/                           # Medical Representative Route Group
│   ├── dashboard/                  # MR personal dashboard with reports & KPIs
│   │   └── page.tsx
│   └── layout.tsx                  # MR layout with session guard, mobile nav, banner
├── admin/                          # Administrative Portal
│   ├── audit/                      # System audit trail logs viewer
│   ├── companies/                  # Company and division assignment management
│   ├── dashboard/                  # Global supplier executive dashboard
│   ├── dev/                        # Developer Control Center & live diagnostics
│   ├── mrs/                        # MR account management, rank & unblock actions
│   ├── notices/                    # Broadcast notice management
│   └── layout.tsx                  # Admin shell with IP authorization and sidebar
├── api/                            # API Route Handlers
│   ├── auth/[...all]/              # Stateless auth endpoints
│   ├── debug/                      # Production-protected diagnostic test endpoints
│   ├── products/                   # Product catalog search and data routes
│   ├── reports/                    # Binary report download endpoints
│   │   ├── download/               # Standard report export proxy
│   │   ├── download-outstanding/   # Overdue outstandings stream
│   │   ├── download-sales/         # Sales data export stream
│   │   └── download-stock/         # Stock movement export stream
│   └── trpc/[trpc]/                # tRPC edge handler
├── license-expired/                # Hard paywall screen when license is suspended/expired
├── login/                          # Unified login portal (MR OTP, Admin/Dev credentials)
├── layout.tsx                      # Root HTML layout with providers and analytics
├── loading.tsx                     # Global loading spinner skeleton
├── manifest.ts                     # PWA dynamic Web App Manifest
└── page.tsx                        # Root route redirector based on session role
```

---

## 3. UI Components (`src/components/`)

- **Navigation & Shell:**
  - `Header.tsx`: Top application navigation bar.
  - `collapsible-sidebar.tsx`: Responsive collapsible sidebar for Admin portal.
  - `mr-mobile-nav.tsx`: Bottom navigation bar optimized for mobile MR field devices.
  - `impersonation-banner.tsx`: Sticky banner shown when a Developer impersonates an MR.
  - `logout-button.tsx`: Secure session teardown button.
- **Reporting Views:**
  - `mr-dashboard-content.tsx`: Primary MR dashboard orchestrator.
  - `stock-report-view.tsx`: Interactive Stock Movement Statement table.
  - `stock-and-sales-report-view.tsx`: Stock & Sales combined transaction view.
  - `free-scheme-report-view.tsx`: Claim Quantity & Free Scheme party allocations.
  - `overdue-report-view.tsx`: Overdue aging breakdown (0–30, 31–60, 61–90, 91+ days).
  - `party-report-view.tsx` & `product-report-view.tsx`: Deep-dive sales matrices.
  - `report-download-buttons.tsx` & `outstanding-download-buttons.tsx`: Client-side PDF and Excel export triggers.
  - `report-stationery-header.tsx`: Standardized printable document headers.
- **Diagnostics, Modals & Notifications:**
  - `dev-control-center.tsx`: Massive multi-tab developer diagnostic panel.
  - `dev-feedback-panel.tsx` & `feedback-modal.tsx`: In-app user bug reporting.
  - `dev-live-presence.tsx` & `presence-beacon.tsx`: Real-time active user tracking.
  - `mr-overdue-warning-modal.tsx`: Immediate pop-up warning on pending block invoices.
  - `notification-center.tsx`: Push and in-app notification center.
  - `offline-indicator.tsx`, `offline-report-viewer.tsx`, `offline-report-sync.tsx`: PWA offline data synchronization and display.
  - `pwa-install-prompt.tsx`: PWA installation banner.
  - `ui/`: Primitives and Radix UI components (buttons, dialogs, dropdowns, inputs, tables, badges).

---

## 4. Shared Libraries & Utilities (`src/lib/`)

| File | Purpose |
|---|---|
| `api-client.ts` | Server-only HTTP client calling `api-server` with Bearer auth |
| `audit-logger.ts` | Rolling 1,000-entry security and operational audit trail |
| `cache.ts` | In-memory LRU/TTL cache helper |
| `client-error-tracker.ts` | Uncaught client error and rejection capture |
| `companyCodeUtils.ts` | Company code parsing and database parameter normalization |
| `dateUtils.ts` | ODBC date conversions (`YYYY-MM-DD`) and financial year math |
| `excel.ts` | Multi-sheet Excel workbook builder using `exceljs` and `xlsx` |
| `feedback.ts` | User bug report and suggestion storage engine |
| `jwt.ts` | Stateless JWT signing, verification, and cookie serialization (`jose`) |
| `license.ts` | Commercial license verification, grace periods, and killswitch logic |
| `mailer.ts` | Nodemailer Gmail SMTP integration for OTP and developer alerts |
| `maintenance.ts` | Runtime maintenance mode flags and module-level feature toggles |
| `offline-store.ts` | Client IndexedDB storage engine with per-MR isolation and TTL |
| `pdf.ts` | Comprehensive vector PDF generator using `jspdf` and `autotable` (75 KB) |
| `permissions.ts` | MR Rank 1/2/3 permission resolution matrix |
| `presence-store.ts` | In-memory active user session and heartbeat presence tracker |
| `push-notifications.ts` | VAPID key handling and Web Push notification dispatcher |
| `rate-limit.ts` | Sliding-window in-memory rate limiter for logins, OTPs, and exports |
| `runtime-config.ts` | Mutable server runtime settings stored in `runtime_config.json` |
| `security.ts` | IP extraction, CIDR matching, and admin allowlist enforcement |
| `server-storage.ts` | Resilient JSON file reader/writer with automatic Vercel `/tmp` fallback |
| `user-agent-parser.ts` | Device, browser, and OS detection for audit logging |
| `utils.ts` | Common CSS and class merging utilities (`cn`) |

---

## 5. Server Logic & Actions (`src/server/`)

- **`auth.ts`:** Session getter verifying the signed JWT cookie; manages developer impersonation overrides.
- **`actions/` (Next.js Server Actions):**
  - `authActions.ts`: OTP request, OTP verify, Admin login, Developer login, and logout.
  - `overdueEngine.ts`: Overdue invoice evaluation, cascading division blocking, and exemptions.
  - `devDiagnostics.ts`: Real-time system health checks, MySQL latency tests, and stored procedure probes.
  - `mrInfo.ts` & `mrs.ts`: MR profile lookups, company assignments, rank overrides, and unblock actions.
  - `companies.ts`: Division and company master queries.
  - `stockreports.ts` & `stockAndSales.ts`: Stock movement and transaction data fetchers.
  - `claimData.ts`: Free scheme and promotional claim quantity calculations.
  - `overdueReports.ts`: Outstanding invoice aging report retrievers.
  - `partyItemSale.ts` & `customerItemSale.ts`: Party and product sales queries.
  - `presenceActions.ts`: Active user presence beacon updates and session listing.
  - `pushActions.ts`: Web push subscription management and broadcast dispatches.
  - `notices.ts`: Supplier broadcast notices CRUD.
  - `feedback.ts`: In-app feedback submission handler.
  - `adminUnblockActions.ts`: Admin override and unblock execution.
- **`api/` (tRPC):**
  - `root.ts`: Unified tRPC router exposing health checks.
  - `trpc.ts`: tRPC procedure initialization and context builders.

---

## 6. Standalone Backend Service (`api-server/`)

```
api-server/
├── src/
│   ├── db.ts               # mysql2 connection pool configuration
│   ├── cache.ts            # Master data TTL response cache
│   ├── index.ts            # Express server initialization, middleware, routes
│   ├── middleware/
│   │   └── auth.ts         # Bearer token validation middleware
│   ├── routes/
│   │   ├── auth.ts         # MR email/mobile lookup endpoint
│   │   ├── kpi.ts          # Business KPI and monthly sales summaries
│   │   ├── master.ts       # MRs, divisions, companies master queries
│   │   └── reports.ts      # Legacy stored procedure execution endpoints
│   └── utils/
│       ├── companyCodeUtils.ts
│       └── dateUtils.ts
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 7. Persistent Application Storage (`data/`)

- `active_sessions.json`: Live user sessions and active device heartbeats.
- `audit_logs.json`: Rolling 1,000 security and operational audit records.
- `feature_toggles.json`: Feature-level enabled/disabled states.
- `feedback_reports.json`: User bug submissions and feedback notes.
- `license.json`: Commercial subscription status, expiration, and killswitch configuration.
- `maintenance.json`: Scheduled maintenance window settings and messaging.
- `mr_overrides.json`: Rank overrides, manual blocks, and admin unblock records.
- `notices.json`: Broadcast supplier notices.
- `notifications.json`: Stored in-app user notifications.
- `push_subscriptions.json`: Browser Web Push subscription endpoints and keys.
- `runtime_config.json`: Dynamic system-wide runtime flags.
- `vapid_keys.json`: VAPID public and private cryptographic keypair.
