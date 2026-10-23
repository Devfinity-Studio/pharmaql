# Tech Stack

**Date Mapped:** 2026-10-23  
**Project:** PharmaQL (B2B Medicine Supplier Portal)

---

## 1. Core Framework & Runtime

- **Frontend & BFF Framework:** [Next.js 15.2.3](https://nextjs.org/) (App Router, React Server Components, Server Actions)
- **Runtime Environment:** Node.js (v20+ / Node 26 compatibility with Webpack hash monkeypatch in `next.config.js`)
- **Package Manager:** `pnpm` v12.11.2 (monorepo/multitarget workspace managing root and `api-server`)
- **Language:** TypeScript 5.8.2 (`tsc --noEmit` type checking)
- **Build / Dev Server:** Next.js Turbopack (`next dev --turbo`), Webpack 5 custom configuration (`sha256` hashing)

---

## 2. Frontend & UI System

- **UI Library:** React 19.0.0 (`react`, `react-dom`)
- **Styling Engine:** Tailwind CSS v4.0.15 (`@tailwindcss/postcss`, `postcss` v8.5.3)
- **UI Component Primitives:** Radix UI (`radix-ui` ^1.6.0), `shadcn` CLI (^4.11.0)
- **Icons:** `lucide-react` (^1.21.0)
- **Styling Utilities:** `clsx` (^2.1.1), `tailwind-merge` (^3.6.0), `class-variance-authority` (^0.7.1), `tw-animate-css` (^1.4.0)
- **Theme Management:** `next-themes` (^0.4.6) supporting Light, Dark, and System modes
- **Micro-interactions:** `canvas-confetti` (^1.9.4), `input-otp` (^1.4.2)

---

## 3. Data Ingestion, State & API Layer

- **Data Mutation & Fetching:** Next.js Server Actions (`"use server"`) as primary data layer
- **Client Query State:** `@tanstack/react-query` v5.69.0
- **Type-safe RPC (Foundation):** `@trpc/server` v11.0.0, `@trpc/client` v11.0.0, `@trpc/react-query` v11.0.0, `superjson` v2.2.1
- **Validation:** `zod` v3.24.2 (runtime input validation, environment schema validation via `@t3-oss/env-nextjs` v0.12.0)
- **HTTP Client (BFF to Database Gateway):** Custom fetch wrapper (`src/lib/api-client.ts`) with Bearer token authentication and query parameter serialization

---

## 4. Backend Microservice (`api-server`)

- **Architecture:** Standalone Node.js microservice (`api-server/`) exposing REST endpoints
- **Framework:** Express.js v4.21.2 (`@types/express` v5.0.0)
- **Execution Engine:** `tsx` v4.19.2 (watch & execution) / `tsc` build
- **Database Driver:** `mysql2` v3.12.0 (promise-based connection pooling with keep-alive)
- **Security & Networking:** `cors` v2.8.5, custom in-memory IP rate limiter, security headers, Bearer token authentication middleware
- **Reverse Proxy:** Caddy Server (scripts: `caddy:start`, `caddy:stop`, `caddy:reload`)

---

## 5. Databases & Persistence

- **Primary Database:** Legacy On-Premises MySQL Database (`pdyasvtrans` transactional database, `pdyasvmaster` master records)
- **Data Access:** Stored Procedures (`rptStockMovementStatement`, `rptStockandSalesStatementReport`, `rptFreeSchemePartyWiseStatementReport`, `rptOverduePeriodicalOutstandings`, etc.) and complex multi-table SQL queries
- **Application Server Storage:** File-based atomic JSON storage (`src/lib/server-storage.ts`) in `data/` with automatic fallback to `/tmp/pharmaql-data` on serverless environments (Vercel / AWS Lambda) for:
  - Active user sessions & presence (`active_sessions.json`)
  - Structured security & audit trail (`audit_logs.json`)
  - Commercial license keys & killswitch (`license.json`)
  - Dynamic maintenance flags & feature toggles (`maintenance.json`, `feature_toggles.json`)
  - MR overrides, rank overrides, and admin unblock records (`mr_overrides.json`)
  - System notices & user notifications (`notices.json`, `notifications.json`)
  - Web push notification subscriptions (`push_subscriptions.json`, `vapid_keys.json`)
- **Client Offline Storage:** Browser IndexedDB (`pharmaql_offline_db`) with MR-isolated cryptographic namespaces and 48-hour TTL cache

---

## 6. Authentication, Security & Cryptography

- **Auth Scheme:** Stateless JWT session cookies (`jose` v6.2.12, HTTP-only, `SameSite=Lax`, signed with `BETTER_AUTH_SECRET`)
- **Login Mechanism:**
  - Medical Representatives (MR): Passwordless 6-digit numeric OTP delivered via Email, verified in memory with 10-minute expiry
  - Admin & Developer: Direct credential validation against environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEV_EMAIL`, `DEV_PASSWORD`)
  - Impersonation: Developer ability to impersonate any MR session via `pharmaql_impersonate` cookie
- **Email Service:** `nodemailer` v9.0.5 via Gmail SMTP (`GMAIL_USER`, `GMAIL_PASS`)
- **Rate Limiting:** Sliding-window in-memory rate limiter protecting OTP requests, logins, and report downloads (`src/lib/rate-limit.ts`)
- **IP Protection & Access Control:** Admin IP allowlisting via CIDR/IP checks (`src/lib/security.ts`, `src/middleware.ts`)

---

## 7. Reporting & Document Generation

- **PDF Generation:** Client-side vector PDF generation using `jspdf` v4.2.1 and `jspdf-autotable` v5.0.8 with custom stationery headers and company branding
- **Excel Spreadsheet Export:** `exceljs` v4.4.0 (styled workbooks) and `xlsx` (SheetJS) v0.18.5
- **Progressive Web App (PWA):** Web App Manifest (`src/app/manifest.ts`), service worker registration, and native Push Notifications via `web-push` v3.6.7 (VAPID protocol)

---

## 8. Code Quality, Tooling & Diagnostics

- **Linter & Formatter:** [Biome](https://biomejs.dev/) v2.2.5 (`biome.jsonc`) with VCS git integration, import sorting, and Tailwind class sorting
- **Telemetry & Analytics:** `@vercel/analytics` v2.0.1, Vercel Insights
- **In-App Developer Diagnostics:** Full diagnostic suite (`src/server/actions/devDiagnostics.ts`) monitoring MySQL latency, stored procedure execution, email transport, and server storage health
