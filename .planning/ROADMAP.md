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


