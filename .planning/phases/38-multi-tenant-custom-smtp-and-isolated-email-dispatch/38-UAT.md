# Phase 38: Multi-Tenant Custom SMTP & Isolated Email Dispatch — Verification & UAT

**Milestone:** Milestone 1 - Production Hardening & Optimization  
**Phase:** Phase 38  
**Status:** Executed, Tested & Verified  
**Date:** 2026-10-30

---

## 1. Executive Summary

Phase 38 delivers dedicated, isolated email delivery for each client organization hosted on PharmaQL:
- Encrypted SMTP credentials (`smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_password_encrypted`, `smtp_from_name`, `smtp_from_email`) stored at rest via AES-256-GCM in Neon PostgreSQL.
- Idempotent schema migrations appended to `initControlPlaneRelationalSchema()`.
- Dynamic, pooled nodemailer transporters in memory (`getTenantMailer(tenantId)` with 15-minute TTL caching and `evictTenantMailer(tenantId)`).
- Complete white-labeling of OTP verification emails (organization logo, primary colors, organization title, and support email footer).
- Strict email isolation policy preventing cross-tenant leakage: MR OTP requests on tenants without configured custom SMTP are blocked with the user-friendly message `"Email service is not configured for this organization. Please contact your administrator."`
- Client Admin Portal dashboard warning banner alerting administrators when their organization has not configured SMTP credentials.
- Full-page Tenant Form Section 5 ("Email & Notification Services (SMTP)") with 1-click provider presets (Zoho IN, Zoho Global, Gmail, Outlook, Custom) and live SMTP handshake & delivery test diagnostics.

---

## 2. Test & Verification Artifacts

### 2.1 Automated Test Suites (Vitest)
- All **21 test files** and **118 unit tests** passed with exit code 0.
- Newly added suite: [`src/lib/__tests__/mailer.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/mailer.test.ts) covering:
  - Null resolution for unconfigured tenants.
  - Credential decryption and in-memory connection pooling.
  - Cache eviction via `evictTenantMailer`.
  - Rejection of MR OTP requests on unconfigured tenants.
  - White-labeled email template rendering with tenant brand colors and logo.

### 2.2 TypeScript Type Checking
- Executed `pnpm exec tsc --noEmit`.
- **0 errors**, strict type safety maintained across server actions, components, and library utilities.

### 2.3 Next.js Production Compilation
- Executed `pnpm run build` (`next build`).
- Exit code 0, 18 static/dynamic routes compiled cleanly with middleware.

---

## 3. Key Files Modified / Created

| Component / File | Purpose |
| :--- | :--- |
| [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts) | Added 7 SMTP fields to `TenantRecord` interface and idempotent `ALTER TABLE` migrations. |
| [`src/lib/local-tenants-store.ts`](file:///e:/work/pharmaql/src/lib/local-tenants-store.ts) | Parity for local JSON store and offline development fallbacks. |
| [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts) | Added SMTP password AES-256-GCM encryption in `saveTenantAction`, updated `listTenantsAction` and `getTenantAction`, and implemented `testTenantSmtpAction`. |
| [`src/components/tenant-form.tsx`](file:///e:/work/pharmaql/src/components/tenant-form.tsx) | Built Section 5 ("Email & Notification Services (SMTP)") with 1-click presets and interactive live test diagnostic box. |
| [`src/lib/mailer.ts`](file:///e:/work/pharmaql/src/lib/mailer.ts) | In-memory connection pool `getTenantMailer()`, `evictTenantMailer()`, and dynamic white-labeled `sendOtpEmail()`. |
| [`src/server/actions/authActions.ts`](file:///e:/work/pharmaql/src/server/actions/authActions.ts) | Enforced zero-leakage check in `requestMrOtp` and passed `tenantId` to `sendOtpEmail`. |
| [`src/app/admin/dashboard/page.tsx`](file:///e:/work/pharmaql/src/app/admin/dashboard/page.tsx) | Added client admin dashboard warning banner when SMTP is unconfigured. |
| [`src/lib/__tests__/mailer.test.ts`](file:///e:/work/pharmaql/src/lib/__tests__/mailer.test.ts) | Unit tests verifying multi-tenant mailer pool, caching, and white-labeled OTP dispatch. |
