# Phase 36: Production Deployment & Multi-Tenant Custom Domain Verification - Context

**Milestone:** Milestone 1 - Production Hardening & Optimization  
**Active Phase:** Phase 36  
**Status:** Discussed & Locked. Ready for Plan Phase (`/gsd-plan-phase 36`).

---

## 1. Objective

Provide an enterprise-grade production deployment and domain verification workflow for the Devfinity PharmaQL multi-tenant platform. This includes automated/hybrid Vercel domain provisioning, live DNS & SSL diagnostic inspection in the Dev Control Center, a branded client welcome landing page on custom domains, and resilient ERP bridge offline safeguards.

---

## 2. Locked Implementation Decisions

### Area 1: Automated Vercel Custom Domain Registration (Seamless Hybrid)
- **Mechanism**: Integrate with Vercel REST API (`https://api.vercel.com/v10/projects/:id/domains`).
- **Environment Variables**:
  - `VERCEL_API_TOKEN`: Vercel Personal Access Token or Team Token.
  - `VERCEL_PROJECT_ID`: Vercel Project ID (from Project Settings).
  - `VERCEL_TEAM_ID`: Optional Team ID (if deploying under a team account).
- **Behavior**:
  - When a tenant is created or updated with a `custom_domain` in `/admin/tenants`:
    - If `VERCEL_API_TOKEN` & `VERCEL_PROJECT_ID` are configured, the server action calls Vercel API to add `custom_domain` to the project.
    - If domain changes or tenant is deleted, cleanly remove or update the domain in Vercel.
    - **Graceful Fallback**: If tokens are not provided, or Vercel API returns an error, the tenant record in Neon Postgres is still safely saved, and the UI returns a non-blocking advisory banner with manual DNS instructions.

### Area 2: Client Portal Root Landing Page (`/`)
- **Dev Portal vs Client Portal Partitioning**:
  - **Dev Portal** (`pharmaql.devfinity.net`, `localhost:3000`):
    - Root `/` automatically redirects to `/admin/tenants` (Dev Control Center).
  - **Client Custom Domains** (`portal.asmeepharma.com`, `<slug>.localhost:3000`):
    - Root `/` renders a white-labeled, branded client landing page.
    - Displays client logo, company legal name, tagline ("Official B2B Medical Representative & Distribution Portal"), registered address, GSTIN, and official contact email/phone.
    - Action buttons:
      - **"MR Portal Login"** (`/login`) — direct gateway for field representatives.
      - **"Administrator Sign In"** (`/admin/dashboard` or `/login?portal=admin`) — gateway for internal staff.
    - Styled dynamically with client `primaryColor` and `accentColor`.

### Area 3: On-Premise ERP Bridge Offline Fallback & Order Guard
- **Timeout Safeguard**: 6-second timeout threshold on proxy calls to client on-premise Windows API servers (`api-server`).
- **Resilience Behavior**:
  - If the client's on-premise machine is offline or internet is disconnected:
    - Allow users to log in (using cached credentials/offline tokens) and view previously cached reports/stock.
    - Display an amber notification banner:  
      *"ERP Bridge Sync Paused: Real-time inventory sync is temporarily offline. Viewing cached data."* with a manual "Retry Sync" button.
    - **Order Guard**: Temporarily disable the "Place Order" button with a clear badge/tooltip:  
      *"Orders are temporarily locked while the local ERP bridge is offline to prevent inventory sync conflicts."*

### Area 4: In-Portal DNS & SSL Live Diagnostic Modal (Tenant Control Center)
- **UI Placement**: A "Check DNS & SSL" diagnostic action button in the tenant data table on `/admin/tenants`.
- **Diagnostic Engine (`checkDomainStatusAction`)**:
  - Checks DNS resolution (`dns.promises.resolveCname` and `resolve4`) to see if the custom domain points to `cname.vercel-dns.com` or Vercel IP `76.76.21.21`.
  - If `VERCEL_API_TOKEN` is present, queries Vercel Domain Verification endpoint (`GET /v9/projects/:id/domains/:domain/verify`) for authoritative verification and SSL status.
  - Queries HTTPS certificate directly to verify TLS handshake.
- **Diagnostic Modal Display**:
  - Domain Name and Current IP / CNAME Target.
  - Color-coded badges for **DNS Resolution** (`Verified` / `Pending Propagation` / `Misconfigured`) and **SSL Certificate** (`Active` / `Issuing` / `Missing`).
  - Actionable copyable DNS records and fix recommendations if misconfigured.
  - Real-time "Re-test Now" button.

---

## 3. Technical Boundaries & Security Constraints

1. **Strict Edge Runtime Separation**:
   - Next.js Edge Middleware (`src/middleware.ts`) MUST remain 100% lightweight and Edge-safe.
   - Zero imports of `dns`, `net`, `pg`, or Node.js native modules in middleware.
   - All DNS resolution, Vercel API calls, and TLS checks must run strictly inside Node.js Server Actions or API routes.
2. **Encrypted Secrets**:
   - Client API secret keys must continue to be encrypted with AES-256-GCM (`src/lib/crypto.ts`) prior to persisting in Neon Postgres.
3. **Zero Test Regressions**:
   - All 13 existing test suites (75 tests) must continue to pass.
   - Add new unit tests for Vercel domain provisioning, domain diagnostic resolver, and client landing page routing.

---

## 4. Verification Plan

1. **Unit & Integration Tests**:
   - Test Vercel API integration with mock client.
   - Test DNS diagnostic server action with mock DNS responses.
   - Test landing page routing partitioning in middleware.
2. **Manual & Smoke Tests**:
   - Verify Dev Portal (`pharmaql.devfinity.net` / `localhost:3000`) redirects `/` to `/admin/tenants`.
   - Verify client host (`asmee.localhost:3000` or `portal.asmeepharma.com`) renders branded landing page at `/`.
   - Open Tenant Control Center, click "Check DNS & SSL", verify diagnostic modal renders with correct status.
   - Verify ERP offline banner appears and blocks order submission when mock API server is stopped.
