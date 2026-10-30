# Roadmap

## Phase 1: Database Schema & Authentication

- Set up Drizzle schema for Users, Roles, Products, Sales, and Orders.
- Implement Better Auth with credential support for MR authentication.
- Create initial Admin user via seeding or script.

## Phase 2: Admin Data Ingestion

- Build API routes for parsing CSVs from Technomax.
- Implement business logic to populate Stock, Sales, and Free Schemes data into the DB.

## Phase 3: MR Dashboard & Order Placement

- Build the MR portal UI (responsive for mobile/desktop) using Stitch MCP.
- Implement row-level or query-level data isolation for MR sales views.
- Build form and server actions for MRs to create/edit sales and place orders.

## Phase 4: Admin Global Dashboard & Order Management

- Build Admin reporting UI (per-company, per-MR).
- Implement order management dashboard for Admins to view and complete orders.

## Phase 5: Data Migration (SQL Import)

- Parse and ingest legacy MySQL dumps (e.g. `demo data/APBARODA.sql`) into the Postgres database.
- Map and seed product data correctly for MR assignments.

## Phase 6: Overdue (Purchase Days & Outstanding)

- Implement the backend logic to calculate purchase days and outstanding amounts per party.
- Complete the "Overdue" tab in the MR Dashboard UI to render this data.

## Phase 7: Performance Optimization & UI Loading States

- Add DB indexes to improve query speeds on large tables.
- Implement React Suspense, skeleton loaders, and `useTransition` for tabs and date filters.
- Optimize data fetching for reports with caching or efficient aggregations.

## Phase 8: Full Data Ingestion & Masterdata Integration (April–October 2026) [COMPLETED]

- [x] Ingest all multi-month AP Baroda SQL datasets (April through October 2026: April, May, June, July, August, September, October).
- [x] Ingest and map `masterdata.sql` (schemes, tax/calculation parameters, customers, products).
- [x] Ensure 100% transaction coverage (zero dropped rows, full MR mapping & auto-fallback reps).
- [x] Validate database counts, calculations, and performance across all report views.

## Phase 9: Legacy MySQL MR User Integration [COMPLETED]

- [x] Create centralized server action `src/server/actions/mrInfo.ts` querying `pdyasvmaster.m_user` with lean column projection.
- [x] Migrate MR lookup across all report views (Stock, Sales, Product, Overdue, Outstanding, Free Schemes).
- [x] Migrate MR dashboard and admin MR inspection pages to use `mrInfo.ts`.
- [x] Update API report download endpoints to resolve MR access from legacy MySQL.
- [x] Verify build and validate end-to-end user navigation.

## Phase 10: Legacy Stored Procedure Transition & Cleanup [COMPLETED]

- [x] Gate raw SQL debug query banners behind URL toggle (`?debug=1`).
- [x] Align Overview Dashboard metric cards with live procedure aggregations.
- [x] Verify export endpoints and print formats against live procedure datasets.
- [x] Run full TypeScript validation and commit cleanly to `localdb`.

## Phase 11: Neon DB Elimination & Pure Legacy MySQL Transition [COMPLETED]

- [x] Implement Stateless JWT / Signed Cookie Auth (Zero DB tables for sessions).
- [x] Implement MR Email OTP login flow + Env-based Admin/Developer credential authentication.
- [x] Migrate Product catalog queries to direct MySQL projection on `pdyasvmaster.m_item`.
- [x] Migrate MR assignments and divisions to read directly from `pdyasvmaster.l_mktcompany_mr`.
- [x] Migrate broadcast notices to `data/notices.json`.
- [x] Completely remove Neon database dependencies from runtime routes, views, and server actions.

## Phase 12: Outstanding & Blocking Management [COMPLETED]

- [x] Implement live customer outstanding & periodical ageing analysis via `rptMRwisePeriodicalOutstanding`.
- [x] Add party-level and invoice-level overdue tracking with age threshold highlighting (>90 days in red).
- [x] Implement Admin MR blocking system (restricting OTP issuance, session validation, and access).
- [x] Implement Party/Customer blocking based on ERP `IsBlocked`/overdue thresholds.
- [x] Build Admin blocking management UI and integrate blocking enforcement across MR dashboard and reports.
- [x] Implement 80–90 day warning popup notice with impending block dates.
- [x] Implement division cascading blocking when peer MR has overdue >90 days.
- [x] Implement password-protected Admin unblock modal with exemption logging.

## Phase 13: Cleanup, Performance & Loading Speed Optimization

- [x] Delete dead Postgres schema files (`src/server/db/schema.ts`, `src/server/db/index.ts`) and prune obsolete cloud DB dependencies.
- [x] Optimize legacy MySQL connection pooling and query concurrency in `src/lib/legacy-db.ts`.
- [x] Implement smart in-memory/server caching (TTL-based) for repetitive master data lookups (`m_mktcompany`, `m_customer`, `m_item`).
- [x] Add React Suspense boundaries, skeleton loaders, and tab transitions across MR and Admin dashboards.
- [x] Parallelize procedure calls and reduce payload sizes for report tables and export downloads.

## Phase 14: Standalone Express.js API Layer Decoupling (MySQL Isolation) [COMPLETED]

- [x] Scaffold standalone Express.js API backend in `api-server/` with `mysql2` pool, CORS, and 64-character `API_SECRET_KEY` Bearer auth middleware.
- [x] Port all legacy MySQL queries and stored procedures (`rptStockMovementStatement`, `rptItemCustomerSale`, `rptMRwisePeriodicalOutstanding`, `rptClaimData`, `rptCompanyCustomerItemwiseSales`, `mrInfo`, `customerBlocking`, `itemCatalog`) into dedicated Express routes.
- [x] Refactor Next.js server actions to consume the Express API via authenticated HTTP `fetch()`.
- [x] Retain all TypeScript interfaces in Next.js to maintain seamless client type safety.
- [x] Remove `mysql2` package and direct DB credentials from Next.js configuration.
- [x] Validate Next.js Vercel build compatibility (zero native database drivers).

