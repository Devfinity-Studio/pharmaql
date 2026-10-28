# Phase 36: Production Deployment & Multi-Tenant Custom Domain Verification - UAT

## Phase Summary
Phase 36 implements the production deployment pipeline, automated hybrid Vercel custom domain provisioning, live in-portal DNS & SSL status diagnostics, dynamic white-label client landing page routing, and 6-second timeout ERP bridge offline safeguards.

---

## Completed Deliverables

1. **Automated Vercel Custom Domain Registration (`src/lib/vercel-domain-service.ts`)**:
   - Integrates with Vercel REST API (`POST /v10/projects/:id/domains` and `DELETE /v9/projects/:id/domains/:domain`).
   - Seamless non-blocking hybrid execution: if `VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID` are configured, automatically adds domain to Vercel upon tenant creation/edit in the Dev Control Center. If not, provides graceful manual DNS guidance without failing database transactions.
   - Comprehensive unit test suite (`src/lib/__tests__/vercel-domain-service.test.ts` - 7 tests).

2. **Live In-Portal DNS & SSL Diagnostics Tooling**:
   - Implemented `checkDomainStatusAction` in `src/modules/control-plane/tenantActions.ts` resolving CNAME targets (`cname.vercel-dns.com`) and Anycast IPv4 (`76.76.21.21`), querying Vercel verification API, and probing HTTPS TLS handshakes.
   - Built `<DomainDiagnosticModal />` (`src/components/domain-diagnostic-modal.tsx`) with color badges, copyable DNS records, actionable guidance, and instant "Re-test Now" testing.
   - Integrated into `<TenantsControlCenter />` table with dedicated "Check DNS & SSL" globe icon button.
   - Unit tests in `src/modules/control-plane/__tests__/domain-diagnostics.test.ts` (4 tests).

3. **Dynamic White-Labeled Client Landing Page (`src/app/page.tsx`)**:
   - Replaced static/hardcoded branding with dynamic tenant resolution from request headers (`x-tenant-name`, `x-tenant-logo`, `x-tenant-address`, `x-tenant-phone`, `x-tenant-email`, `x-tenant-gstin`, `x-tenant-primary-color`, `x-tenant-accent-color`).
   - Clean B2B hero section with dual sign-in gateways: "MR Portal Login" (`/login`) and "Administrator Sign In" (`/login?portal=admin`).
   - Dynamic corporate stationery footer powered by Devfinity Cloud Platform.

4. **ERP Bridge Offline Detection & Guard**:
   - Added 6-second `AbortSignal.timeout(6000)` and `isOfflineError` detection in `src/lib/api-client.ts`.
   - Created `<ErpOfflineBanner />` (`src/components/erp-offline-banner.tsx`) rendering amber sync-paused notifications and retry triggers.
   - Unit tests in `src/lib/__tests__/erp-offline.test.ts` (6 tests).

5. **Deployment Runbook**:
   - Documented complete production deployment steps in `DEPLOYMENT.md` covering master platform setup, client DNS, Vercel configuration, on-premise Windows API bridge setup, and Cloudflare Tunnel deployment.

---

## Verification Test Matrix

| # | Test Scenario | Method / Command | Result |
|---|---|---|---|
| 1 | Vercel domain service unit tests | `pnpm vitest run src/lib/__tests__/vercel-domain-service.test.ts` | PASS (7/7 tests) |
| 2 | Domain DNS/SSL diagnostic unit tests | `pnpm vitest run src/modules/control-plane/__tests__/domain-diagnostics.test.ts` | PASS (4/4 tests) |
| 3 | ERP bridge offline detection unit tests | `pnpm vitest run src/lib/__tests__/erp-offline.test.ts` | PASS (6/6 tests) |
| 4 | Full test regression suite | `pnpm test` | PASS (16 suites, 92 tests) |
| 5 | TypeScript typecheck | `pnpm run typecheck` (`tsc --noEmit`) | PASS (0 errors) |
| 6 | Next.js production build | `pnpm run build` | Compiling cleanly |
