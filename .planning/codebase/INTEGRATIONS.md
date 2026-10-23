# Integrations

**Date Mapped:** 2026-10-23  
**Project:** PharmaQL (B2B Medicine Supplier Portal)

---

## 1. External Database & ERP System

### Legacy On-Premises MySQL Database
PharmaQL does not connect directly from Next.js serverless functions to the MySQL database; instead, it interfaces through a dedicated API Gateway microservice (`api-server`).

- **Databases Accessed:**
  - `pdyasvtrans`: Transactional database containing live sales, stock movements, and party outstandings.
  - `pdyasvmaster`: Master database containing MR listings (`l_mktcompany_mr`), division links (`l_mktcompany`), and company profiles (`m_mktcompany`).
- **Connection Configuration:**
  - Configured in `api-server/.env` using `mysql2/promise` with connection pooling (up to 25 connections, 10 max idle, 60s idle timeout, keep-alive active).
- **Primary Stored Procedures Invoked:**
  - `rptStockMovementStatement`: Generates real-time opening, received, sales, and closing stock balances by location and manufacturer.
  - `rptStockandSalesStatementReport`: Detailed itemized stock movements and sales transactions.
  - `rptFreeSchemePartyWiseStatementReport`: Claim Quantity reports detailing free promotional scheme allocations by party and product.
  - `rptOverduePeriodicalOutstandings`: Aging report detailing overdue invoices (0–30, 31–60, 61–90, 91+ days).
  - `rptCustomerItemSaleStatementReport`: Party-wise sales breakdowns.
  - `rptPartyItemSaleStatementReport`: Product-wise item sales reports.
  - `rptCompanyWiseMonthlySales`: Aggregated monthly revenue and sales performance KPIs.

---

## 2. API Server Gateway (`api-server`)

The Next.js application acts as a Backend-For-Frontend (BFF), communicating with `api-server` over internal HTTP/HTTPS.

- **Endpoints Exposed:**
  - `/health`: Public database connectivity and heartbeat check.
  - `/api/auth/*`: MR profile lookups by email/phone (`/api/auth/mr-lookup`).
  - `/api/master/*`: Division list, company list, MR assignments, and master data queries with TTL in-memory caching.
  - `/api/reports/*`: Parameter-sanitized proxies to legacy stored procedures with ODBC date formatting.
  - `/api/kpi/*`: Executive sales and business metrics.
- **Security & Protocol:**
  - Global Bearer Token authentication via `API_SECRET_KEY` enforced through `api-server/src/middleware/auth.ts`.
  - Rate limited to 180 requests/minute per client IP.
  - Restricted CORS origin matching `ALLOWED_ORIGINS` (defaults to Next.js host).

---

## 3. Email Delivery (SMTP)

- **Service:** Nodemailer with Gmail SMTP Transport (`smtp.gmail.com:465` with SSL).
- **Credentials:** `GMAIL_USER` and `GMAIL_PASS` (Google App Password).
- **Use Cases:**
  - **OTP Authentication:** Generates and dispatches 6-digit numeric OTPs for Medical Representatives logging into the portal.
  - **Developer Alerts:** Automated alerts for licensing anomalies, killswitch triggers, and critical system errors.
  - **In-App Feedback Dispatch:** User reports and bug submissions sent directly to administrative email addresses.

---

## 4. Web Push Notification Service (PWA)

- **Library:** `web-push` v3.6.7 utilizing the Voluntary Application Server Identification (VAPID) protocol.
- **Key Storage:** VAPID public and private keys generated dynamically or loaded from `data/vapid_keys.json`.
- **Subscription Store:** Client push subscriptions stored in `data/push_subscriptions.json`.
- **Notification Types:**
  - Critical overdue invoice alerts (>80 days warning, >90 days direct blocking).
  - General supplier notices and company broadcast announcements.
  - System maintenance and feature updates.

---

## 5. Web Analytics & Monitoring

- **Vercel Analytics:** `@vercel/analytics` integrated into the root layout (`src/app/layout.tsx`) for performance and traffic telemetry.
- **Vercel Speed Insights:** Web vitals collection allowed via CSP headers.
- **Custom In-App Audit Trail:** `src/lib/audit-logger.ts` logs authentication events, failed logins, OTP attempts, admin overrides, and report export downloads into a rolling 1,000-entry JSON log.

---

## 6. Reverse Proxy & Networking (Caddy)

- **Caddy Server:** Configured for local development or production VPS hosting to manage SSL termination, HTTPS redirects, and reverse proxy routing between Next.js (port 3000) and `api-server` (port 9443).
- **Root Scripts:** `npm run caddy:start`, `npm run caddy:stop`, `npm run caddy:reload`.

---

## 7. Environment Variables Reference

### Next.js Application (`.env` validated via `src/env.js`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `API_SERVER_URL` | No | `https://api.asmeepharma.com` | Base URL of the `api-server` microservice |
| `API_SECRET_KEY` | Yes (Min 16 chars) | - | Shared secret Bearer token used to authenticate requests to `api-server` |
| `BETTER_AUTH_SECRET` | Yes | - | Cryptographic HMAC secret used by `jose` to sign stateless session JWTs |
| `GMAIL_USER` | Optional | - | Sender Gmail address for OTP and alerts |
| `GMAIL_PASS` | Optional | - | 16-character Gmail App Password |
| `ADMIN_EMAIL` | Optional | `asmeepharma2022@gmail.com` | Primary administrator login email |
| `ADMIN_PASSWORD` | Optional | - | Primary administrator password |
| `DEV_EMAIL` | Optional | `info@devfinity.net` | Developer super-admin account email |
| `DEV_PASSWORD` | Optional | - | Developer super-admin account password |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `test`, `production`) |
| `SKIP_ENV_VALIDATION`| No | - | Flag to bypass env validation during container/CI builds |

### API Server (`api-server/.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `9443` | Port for the Express microservice |
| `CLIENT_MYSQL_HOST` | No | `127.0.0.1` | Hostname or IP of the on-premises MySQL database |
| `CLIENT_MYSQL_PORT` | No | `2903` | Port of the MySQL service |
| `CLIENT_MYSQL_USER` | Yes | `pharmaql` | Database user with permissions to execute stored procedures |
| `CLIENT_MYSQL_PASSWORD`| Yes | - | Database user password |
| `CLIENT_MYSQL_DATABASE`| No | `pdyasvtrans` | Default database schema |
| `API_SECRET_KEY` | Yes | - | Shared secret Bearer token to authorize incoming requests |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated list of allowed CORS origins |