## Phase 15: Code Cleanup, Formatting & Dependency Audit [COMPLETED]

- [x] Audit repository for unnecessary test scripts, scratch files, and obsolete demo assets.
- [x] Ensure proper directory organization and file structure across frontend and `api-server`.
- [x] Format and prettify entire codebase using Biome and standard formatters.
- [x] Resolve TypeScript compiler warnings, Biome lint warnings, and runtime deprecations.
- [x] Audit dependencies in root and `api-server` for duplicates, unused packages, and security updates.
- [x] Generate comprehensive pre-cleanup audit report and execute verification pass.

## Phase 16: Admin MR Pagination, Infinite Scroll & Read-Only Cleanup [COMPLETED]

- [x] Audit and remove "Add MR" UI and server actions (`add-mr-button.tsx`, `createMR`).
- [x] Implement paginated MR query (10 MRs per batch) with total count and filtering.
- [x] Implement client-side infinite scroll on `/admin/mrs` via IntersectionObserver.
- [x] Scope/defer overdue evaluation stored procedures to avoid parallel query saturation.
- [x] Document database write audit report confirming 100% read-only ERP database usage.
- [x] Verify build and commit cleanly.

## Phase 17: Reports Export and Formatting Improvements [COMPLETED]

- [x] Synchronize date range filters with presets (Full FY, Current Month, Last Month, Last 90 Days) across all report views.
- [x] Standardize CSV/Excel export endpoints with formatted columns, numeric decimals, total rows, and proper Uint8Array binary buffers.
- [x] Align download modal dialogs and standardize export filename schemes (`<MR>_<Division>_<ReportType>_<DateRange>.<ext>`) across all tabs.
- [x] Polish PDF report layouts, column auto-wrapping, and multi-page header/footer branding.
- [x] Verify build and commit cleanly.

## Phase 18: Claim Quantity Report & Calculation Engine Alignment [COMPLETED]

- [x] Fix claim calculations and formulas (`Claim Value = PRate * ClaimQty`, Rate Claim rate differentials).
- [x] Refactor Express backend query logic to bypass fragile temporary table collisions and properly isolate MR assigned companies.
- [x] Align UI and PDF/Excel export table layouts with exact 15-column format, customer subtotals, and item summary totals matching reference standard.
- [x] Ensure strict multi-tenant MR company filtering and sanitize date parameter mapping.
- [x] Verify builds and end-to-end data against September 2026 reference dataset.

## Phase 19: Admin MR Management & UI Diagnostics Hardening [COMPLETED]

- [x] Remove intrusive debug SQL banners across report views (e.g. Free Scheme report).
- [x] Fix MR search and sort functionality when loading MRs in 10-item paginated batches.
- [x] Support robust multi-field search across MR names, emails, company, division, and assigned manufacturers.
- [x] Ensure seamless infinite scrolling and page counter updates on `/admin/mrs`.
- [x] Verify clean builds and report UI without debug artifacts.

## Phase 20: MR Ranking-Based Permissions [COMPLETED]

- [x] Define MR ranking levels (Rank 1 = Stock only, Rank 2 = Stock + Claim Qty, Rank 3 = All reports) with ERP database rank projection.
- [x] Implement strict ranking-based permission presets and automated synchronization.
- [x] Add Admin UI controls to view MR ranking and display active report permissions as read-only status badges.
- [x] Enforce ranking-based data and report access across server actions, dashboard tabs, and export endpoints.
- [x] Verify build, permission enforcement, and test across different MR ranks.

## Phase 21: PDF and Report Polishing [COMPLETED]

- [x] **Web View Stationery Headers**: Replicate the official stationery header from the Party Wise tab across all report tabs (`Stock`, `Sales`, `Product Wise`, `Free Scheme`, `Overdue`) with Asmee Pharma logo, full address, contact details, year, and dynamic title/subtitle metadata.
- [x] **Comprehensive PDF Generation for All Tabs**: Verify and ensure flawless PDF generation across every tab (`Stock`, `Party Wise`, `Product Wise`, `Sales`, `Free Scheme`, `Overdue`), producing exact high-fidelity replicas of the web view with matching typography, group banners, subtotals, and grand totals.
- [x] **Party Wise PDF Generation & Button Styling**: Fix the red PDF button on Party Wise tab to match standard UI theme, and implement full `generatePartyWisePdfReport` to generate an exact replica of the Party Wise web report.
- [x] **Product Wise PDF Generation**: Align Product Wise PDF export structure and data columns with the exact web view table (Item Code, Item Name, Batch, Exp, Qty, Rate, Amount).
- [x] **Stock Movement PDF Zero-Transaction Filter**: Filter out zero-movement items (no opening, in, out, or balance transactions) from Stock PDF generation so it matches web view and avoids redundant pages.
- [x] **Excel Export Overhaul & Column Auto-Fitting**: Fix Excel (`.xlsx`) generation across all report downloads—automatically calculate and space column widths (`!cols`), bold column headers, style subtotal and grand total summary rows, and apply proper numeric formatting so columns are never squished or cut off.
- [x] **Sticky Top Header & Targeted Loading States**: Make MR name, division filter, date range picker, download actions, and tab bar sticky/pinned; replace stale data with a clear targeted loader during date or tab transitions.
- [x] **Collapsible Sidebar with Icons**: Add intuitive icons to navigation links and implement a smooth collapsible sidebar for MR and Admin layouts.
- [x] **Mobile Responsiveness & Home Page Polish**: Improve touch interactability on mobile devices (horizontal scroll indicators, touch targets), fix home page logo contrast with dark background, and eliminate cut-off text.

