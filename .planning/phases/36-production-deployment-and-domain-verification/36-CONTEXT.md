# Phase 36: Production Deployment & Multi-Tenant Custom Domain Verification - Context

## 1. Goal
Harden, verify, and document the end-to-end production deployment of the Devfinity PharmaQL multi-tenant platform on Vercel and Neon Serverless Postgres, establishing reliable custom domain resolution for tenant client portals (e.g. `portal.asmeepharma.com`) while isolating the Dev Portal (`pharmaql.devfinity.net`).

## 2. Key Scope & Objectives
1. **Production Environment Audit**:
   - Verify all required environment variables in Vercel (`CONTROL_PLANE_DATABASE_URL`, `CONTROL_PLANE_ENCRYPTION_KEY`, `DEV_PORTAL_DOMAIN`, developer SMTP, VAPID keys).
   - Ensure `?sslmode=require` is present on Neon Postgres queries.
2. **Neon Relational Schema Initialization in Production**:
   - Verify idempotent initialization of tables (`tenants`, `tenant_notices`, `tenant_features`, `tenant_licenses`, `tenant_runtime_config`) on cold starts without edge migration stalls.
3. **Vercel Custom Domain & DNS Ingress**:
   - Document and verify DNS records (CNAME `cname.vercel-dns.com` for subdomains, A record `76.76.21.21` for apex).
   - Verify SSL auto-provisioning via Let's Encrypt.
4. **Edge Host Resolution & Route Protection**:
   - Validate Next.js edge middleware routing:
     - Dev portal host (`pharmaql.devfinity.net` or `localhost:3000`) -> renders Devfinity Cloud Control Center.
     - Client custom domain (e.g. `portal.asmeepharma.com` or `asmee.localhost:3000`) -> loads Asmee Pharma branding, MR portal, and client ERP dashboard.
     - Client host navigating to `/admin/tenants` -> blocked and rewritten to 404.
     - Unmapped host -> rewritten to branded 404 (`/tenant-not-found`).
5. **On-Premise ERP Bridge Connectivity**:
   - Verify connection test and proxying from Vercel to client on-premise Windows API server via Cloudflare Tunnel / HTTPS.

## 3. Success Criteria
- Deployment guide (`DEPLOYMENT.md`) is complete, accurate, and tracked in git.
- Zero edge errors on unmapped or cold-boot host resolution.
- 100% of test suites pass (13 suites, 75 tests).
- Production build succeeds without errors.
