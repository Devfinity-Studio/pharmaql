# Phase 11: Neon DB Elimination & Pure Legacy MySQL Transition

**Goal:** Completely eliminate Neon Postgres from PharmaQL by transitioning to stateless JWT session auth, Email OTP login for MRs (via configured Gmail SMTP), env-based Admin/Developer accounts, native MySQL product & MR queries, and local JSON notices—creating **ZERO new tables in MySQL**.

---

## Architecture & Workaround Overview

```
 ┌──────────────────────────────────────────────────────────────┐
 │             PHARMAQL PURE LEGACY ARCHITECTURE               │
 └──────────────────────────────────────────────────────────────┘
 ┌───────────────────────────┐         ┌─────────────────────────┐
 │ Next.js Server            │  READ   │ Legacy MySQL ERP        │
 │                           │────────▶│                         │
 │ 1. Auth:                  │         │ • pdyasvmaster:         │
 │    • MRs: Email OTP (via  │         │   - l_mktcompany_mr     │
 │      Gmail SMTP in .env)  │         │   - l_mktcompany        │
 │    • Admin/Dev: .env pass │         │   - m_mktcompany        │
 │    • Cookies: Signed JWT  │         │   - m_item              │
 │                           │         │                         │
 │ 2. Notices:               │         │ • pdyasvtrans:          │
 │    • data/notices.json    │         │   - 5 Stored Procedures │
 │                           │         │                         │
 │ 3. 0 Database Tables!     │         │                         │
 └───────────────────────────┘         └─────────────────────────┘
```

---

## Detailed Plans & Tasks

### Plan 11.1: Stateless JWT Authentication & Email OTP (Gmail SMTP) / Env Login
- **Files:**
  - `src/lib/jwt.ts` (New: lightweight JWT sign & verify using `jose`)
  - `src/lib/mailer.ts` (New: nodemailer transporter using `GMAIL_USER` and `GMAIL_PASS` to deliver 6-digit OTPs)
  - `src/server/auth.ts` (Refactor: replace database-backed Better Auth with stateless session verification)
  - `src/server/actions/authActions.ts` (New: MR email OTP request/verify + Admin/Developer email+password login)
  - `src/app/login/page.tsx` (Update: UI tabs for "MR Email OTP Login" and "Admin / Developer Login")
- **Details:**
  - MR enters Email. Server looks up MR in `pdyasvmaster.l_mktcompany_mr`. If valid, generates a 6-digit OTP, sends it via Gmail SMTP (`GMAIL_USER` / `GMAIL_PASS`), and sets an encrypted HTTP-only JWT session cookie upon verification.
  - Admin/Developer enters email and password, validated against `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEV_EMAIL`, `DEV_PASSWORD` in `.env`.
  - Zero database tables created or queried for session management.

### Plan 11.2: Native MySQL Products Catalog Service
- **Files:**
  - `src/server/actions/itemCatalog.ts` (New: queries `pdyasvmaster.m_item` with the exact verified SQL projection)
  - `src/app/api/products/route.ts` (Update: replace Postgres query with `itemCatalog.ts`)
  - `src/app/products/[company]/page.tsx` (Update: replace Postgres query with `itemCatalog.ts`)
- **Details:**
  - Uses exact query projection provided by the user: `ID`, `ItemCode`, `ItemName`, `Packing`, `Division`, `MktBy`, `PriQty`, `InActive`, etc.
  - Allows filtering by company/division directly from `m_item`.

### Plan 11.3: Native MR Division Assignments & Local Notices
- **Files:**
  - `src/server/actions/mrInfo.ts` (Enhance: single source of truth for MR divisions, eliminating `mrManufacturers`)
  - `src/server/actions/notices.ts` (Refactor: replace Postgres `notices` table with file-backed `data/notices.json`)
  - `src/components/mr-dashboard-content.tsx` (Clean up: remove residual Drizzle schema reads)
- **Details:**
  - `getMRInfo(mrId)` returns all assigned divisions natively from `l_mktcompany_mr`.
  - Admin notice management writes directly to `data/notices.json`.

### Plan 11.4: Neon DB Deprecation & Package Removal
- **Files:**
  - `.env` (Keep `DATABASE_URL` commented out, do NOT remove)
  - `src/env.js` (Make `DATABASE_URL` optional `z.string().url().optional()`)
  - `src/server/db/schema.ts` (Delete or replace with types-only file)
  - `src/server/db/index.ts` (Delete)
  - `package.json` (Uninstall `@neondatabase/serverless`, `postgres`, `drizzle-orm/pg-core`)
- **Details:**
  - Verify zero remaining imports of `src/server/db`.
  - Remove Postgres packages.
  - Run `pnpm exec tsc --noEmit` and build test to ensure 100% clean decoupling.

---

## Verification & Acceptance Criteria
- [ ] MR login works via Email OTP sent using Gmail SMTP (`GMAIL_USER` / `GMAIL_PASS`) without touching any session database table.
- [ ] Admin & Developer accounts log in via email & password specified in `.env`.
- [ ] All 5 reports continue functioning normally with zero regressions.
- [ ] Product listings render directly from `pdyasvmaster.m_item`.
- [ ] Notices read and write cleanly to `data/notices.json`.
- [ ] `DATABASE_URL` is commented out in `.env` and optional in `src/env.js`.
- [ ] Neon Postgres is 100% removed.
- [ ] Zero `CREATE TABLE` queries executed on the legacy MySQL database.
- [ ] `pnpm exec tsc --noEmit` passes with 0 errors.