## Phase 22: Audit & Security Hardening [COMPLETED]

- [x] **Rate Limiting Engine**: Implement sliding window / token bucket rate limiting on sensitive API endpoints (OTP generation, credential login, password-protected unblock actions, and heavy report downloads).
- [x] **Security Headers & Middleware**: Configure comprehensive HTTP security headers via Next.js middleware / headers config (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
- [x] **Enhanced Session Tracking & Access Logging**: Capture client IP, user-agent, timestamp, and authentication lifecycle events (successful logins, failed OTP attempts, token expirations) with isolated audit storage.
- [x] **Admin Route Protection & IP Allowlisting**: Provide configurable IP restriction/allowlist checks for sensitive administrative actions and debug endpoints.
- [x] **Unblock Exemption Audit Trail**: Formalize and persist admin unblock actions, reasons, timestamps, and operator identities in structured audit logs.
- [x] **Verification Pass & Security Validation**: Test brute-force mitigation, simulated invalid payloads, security header compliance, and confirm 100% read-only ERP database integrity.

## Phase 23: Developer Options & Developer Account [COMPLETED]

- [x] **Developer Role Separation & Layout Alignment**: Fix admin layout authentication gates to permit `DEVELOPER` role alongside `ADMIN`, add distinct developer session indicators, badges, and role-scoped navigation.
- [x] **Software Subscription Lifecycle, Killswitch & Admin Reminder Emails**: Implement subscription status management (`data/license.json`) with automated system-wide blocking upon expiration/killswitch for MRs and Admins, countdown tracking, and automated renewal reminder email dispatch from developer email to admin emails.
- [x] **Granular Feature Switchboard & Global Maintenance Mode**: Build controls to selectively take down individual services (Stock, Sales, Product, Party, Claim, Overdue, Exports, Notices) for MRs, for Admins, or for both, plus a global maintenance mode with branded screens and custom completion estimates.
- [x] **Environment & Runtime Config Management**: Build developer interface to view, manage, and hot-reload dynamic runtime environment keys (`ADMIN_ALLOWED_IPS`, debug toggles, rate limits, grace periods) with masked secret inspection.
- [x] **Multi-Service Health & Telemetry Monitor**: Implement real-time service health monitors tracking Next.js frontend (uptime, memory, Node v26), Express API server (`/health` ping), MySQL ERP connection pool, SMTP mailer handshake, and disk storage.
- [x] **Unified Log Inspector (User Audit + System Logs)**: Create developer log stream inspecting both user activity audit logs (logins, OTPs, exports, unblocks) and system API logs (HTTP routes, status codes, query duration, errors) with search and severity filters.
- [x] **MR Impersonation & "View-As" Mode**: Allow developers to preview the portal and report views as any registered MR to verify ranking permissions, overdue notices, and stationery formatting without credential spoofing.
- [x] **Stored Procedure Playground & Cache Controls**: Build a safe, read-only stored procedure execution sandbox for developers to benchmark queries with custom parameters, alongside one-click cache flushes and rate-limit resets.
- [x] **Verification & Quality Gates**: Validate subscription blocking, email dispatch, feature toggles, maintenance mode, env hot-reloading, service health checks, and ensure clean production builds.

## Phase 24: Mobile PWA & Offline Access for Medical Representatives [COMPLETED]

- [x] **PWA Manifest, Icons & App Shell Installation**: Create web app manifest (`manifest.json` / Next.js `manifest.ts`), touch icons (192x192, 512x512, maskable icons), theme colors (`#0071BC`, `#0B2545`), and an in-app "Install PharmaQL" prompt for Android/iOS mobile devices.
- [x] **Service Worker & Offline Asset Caching**: Register service worker to cache application shell, critical fonts, static assets, and core CSS for instant loading even without internet connectivity.
- [x] **Offline Report Data Snapshot & Storage**: Implement browser client cache (IndexedDB / CacheStorage) storing recent report queries (Stock Movement, Sales, Product catalog, Outstanding) so MRs can inspect data during offline clinic/chemist visits.
- [x] **Network Status Detection & Offline Banner**: Add real-time online/offline connection state listener (`navigator.onLine`) displaying a subtle status pill / banner indicating live vs offline snapshot view.
- [x] **Mobile Touch UX & Viewport Polish**: Optimize bottom navigation bars, swipe/touch targets, pull-to-refresh gestures, and safe-area insets for modern mobile screens and standalone PWA display mode.
- [x] **Verification & PWA Quality Gates**: Validate Lighthouse PWA compliance, offline test simulations, asset caching, and ensure zero regression on desktop and Admin/Developer portals.

## Phase 25: Push Notifications & Instant Field Alerts [COMPLETED]

- [x] **Web Push & VAPID Key Infrastructure**: Setup VAPID keys, backend subscription storage (`data/push_subscriptions.json`), and client subscription manager (`src/lib/push-notifications.ts`).
- [x] **Service Worker Push & Action Handlers**: Implement `push` and `notificationclick` listeners in `public/sw.js` with deep-linking to relevant tabs (`/dashboard?tab=overdue`, `/dashboard?tab=notices`).
- [x] **Automated Overdue & Blocking Field Alerts**: Trigger automated web push alerts when party accounts reach 80–90 day warning thresholds or get blocked by ERP overdue calculations.
- [x] **Admin Broadcast & Notice Push Dispatch**: Automatically push notifications to field MRs whenever Admins publish new circulars or critical company notices.
- [x] **In-App Notification Bell & Preference Center**: Add interactive notification bell in MR and Admin top bars showing unread alerts, timestamps, and toggle controls.
- [x] **Developer Diagnostics & Verification Suite**: Add test push dispatcher in Developer Control Center (`/admin/dev`) and automated verification suite testing subscription lifecycle and payload formatting.
## Phase 26: Developer Debug Suite & Email Credentials Integration [COMPLETED]

- [x] **Dedicated Developer Debug Tab & Toolset**: Create a prominent Debug Console within `/admin/dev` featuring one-click testing and diagnostic triggers.
- [x] **Interactive Test Notification Dispatcher**: Add a "Send Test Notification" UI button with payload customization (title, message, urgency, target role/user) to trigger instant Web Push and in-app alerts on demand.
- [x] **System & Diagnostics Action Buttons**: Add dedicated test buttons for:
  - Email connectivity & test email dispatch to admins/MRs.
  - Rate limiter status check & manual client IP reset.
  - Storage read/write latency test on active data dir (`/tmp` vs local).
  - Stored procedure latency benchmark test.
- [x] **Developer Email Credentials Configuration**: Implement full support for dedicated developer SMTP sending credentials (`DEV_SMTP_USER`, `DEV_SMTP_PASS`, `DEV_EMAIL`) in mailer so system alerts, renewal invoices, and administrative notices originate directly from the developer account to Admins and MRs.
- [x] **Verification & Build Validation**: Test all debug actions, verify email dispatch with developer credentials, run typecheck, and ensure clean production builds.

## Phase 27: In-App Feedback & Error Reporting System [COMPLETED]

- [x] **In-App Feedback & Bug Submission Widget**: Embed an accessible floating feedback/bug report trigger across MR and Admin interfaces with category selection (Bug, Data Issue, Feature Request, General Feedback), urgency level, description, and optional contact note.
- [x] **Context-Aware Error Diagnostics & Telemetry**: Automatically collect environment diagnostics with each report (current URL/tab, user ID, role, MR rank, division, browser/OS version, screen dimensions, recent console errors/network failures).
- [x] **React Error Boundary & Unhandled Exception Catcher**: Implement global and route-level error boundaries that catch render crashes and display a user-friendly fallback UI with one-click instant error reporting.
- [x] **Persistent Ticket Storage & Server Actions**: Build server actions and structured file storage (`data/feedback_reports.json`) with unique ticket IDs, timestamps, status tracking (New, Under Review, Resolved), and developer notes.
- [x] **Developer Feedback Management Center**: Create a dedicated view in `/admin/dev` ("Feedback & Bug Reports" tab) to search, filter, inspect full diagnostic payloads, update ticket status, and resolve field issues.
- [x] **Automated Developer Email Alerts with MR Attribution**: Trigger automated email notifications to developers via Admin Mailer whenever reports are submitted, explicitly identifying which MR (name, role, rank, division) submitted the report.
- [x] **Verification & End-to-End Validation**: Verify submission flows, error boundary interception, data persistence, email alerts, run automated tests, and perform clean production build validation.

## Phase 28: Multi-Division MR Database Scanning & Aggregation [COMPLETED]

- [x] **Database Scanning & Consolidation Engine**: Automatically scan and group `pdyasvmaster.l_mktcompany_mr` entries by `MRName` and `EmailId` in `mrInfo.ts` and API server, merging all duplicate records into unified MR profiles with all their `DivisionID`s, divisions, and marketing companies.
- [x] **MR Impersonation & Admin MR List Enhancement**: Upgrade Developer Impersonation (`/admin/dev`) and Admin MR Management (`/admin/mrs`) to display all consolidated MRs, render all division badges on cards/tables, and enable searching by company name, company code, division, MR name, and email.
- [x] **MR Dashboard Multi-Division Switcher**: Upgrade `MrDashboardContent` division dropdown to dynamically render all scanned divisions from `mrInfo.assignments`, enabling reps to switch between divisions or view "All Divisions".
- [x] **Multi-Division Report Querying & Export Synchronization**: Ensure report actions and download endpoints query with the active division and its corresponding company code.
- [x] **Verification & Validation**: Verify multi-division reps (Amit Bhagat with 3 divisions, Kalpesh, Manish, Ravikumar, Sachin), verify company-name search, run typecheck, and ensure clean build.

## Phase 29: Live Active User Sessions & Real-Time Presence Monitor [COMPLETED]

- [x] **Real-Time Heartbeat & Presence Beacon**: Implement client-side heartbeat beacon (`usePresenceBeacon` / `/api/presence/heartbeat`) capturing active route/tab, user ID, role, MR rank, division, and activity timestamps without performance overhead.
- [x] **Rich Client Telemetry & Device Parsing**: Parse client IP address, operating system, browser engine, device form factor (mobile/desktop/tablet), viewport dimensions, and network status from request headers and client payload.
- [x] **Live Sessions Store & Session Revocation Engine**: Create server-side session registry tracking live sessions, idle timeouts, and an immediate session termination/revocation mechanism (revoking JWT session tokens on the fly).
- [x] **Developer Live Presence Dashboard Tab**: Add a dedicated "Live Users & Presence" tab in `/admin/dev` with interactive status indicators (🟢 Active Now < 2m, 🟡 Idle 2–15m, ⚪ Offline), search, role filters, and real-time auto-refresh toggle.
- [x] **Remote Session Management Actions**: Provide one-click developer actions:
  - **Remote Logout**: Terminate an active user session immediately, redirecting their next request to `/login`.
  - **Account Block / Unblock**: Toggle MR or user block status directly from the live user row.
  - **Session Inspection Drawer**: Inspect user details, IP, device details, current page/tab, login time, and recent audit activity.
- [x] **Verification & Security Validation**: Verify heartbeat efficiency, remote logout propagation, multi-device session handling, and clean production build validation.

## Phase 30: MR Ranking Database Synchronization & Overdue Cascading Blocking [COMPLETED]

- [x] **Legacy Database Rank Projection & Real-Time Sync**: Update API server SQL queries (`SELECT_MKT_MR_COLUMNS`) and `normalizeLegacyMR` to reliably query and project `Rank` from `l_mktcompany_mr` and `m_user`. Ensure database rank changes take precedence over stale cached records and overrides, dynamically updating MR permissions without requiring session recreation.
- [x] **Direct MR Overdue Blocking (>90 Days)**: Verify and enforce that when an MR has any invoice with net pending balance overdue exceeding 90 days (`> 90 days`), that specific MR is immediately blocked from logging in and accessing reports.
- [x] **Login Screen "Contact Admin" Blocked State**: Upgrade login form and MR authentication flow so blocked reps receive a prominent, informative "Account Suspended / Contact Admin" screen displaying exact overdue invoice details (Invoice No, Party Name, Amount, Days Overdue) rather than a generic error toast.
- [x] **Division Cascading Blocking Calibration (>95 Days)**: Calibrate the division cascading blocking threshold in `overdueEngine.ts` to 95 days (`> 95 days`). When any MR in a division has overdue invoices exceeding 95 days, all peer MRs in the same division are blocked from logging in.
- [x] **Peer MR Cascading Blocking Attribution Notice**: When a peer MR is blocked due to the 95-day division rule, display a clear explanatory message identifying the specific responsible MR by name, the division name, invoice number, and overdue amount.
- [x] **Verification & End-to-End Testing**: Test database rank updates in real time, verify >90-day individual blocks, verify >95-day division blocks, and validate clean production build.

## Phase 31: Architectural Hardening, Testing Suite & Production Resilience [COMPLETED]

- [x] **Automated Testing Suite (Vitest)**: Set up Vitest and create comprehensive unit tests for core domain engines: `overdueEngine.ts` (impending block calculations, >90d direct block, >95d division cascading block, admin exemptions), `permissions.ts` (rank 1/2/3 report permission matrix), `rate-limit.ts` (sliding window rate limit algorithms), and `dateUtils.ts` (ODBC date conversions).
- [x] **Stored Procedure Parameter Validation & Connection Safeguards**: Implement strict parameter schema validation and query execution timeout safeguards in `api-server` before executing stored procedures (`rptStockMovementStatement`, `rptStockandSalesStatementReport`, `rptFreeSchemePartyWiseStatementReport`), preventing parameter count mismatches or pool exhaustion during peak load.
- [x] **Distributed State Adapter (Redis / In-Memory Dual-Mode)**: Design a unified key-value adapter for `otpStore`, rate limiting, and active presence tracking with zero-config in-memory fallback for local development and Upstash/Redis support for multi-instance serverless deployments (Vercel).
- [x] **Client-Side Heavy PDF Memory Protection & Export Pagination**: Optimize `src/lib/pdf.ts` by adding chunked row rendering and pagination caps for high-volume transactions to prevent browser tab crashes on lower-memory MR mobile devices.
- [x] **Security Hardening (Reverse Proxy IP Sanitization & Impersonation Audit)**: Enforce strict IP resolution in `src/middleware.ts` to prevent header spoofing when deployed behind reverse proxies, and strengthen developer impersonation session auditing with high-visibility audit trails.
- [x] **Verification & Validation**: Execute Vitest test suite, verify parameter validation guards against simulated query faults, benchmark PDF generation with mock 5,000-row datasets, and validate clean production build.

## Phase 32: Strict CORS Ingress Protection & API Security Hardening [COMPLETED]

- [x] **Environment-Driven Origin Whitelist**: Configure strict CORS middleware in `api-server` driven by `ALLOWED_ORIGINS` (comma-separated origins) rejecting wildcards (`*`). Reject disallowed origins with HTTP 403 or omit CORS headers to trigger browser blocking.
- [x] **Non-Browser / Server-to-Server Origin Handling**: Safely allow health checks and server-to-server calls without `Origin` headers while strictly enforcing CORS validation on all browser cross-origin requests.
- [x] **HTTP Methods & Headers Whitelisting**: Explicitly restrict allowed methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) and headers (`Content-Type`, `Authorization`, `x-api-key`, correlation/client headers).
- [x] **Credentials & Dynamic Echoing**: Enable `credentials: true` with dynamic matching of `Access-Control-Allow-Origin` to the verified whitelist entry.
- [x] **Preflight (OPTIONS) Early Termination**: Catch preflight requests, return 200/204 with required CORS headers, and terminate early without invoking downstream routes or running DB queries.
- [x] **Environment Documentation & Verification**: Update `api-server/.env.example` with `ALLOWED_ORIGINS` format and provide curl/fetch test scripts verifying whitelisted origins, rejected origins, and OPTIONS preflights.

