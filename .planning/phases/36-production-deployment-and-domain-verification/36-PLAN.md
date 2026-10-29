# Phase 36 Plan: Production Deployment & Multi-Tenant Custom Domain Verification

## Objective
Implement end-to-end multi-tenant domain provisioning, live DNS and SSL diagnostics, dynamic white-label client landing pages, and resilient ERP bridge offline safeguards for the Devfinity PharmaQL platform.

---

## Architectural Guardrails

1. **Edge Runtime Invariant (CRITICAL)**:
   - Next.js Edge Middleware ([`src/middleware.ts`](file:///e:/work/pharmaql/src/middleware.ts)) runs in Vercel Edge Runtime.
   - ZERO imports of Node.js native modules (`net`, `dns`, `tls`) or `pg` in middleware.
   - Middleware handles host resolution strictly via HTTP fetch (`@neondatabase/serverless`).
2. **Server Action & Node.js Driver Isolation**:
   - Vercel REST API calls, DNS queries (`dns.promises`), and TLS handshake probes run strictly inside Node.js Server Actions or server components.
3. **Graceful Fallback & Non-Blocking Transactions**:
   - If `VERCEL_API_TOKEN` is not configured, or if Vercel API is unreachable, tenant registration/updates in Neon Postgres must still succeed, returning an informative advisory without throwing.
4. **White-Label Purity**:
   - All client custom domains must render dynamic white-labeled metadata, landing page headers, and color schemes based on `TenantContext`, without hardcoded strings.
5. **Zero Test Regressions**:
   - All 13 existing test suites (75 tests) must continue to pass.

---

## Detailed Task Breakdown

### Task 1: Vercel Custom Domain API Integration (Seamless Hybrid)
- **Files**:
  - `src/lib/vercel-domain-service.ts`
  - `src/lib/__tests__/vercel-domain-service.test.ts`
  - `src/modules/control-plane/tenantActions.ts`
- **Implementation**:
  - Implement `src/lib/vercel-domain-service.ts`:
    - Reads `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, and optional `VERCEL_TEAM_ID`.
    - `addDomainToVercel(domain: string)`: Calls `POST https://api.vercel.com/v10/projects/:id/domains`.
    - `removeDomainFromVercel(domain: string)`: Calls `DELETE https://api.vercel.com/v10/projects/:id/domains/:domain`.
    - `getDomainVerification(domain: string)`: Calls `GET https://api.vercel.com/v9/projects/:id/domains/:domain/verify`.
    - Graceful fallback: If credentials are missing, returns `{ configured: false, reason: "Vercel credentials not configured; manual DNS setup required." }`.
  - In `src/modules/control-plane/tenantActions.ts`:
    - In `saveTenantAction`: If `custom_domain` is set or changed, call `addDomainToVercel(custom_domain)` in a non-blocking try/catch.
    - In `deleteTenantAction`: If tenant has `custom_domain`, call `removeDomainFromVercel(custom_domain)`.
  - Create unit tests in `src/lib/__tests__/vercel-domain-service.test.ts` testing successful API calls, authentication header passing, team ID support, and graceful missing credential handling.

### Task 2: In-Portal DNS & SSL Live Diagnostic Tooling
- **Files**:
  - `src/modules/control-plane/tenantActions.ts`
  - `src/modules/control-plane/__tests__/domain-diagnostics.test.ts`
  - `src/components/domain-diagnostic-modal.tsx`
  - `src/components/tenants-control-center.tsx`
- **Implementation**:
  - In `src/modules/control-plane/tenantActions.ts`, implement `checkDomainStatusAction(tenantId: string, customDomain: string)`:
    - Resolves DNS CNAME using Node.js `dns.promises.resolveCname` and A records using `dns.promises.resolve4`.
    - Checks whether CNAME points to `cname.vercel-dns.com` or A record points to `76.76.21.21`.
    - Probes HTTPS endpoint with 5-second timeout to verify TLS certificate handshake.
    - If `VERCEL_API_TOKEN` is present, calls `getDomainVerification` for authoritative Vercel status.
    - Returns `{ domain, dnsOk, cnameTarget, ips, sslOk, vercelConfigured, vercelVerified, recommendations }`.
  - Create `src/components/domain-diagnostic-modal.tsx`:
    - Clean dialog displaying live DNS and SSL status badges (Green = Verified, Amber = Propagating, Red = Misconfigured).
    - Shows copyable recommended CNAME / A records.
    - Includes live "Re-test Now" button.
  - In `src/components/tenants-control-center.tsx`:
    - Add a "Check DNS & SSL" icon button to each tenant row in the control center table.
    - Clicking the button opens the `<DomainDiagnosticModal />`.

### Task 3: Dynamic White-Labeled Client Landing Page (`/`)
- **Files**:
  - `src/app/page.tsx`
  - `src/components/client-landing-view.tsx`
  - `src/middleware.ts`
- **Implementation**:
  - Refactor `src/app/page.tsx`:
    - Remove hardcoded "Asmee Pharma" strings.
    - Resolve tenant context from headers (`x-tenant-name`, `x-tenant-logo`, `x-tenant-address`, `x-tenant-phone`, `x-tenant-email`, `x-tenant-gstin`, `x-tenant-primary-color`, `x-tenant-accent-color`).
    - Render a modern, responsive hero section showcasing the client's official portal with dynamic primary/accent colors.
    - Provide clear CTA buttons:
      - "Representative Login" (`/login`)
      - "Administrator Sign In" (`/admin/dashboard` or `/login?portal=admin`)
    - Dynamic footer showing `© {year} {tenant.displayName}. All rights reserved.` and powered by Devfinity Cloud Platform.

### Task 4: On-Premise ERP Bridge Offline Fallback & Order Guard
- **Files**:
  - `src/lib/api-client.ts`
  - `src/components/erp-offline-banner.tsx`
  - `src/app/dashboard/layout.tsx` (or top-level portal layout)
  - `src/lib/__tests__/erp-offline.test.ts`
- **Implementation**:
  - In `src/lib/api-client.ts`:
    - Implement a 6-second timeout safeguard using `AbortSignal.timeout(6000)`.
    - If the fetch throws a connection error or timeout, classify as `ERP_OFFLINE`.
  - Build `src/components/erp-offline-banner.tsx`:
    - Displays an amber warning banner when the on-premise ERP bridge is offline:
      *"ERP Bridge Sync Paused: Real-time inventory sync is temporarily offline. Viewing cached data."*
    - Includes a "Retry Connection" button.
  - Guard order submission: When ERP is offline, order submission displays an informative advisory preventing conflicting writes.

### Task 5: Testing, Validation & Documentation
- **Files**:
  - Vitest test suites
  - `pnpm run typecheck`
  - `pnpm run build`
  - `.planning/phases/36-production-deployment-and-domain-verification/36-UAT.md`
- **Implementation**:
  - Run all Vitest suites (ensure all 75+ tests pass).
  - Run TypeScript typecheck (`tsc --noEmit`).
  - Run production build (`next build`).
  - Generate comprehensive `36-UAT.md` with step-by-step verification instructions.
