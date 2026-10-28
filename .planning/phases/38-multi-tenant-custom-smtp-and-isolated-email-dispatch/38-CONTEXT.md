# Phase 38: Multi-Tenant Custom SMTP & Isolated Email Dispatch - Context

**Milestone:** Milestone 1 - Production Hardening & Optimization  
**Active Phase:** Phase 38  
**Status:** Discussed & Decisions Locked. Ready for Plan Phase (`/gsd-plan-phase 38`).

---

## 1. Objective

Enable separate, dedicated email delivery for each client tenant on PharmaQL. Store encrypted SMTP credentials per tenant in Neon Postgres, dynamically instantiate isolated tenant mailers for login OTPs and notifications, enforce strict tenant SMTP configuration (blocking MR OTP logins when custom SMTP is unconfigured with clear user messaging and an admin warning banner), provide live SMTP handshake and test email diagnostics within the full-page Tenant Form (`/admin/tenants/[id]` and `/admin/tenants/new`), and dynamically white-label email templates (logo, primary color, company name, custom support links).

---

## 2. Locked Implementation Decisions

### Area 1: Client SMTP Requirement & Fallback Policy
- **Strict Requirement Policy**:
  - Each client tenant must configure their own SMTP credentials to send transactional emails (OTPs, notifications, alerts).
  - If a tenant has **not** configured custom SMTP:
    - MR OTP requests on that tenant's portal are blocked with a clear user alert:  
      `"Email service is not configured for this organization. Please contact your administrator."`
    - Prevents cross-tenant platform mailer leakage and enforces complete customer communication isolation.
- **Admin Warning Banner**:
  - Display an amber warning banner in the client Admin Portal if SMTP is unconfigured:  
    `"⚠️ Email Service Not Configured — Medical Representative OTP logins are currently disabled. Please configure your organization's SMTP credentials."` with a direct link to the tenant settings.

### Area 2: Database Schema & AES-256-GCM Credential Encryption
- **Neon Postgres Relational Schema**:
  - Add the following columns to the `tenants` table in [`src/lib/control-plane-db.ts`](file:///e:/work/pharmaql/src/lib/control-plane-db.ts) (idempotent `ALTER TABLE ADD COLUMN IF NOT EXISTS`):
    - `smtp_host VARCHAR(128)` (e.g. `smtp.zoho.in`, `smtp.gmail.com`, `smtp.office365.com`)
    - `smtp_port INTEGER DEFAULT 465` (e.g. `465` SSL, `587` TLS)
    - `smtp_secure BOOLEAN DEFAULT true` (determines SSL vs STARTTLS)
    - `smtp_user VARCHAR(128)` (e.g. `notifications@clientcompany.com`)
    - `smtp_password_encrypted TEXT` (AES-256-GCM encrypted using `CONTROL_PLANE_ENCRYPTION_KEY`)
    - `smtp_from_name VARCHAR(128)` (e.g. `Apex Pharma Verification`)
    - `smtp_from_email VARCHAR(128)` (e.g. `no-reply@apexpharma.com`)
- **Local Fallback Store**:
  - Update `TenantRecord` interface and local tenant store in [`src/lib/local-tenants-store.ts`](file:///e:/work/pharmaql/src/lib/local-tenants-store.ts) to mirror these fields.

### Area 3: Tenant Form SMTP Configuration UI & Provider Presets
- **Section Location**:
  - Add an **"Email & Notification Services (SMTP)"** section in [`src/components/tenant-form.tsx`](file:///e:/work/pharmaql/src/components/tenant-form.tsx) on `/admin/tenants/new` and `/admin/tenants/[id]`.
- **1-Click Provider Presets**:
  - Provide a preset selector that automatically pre-populates host, port, and security settings:
    - **Zoho Mail (India)**: Host `smtp.zoho.in`, Port `465`, Secure `true`.
    - **Zoho Mail (Global)**: Host `smtp.zoho.com`, Port `465`, Secure `true`.
    - **Google Workspace / Gmail**: Host `smtp.gmail.com`, Port `465`, Secure `true` (with helper note on generating Google App Passwords).
    - **Microsoft 365 / Outlook**: Host `smtp.office365.com`, Port `587`, Secure `false` (STARTTLS).
    - **Custom SMTP**: Manual inputs for Host, Port, and SSL/TLS toggle.
- **Sender Identity ("From:") Configuration**:
  - Defaults to `"{Tenant Display Name}" <{smtp_user}>`.
  - Optional custom override fields for `smtp_from_name` and `smtp_from_email` for organizations utilizing mail distribution aliases.

### Area 4: Live Test Verification Diagnostics
- **Diagnostic Action (`testTenantSmtpAction`)**:
  - Implement a dedicated Node.js Server Action in [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts).
  - Instantiates a test transporter with the provided/stored credentials, performs `verify()` (SMTP handshake), and attempts sending a test message.
  - Returns detailed diagnostic results: `{ success: boolean, latencyMs: number, error?: string }`.
- **Recipient Target Options**:
  - Provide both options in the UI via toggle/radio:
    1. **Tenant Admin Email**: Sends automatically to `admin_email` configured on the tenant.
    2. **Custom Target Email**: Allows developer or admin to enter any custom recipient address (e.g. their personal email) for immediate delivery verification.

### Area 5: Dynamic White-Labeled Email Templates
- **Template Refactoring in [`src/lib/mailer.ts`](file:///e:/work/pharmaql/src/lib/mailer.ts)**:
  - Eliminate all hardcoded "Asmee Pharma" branding from `sendOtpEmail`.
  - Resolve the active tenant from request headers or tenant ID:
    - **Subject**: `Your ${tenant.display_name} Login Verification Code: ${otp}`
    - **Header**: Organization Logo (if `logo_url` configured) + Organization Name styled with `primary_color`.
    - **OTP Code Box**: Highlighted with `primary_color`.
    - **Footer**: Custom support link (`support_email` or `contact_email`).
- **Connection Pooling**:
  - Cache custom SMTP transporters in memory (`Map<tenantId, Transporter>`) to avoid renegotiating SMTP connections on every OTP request.

---

## 3. Verification & Validation Standards

1. **Unit Testing**:
   - Test SMTP credential encryption and decryption roundtrip.
   - Test dynamic mailer resolution (`getTenantMailer`): custom SMTP when configured, error/block when unconfigured.
   - Test OTP email formatting with dynamic tenant branding.
2. **TypeScript & Static Analysis**:
   - Clean `tsc --noEmit` with zero errors across all server actions, components, and libraries.
3. **Build & Production Readiness**:
   - `next build` compiles cleanly with no static or dynamic generation errors.