## Phase 33: Standalone Windows x64 Executable (.exe) & NSSM Packaging [COMPLETED]

- [x] **Bundling & Minification Pipeline**: Set up a pre-bundle step using `esbuild` or `tsup` in `api-server` to bundle, tree-shake, and minify all TypeScript/JavaScript application code and compatible dependencies into a single production bundle (`dist/bundle.cjs`), stripping unneeded source maps and comments to protect intellectual property.
- [x] **Single-File Native Executable Packaging (`@yao-pkg/pkg`)**: Configure `@yao-pkg/pkg` (targeting `node20-win-x64`/`node22-win-x64`) to compile and package the bundled server code into a standalone, binary `api-server.exe` protected against inspection or tampering on client-owned servers.
- [x] **Native Dependencies & Sibling Asset Resolution**: Detect and handle any native C/C++ binary bindings (`.node`), ensure working directory resolution (`process.cwd()`, `.env`, sibling assets) is robust when invoked via Windows Service managers (NSSM), and assemble a self-contained `release/` distribution directory.
- [x] **Graceful Process Lifecycle & Error Handling**: Implement robust `SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection` handlers in `api-server` to ensure clean database pool shutdown and reliable `stdout`/`stderr` logging when managed by NSSM.
- [x] **Automated Build Scripts & NSSM Service Runbook**: Add `"build:exe"` pipeline script to `api-server/package.json` and document exact NSSM commands for service registration, working directory configuration, auto-restart on failure, and log redirection.

