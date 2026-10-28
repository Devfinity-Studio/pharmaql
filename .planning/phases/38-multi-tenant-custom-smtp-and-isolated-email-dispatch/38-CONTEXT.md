# Phase 38: Multi-Tenant Custom SMTP & Isolated Email Dispatch - Context

**Milestone:** Milestone 1 - Production Hardening & Optimization  
**Active Phase:** Phase 38  
**Status:** Added to roadmap. Ready for discussion & planning.

---

## 1. Objective

Enable separate, dedicated email delivery for each client tenant on PharmaQL. Store encrypted SMTP credentials per tenant in Neon Postgres, dynamically instantiate isolated tenant mailers for login OTPs and notifications, provide live SMTP handshake and test email diagnostics within the full-page Tenant Form (`/admin/tenants/[id]` and `/admin/tenants/new`), and dynamically white-label email templates (logo, primary color, company name, custom support links) while gracefully falling back to platform mailer with custom display name and reply-to when SMTP is unconfigured.

---

## 2. Planned Scope

1. **Relational Database Schema & Credential Encryption**:
   - Add columns to `tenants` table in Neon Postgres and local fallback store:
     - `smtp_host VARCHAR(128)` (e.g. `smtp.zoho.in`, `smtp.gmail.com`, `smtp.office365.com`)
     - `smtp_port INTEGER DEFAULT 465` (e.g. 465 SSL, 587 TLS)
     - `smtp_user VARCHAR(128)` (e.g. `notifications@asmeepharma.com`)
     - `smtp_password_encrypted TEXT` (AES-256-GCM encrypted using master platform key)
     - `smtp_from_name VARCHAR(128)` (e.g. `Asmee Pharma Portal`)
     - `smtp_from_email VARCHAR(128)` (e.g. `notifications@asmeepharma.com`)

2. **Dynamic Tenant Mailer Pool (`src/lib/mailer.ts`)**:
   - Create `getTenantMailer(tenantId?: string)` resolving dedicated transporter instances cached in memory.
   - If tenant has custom SMTP configured, send through their server with their verified sender address.
   - If tenant does NOT have custom SMTP configured, fall back to platform mailer with tenant display name (`"${tenant.name} via PharmaQL" <platform_email>`) and `reply-to: tenant.support_email`.

3. **Dynamic White-Labeled Email Templates**:
   - Refactor `sendOtpEmail` in [`src/lib/mailer.ts`](file:///e:/work/pharmaql/src/lib/mailer.ts) and system alerts to replace hardcoded "Asmee Pharma" branding with dynamic tenant branding (logo, primary color, company name, footer stationery).

4. **Tenant Form SMTP Configuration & Test Diagnostics**:
   - Add "Email Services (SMTP)" section to [`src/components/tenant-form.tsx`](file:///e:/work/pharmaql/src/components/tenant-form.tsx).
   - Provider presets (Zoho Mail, Google Workspace/Gmail, Microsoft 365, Custom SMTP) with auto-filled host and ports.
   - Live "Send Test Verification Email" button triggering `testTenantSmtpAction` to verify connectivity before saving.

5. **Verification & Regression Testing**:
   - Unit tests for encrypted SMTP credential storage and dynamic mailer resolution.
   - Vitest test suite pass, zero TypeScript errors (`tsc --noEmit`), and clean Next.js production build (`next build`).