## Phase 34: PharmaQL Client Multi-Tenant Consumption & Edge-Safe Routing [COMPLETED]

- [x] **Package Dependencies & Secret Decryption**: Installed `@neondatabase/serverless`, `pg`, `@types/pg` and implemented AES-256-GCM authenticated secret decryption utility ([`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts)) with comprehensive Vitest suite.
- [x] **Neon Relational Schema & Client Initialization**: Built Edge-safe Neon SQL client ([`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts)) with idempotent migrations for normalized relational tables (`tenants`, `tenant_notices`, `tenant_features`, `tenant_licenses`, `tenant_runtime_config`).
- [x] **Server Storage Adapter (Relational Mapping)**: Refactored [`src/lib/server-storage.ts`](file:///e:/work/pharmaql/src/lib/server-storage.ts) to query normalized relational Neon tables, permanently resolving Vercel ephemeral `/tmp` state wipes for notices, feature toggles, licenses, and config.
- [x] **Edge-Safe Tenant Resolution & Middleware**: Built 100% Edge-compatible resolver ([`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts)) with 5-minute TTL caching and integrated into [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts) with unmapped domain rewrite to branded 404 ([`src/app/tenant-not-found/page.tsx`](file:///e:/work/pharmaql/src/app/tenant-not-found/page.tsx)). Zero `pg` or `net` imports in middleware.
- [x] **Node.js Client Database Pool**: Implemented strictly server-isolated [`src/lib/db/tenant-pool.ts`](file:///e:/work/pharmaql/src/lib/db/tenant-pool.ts) enforcing `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` on pool checkout with serverless connection limits (`max: 2`) and 15-minute idle eviction.
- [x] **Dynamic API Proxying**: Enhanced [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts) to dynamically resolve tenant API server URLs and decrypted secret keys.
- [x] **Dynamic White-Label UI Branding**: Abstracted hardcoded branding across [`src/lib/tenant-context.tsx`](file:///e:/work/pharmaql/src/lib/tenant-context.tsx), [`src/app/layout.tsx`](file:///e:/work/pharmaql/src/app/layout.tsx), [`src/components/Header.tsx`](file:///e:/work/pharmaql/src/components/Header.tsx), [`src/components/collapsible-sidebar.tsx`](file:///e:/work/pharmaql/src/components/collapsible-sidebar.tsx), [`src/components/report-stationery-header.tsx`](file:///e:/work/pharmaql/src/components/report-stationery-header.tsx), [`src/lib/pdf.ts`](file:///e:/work/pharmaql/src/lib/pdf.ts), and [`src/lib/excel.ts`](file:///e:/work/pharmaql/src/lib/excel.ts).
- [x] **Verification & Validation**: All 12 Vitest suites passed (58/58 tests), TypeScript validation passed with zero errors (`tsc --noEmit`), and Next.js production build (`next build`) compiled successfully.

## Phase 35: Monolithic Dev Control Center & Superuser Admin Portal [COMPLETED]

- [x] **Host-Based Route Partitioning & Middleware Protection**: Configured Edge middleware in [`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts) to cleanly partition traffic between the Dev Control Center (`pharmaql.devfinity.net` / `localhost` in dev portal mode) and tenant client portals. Ensured client domains cannot access `/admin` or Dev Portal management routes, rewriting unauthorized paths to `/tenant-not-found` (404).
- [x] **Control Plane Server Actions & Encrypted Secrets**: Implemented Node.js Server Actions in [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts) for full CRUD on tenants (create, update, toggle active status, delete) utilizing AES-256-GCM authenticated encryption ([`src/lib/crypto.ts`](file:///e:/work/pharmaql/src/lib/crypto.ts)) for database connection strings and API keys before storing in Neon.
- [x] **Live Database & API Connectivity Diagnostics**: Implemented diagnostic server action (`testDbConnectionAction`) using Node.js `pg.Client` with connection timeout safeguards to connect to the decrypted client database URI, run `SELECT current_database(), version();`, and measure roundtrip latency (ms) with detailed error reporting.
- [x] **Superuser Dev Control Center UI**: Built the master administrative dashboard ([`src/app/admin/tenants/page.tsx`](file:///e:/work/pharmaql/src/app/admin/tenants/page.tsx) and [`src/components/tenants-control-center.tsx`](file:///e:/work/pharmaql/src/components/tenants-control-center.tsx)) featuring platform overview metric cards, searchable & filterable tenant data table, status toggling, and multi-tab modal forms ([`src/components/tenant-modal.tsx`](file:///e:/work/pharmaql/src/components/tenant-modal.tsx)) with inline database ping testing.
- [x] **Verification & Validation**: Validated Edge route separation (verifying client domains cannot route to `/admin`), tested database connectivity diagnostics, verified credential encryption roundtrip, executed all 13 Vitest suites (66/66 tests passing), passed TypeScript typecheck (`tsc --noEmit`), and compiled clean Next.js production build (`next build`).

## Phase 36: Production Deployment & Multi-Tenant Custom Domain Verification [COMPLETED]

- [x] **Production Environment & Secrets Auditing**: Documented and verified production environment variables on Vercel (`CONTROL_PLANE_DATABASE_URL`, `CONTROL_PLANE_ENCRYPTION_KEY`, `DEV_PORTAL_DOMAIN`, developer SMTP, VAPID) in [`DEPLOYMENT.md`](file:///e:/work/pharmaql/DEPLOYMENT.md) and [`.env.example`](file:///e:/work/pharmaql/.env.example).
- [x] **Automated Vercel Custom Domain Registration**: Implemented [`src/lib/vercel-domain-service.ts`](file:///e:/work/pharmaql/src/lib/vercel-domain-service.ts) to automatically provision client custom domains on Vercel projects via the Vercel REST API (`POST /v10/projects/:id/domains`), with non-blocking graceful fallback when credentials are not configured.
- [x] **In-Portal DNS & SSL Live Diagnostics Tooling**: Created `checkDomainStatusAction` in [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts) and [`src/components/domain-diagnostic-modal.tsx`](file:///e:/work/pharmaql/src/components/domain-diagnostic-modal.tsx), enabling live inspection of CNAME targets, Anycast IPv4, Vercel verification, and TLS handshakes with copyable DNS records and recommendations.
- [x] **Dynamic White-Labeled Client Landing Page**: Updated [`src/app/page.tsx`](file:///e:/work/pharmaql/src/app/page.tsx) to dynamically render corporate stationery, custom primary/accent branding, company legal name, and dual MR/Admin sign-in gateways on client custom domains.
- [x] **ERP Bridge Offline Safeguards**: Added 6-second timeout (`AbortSignal.timeout(6000)`) and offline detection in [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts) alongside [`src/components/erp-offline-banner.tsx`](file:///e:/work/pharmaql/src/components/erp-offline-banner.tsx) to inform field reps and block conflicting order submissions.
- [x] **Verification & Validation**: All 16 Vitest suites passed (92/92 tests), TypeScript typecheck passed (`tsc --noEmit`), Next.js production build (`next build`) compiled cleanly, and results documented in [`36-UAT.md`](file:///e:/work/pharmaql/.planning/phases/36-production-deployment-and-domain-verification/36-UAT.md).

## Phase 37: Centralized Dev Platform Dashboard & Multi-Tenant Resource Isolation [COMPLETED]

- [x] **Dedicated Full-Page Tenant Registration & Editing**: Built full-screen, responsive `<TenantForm />` ([`src/components/tenant-form.tsx`](file:///e:/work/pharmaql/src/components/tenant-form.tsx)) replacing modals with a multi-section page architecture at [`/admin/tenants/new`](file:///e:/work/pharmaql/src/app/admin/tenants/new/page.tsx) and [`/admin/tenants/[id]`](file:///e:/work/pharmaql/src/app/admin/tenants/[id]/page.tsx). Replaced modal triggers in [`src/components/tenants-control-center.tsx`](file:///e:/work/pharmaql/src/components/tenants-control-center.tsx) with direct Next.js `<Link>` navigation.
- [x] **Per-Tenant Admin Credentials & Isolated Authentication**: Added `admin_email` and `admin_password_encrypted` to Neon Postgres `tenants` table and local fallback store with AES-256-GCM encryption. Updated [`src/server/actions/authActions.ts`](file:///e:/work/pharmaql/src/server/actions/authActions.ts) to authenticate client portal admins against decrypted per-tenant credentials stored in Neon.
- [x] **Dynamic ERP Query Parameter Injection**: Enhanced [`src/lib/api-client.ts`](file:///e:/work/pharmaql/src/lib/api-client.ts) to automatically extract and inject tenant ERP parameters (`compNo`, `locNo`, `dbName`) into all GET URL query parameters and POST JSON payloads. Unit tests verified in [`src/lib/__tests__/api-client.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/api-client.test.ts).
- [x] **Developer Dashboard Multi-Tenant Context Bar (Global vs Per-Tenant)**: Built sticky `Multi-Tenant Context Selector Bar` in [`src/components/dev-control-center.tsx`](file:///e:/work/pharmaql/src/components/dev-control-center.tsx) allowing developers to manage feature toggles, maintenance modes, and licenses either globally or scoped to specific client tenants.
- [x] **Centralized Dev Platform Dashboard (`/admin/dashboard`)**: Created [`src/components/dev-platform-dashboard.tsx`](file:///e:/work/pharmaql/src/components/dev-platform-dashboard.tsx) rendering platform metrics, Neon latency, quick action links, and tenant table on Dev Portal hosts (`x-is-dev-portal: true`), while rendering client ERP dashboard on client portals. Redirected `/admin` to `/admin/dashboard` and added Platform Dashboard to sidebar navigation.
- [x] **Multi-Tenant Notice Board & Security Audit Scoping**: Added `tenant_id` to `tenant_notices` table. Dev Portal shows badges and allows targeting Global broadcast or specific client tenant. Audit trail ([`/admin/audit`](file:///e:/work/pharmaql/src/app/admin/audit/page.tsx)) automatically records tenant identifiers and supports tenant filtering on Dev Portal while isolating client records.
- [x] **Environment Cleanup & Architecture Alignment**: Cleaned [`.env`](file:///e:/work/pharmaql/.env), [`src/env.js`](file:///e:/work/pharmaql/src/env.js), and [`.env.example`](file:///e:/work/pharmaql/.env.example) to remove obsolete single-tenant variables and clearly document required platform variables and optional offline fallback credentials.
- [x] **Verification & Validation**: All 17 Vitest suites passed (95/95 tests), TypeScript typecheck passed with zero errors (`tsc --noEmit`), and Next.js production build (`next build`) compiled cleanly. Results documented in [`37-UAT.md`](file:///e:/work/pharmaql/.planning/phases/37-centralized-dev-dashboard-and-multi-tenant-isolation/37-UAT.md).

## Phase 38: Multi-Tenant Custom SMTP & Isolated Email Dispatch [COMPLETED]

- [x] **Relational Database Schema & Credential Encryption**: Add SMTP configuration columns (`smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_password_encrypted`, `smtp_from_name`, `smtp_from_email`) to Neon Postgres `tenants` table and local fallback store with AES-256-GCM encryption.
- [x] **Dynamic Tenant Mailer Pool (`src/lib/mailer.ts`)**: Implement `getTenantMailer(tenantId)` resolving custom SMTP transporters per tenant with connection pooling, and graceful fallback to platform mailer with dynamic brand display name and reply-to.
- [x] **Dynamic White-Labeled Email Templates**: Refactor `sendOtpEmail` and system notifications to dynamically render the active tenant's logo, primary brand color, organization legal name, and custom support contact links instead of hardcoded branding.
- [x] **Tenant Form SMTP Configuration & Test Diagnostics**: Add an "Email Services (SMTP)" section to [`src/components/tenant-form.tsx`](file:///e:/work/pharmaql/src/components/tenant-form.tsx) with presets (Zoho, Gmail, Outlook, Custom), encrypted credential inputs, and a live "Send Test Verification Email" diagnostic action.
- [x] **Verification & Validation**: Run complete Vitest suite (21 test files, 118 unit tests passing), TypeScript validation (`tsc --noEmit`), and Next.js production build (`next build`).

## Phase 39: Production Neon Database Persistence & Dynamic Multi-Tenant State Isolation [COMPLETED]

- [x] **Remove Static Seeding Loop from Runtime Migrations**: Decouple `data/tenants.json` from `initControlPlaneRelationalSchema` in [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts). Schema initialization must only manage DDL (`CREATE TABLE`, `ALTER TABLE`) and never execute DML inserts of hardcoded tenants on runtime requests, eliminating `duplicate key value violates unique constraint "tenants_slug_key"` and infinite re-seeding loops.
- [x] **Eliminate Hardcoded Tenant Fallback on Cloud Queries**: Refactor [`src/lib/tenant-resolver.ts`](file:///e:/work/pharmaql/src/lib/tenant-resolver.ts) so that when `getControlPlaneSql()` is connected, queries resolve strictly against Neon without secondary fallbacks to `data/tenants.json`. When a tenant is deleted in Neon, it must stay deleted and never be resurrected by static data or cached negative hits.
- [x] **Isolate Cloud Mutations from Local File Mirroring**: In [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts), ensure `saveTenantAction`, `deleteTenantAction`, and `toggleTenantStatusAction` operate solely on Neon when cloud database is active, removing unnecessary file write attempts to ephemeral serverless storage.
- [x] **Robust Form Feedback & Cache Invalidation**: Ensure [`src/components/tenant-form.tsx`](file:///e:/work/pharmaql/src/components/tenant-form.tsx) and [`src/components/tenants-control-center.tsx`](file:///e:/work/pharmaql/src/components/tenants-control-center.tsx) display exact server errors if duplicate slugs or invalid custom domains are entered, and trigger immediate full cache invalidation and UI revalidation on create/edit/delete.
- [x] **Verification & Validation**: Verified end-to-end tenant creation and deletion against live Neon PostgreSQL, confirmed zero slug unique constraint warnings in server logs, verified all 20 Vitest test suites (112 tests) pass, and zero TypeScript errors (`tsc --noEmit`).

## Phase 40: Data Loading Performance Optimization & Query Latency Reduction

- [ ] **Data Fetching Audit & Bottleneck Profiling**: Profile network payloads, server-to-server ERP query roundtrips, and client rendering bottlenecks across primary MR/Admin views (Stock Movement, Stock & Sales Statement, Outstanding/Overdue Statements, and Party lists).
- [ ] **Multi-Tier Caching & Stale-While-Revalidate Engine**: Implement high-performance server-side caching (in-memory LRU / Redis / Next.js Data Cache) with configurable TTLs for slow ERP statements, master party directories, and product catalogs, ensuring instant sub-100ms responses on repeated view queries while background revalidation keeps data fresh.
- [ ] **Payload Optimization, Compression & Server-Side Pagination**: Optimize heavy JSON serialization, apply gzip/brotli payload compression, and implement cursor/offset pagination or virtualized streaming for statements with thousands of line items to avoid client memory lag.
- [ ] **React Query Client Optimization & Parallel Pre-fetching**: Refactor React Query hooks with aggressive stale times, background pre-fetching on hover/navigation, and optimistic UI transitions to eliminate full-page loading spinners during routine tab switches.
- [ ] **API Server Connection Pool & Stored Procedure Execution Tuning**: Optimize `api-server` database connection pooling, query timeouts, and stored procedure execution to minimize database lock contention and ODBC latency during concurrent MR access.
- [ ] **Verification & Validation**: Benchmark before-and-after query response times and Core Web Vitals (LCP, INP, TTFB), run complete Vitest test suite, verify type safety (`tsc --noEmit`), and compile production build (`next build`).


