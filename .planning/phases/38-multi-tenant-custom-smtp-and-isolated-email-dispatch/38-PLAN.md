# Phase 38 Plan: Multi-Tenant Custom SMTP & Isolated Email Dispatch

## Objective

Enable separate, dedicated email delivery for each client organization hosted on PharmaQL. Store AES-256-GCM encrypted SMTP credentials per tenant in Neon PostgreSQL (with local store parity), dynamically instantiate isolated tenant mailers for login OTPs and notifications, enforce strict tenant SMTP configuration (blocking MR OTP logins when custom SMTP is unconfigured with clear user messaging and an admin warning banner), provide live SMTP handshake and test email diagnostics within the full-page Tenant Form (`/admin/tenants/[id]` and `/admin/tenants/new`), and dynamically white-label email templates (logo, primary color, company name, custom support links).

---

## Architectural Guardrails

1. **Strict Tenant Email Isolation (Zero Platform Leakage)**:
   - Each client organization must dispatch transactional emails (OTPs, notifications) exclusively from their own SMTP server and corporate domain.
   - If a tenant has not configured custom SMTP, MR OTP logins on that tenant's portal must fail gracefully with:  
     `"Email service is not configured for this organization. Please contact your administrator."`
   - Platform mailers (`process.env.GMAIL_USER` / developer mailers) must NEVER be used as silent fallback for client tenants.
2. **Encrypted At-Rest Credential Storage**:
   - `smtp_password_encrypted` must be encrypted using AES-256-GCM (`encryptSecret`) before saving to Neon or local fallback store.
   - Plaintext passwords must never be exposed to the client browser in list views or JSON payloads.
3. **Edge & Server Separation**:
   - Mailer modules (`nodemailer`, `net`, `tls`, `dns`) must strictly execute in Node.js server environments (`"use server"` actions / API routes).
   - Zero mailer imports in Edge middleware or client bundles.
4. **Connection Pooling & Performance**:
   - Cache instantiated tenant nodemailer transporters in an in-memory `Map<tenantId, Transporter>` with TTL / eviction to avoid TLS handshake overhead on every OTP request.
5. **Zero Regression Guarantee**:
   - All 20 existing Vitest suites (112 tests) must pass.
   - All new features covered by comprehensive unit tests.

---

## Detailed Task Breakdown

### Task 1: Neon Database Schema & Encryption Layer
- **Files**:
  - `src/lib/control-plane-db.ts`
  - `src/lib/local-tenants-store.ts`
- **Implementation**:
  - In `src/lib/control-plane-db.ts`:
    - Extend `TenantRecord` interface with:
      - `smtp_host?: string | null;`
      - `smtp_port?: number | null;`
      - `smtp_secure?: boolean | null;`
      - `smtp_user?: string | null;`
      - `smtp_password_encrypted?: string | null;`
      - `smtp_from_name?: string | null;`
      - `smtp_from_email?: string | null;`
    - In `initControlPlaneRelationalSchema()`, append idempotent DDL statements:
      ```sql
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(128);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 465;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(128);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_password_encrypted TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_from_name VARCHAR(128);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_from_email VARCHAR(128);
      ```
  - In `src/lib/local-tenants-store.ts`:
    - Update `TenantRecord` mappings and `DEFAULT_ASMEE_TENANT` defaults with null/default values for SMTP fields to preserve local offline dev compatibility.

---

### Task 2: Control Plane Tenant Actions & SMTP Diagnostics
- **Files**:
  - `src/modules/control-plane/tenantActions.ts`
  - `src/modules/control-plane/__tests__/tenantActions.test.ts`
- **Implementation**:
  - Update `SaveTenantInput`:
    - Add `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_password` (raw plaintext), `smtp_from_name`, `smtp_from_email`.
  - Update `TenantListItem`:
    - Add `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `has_smtp_password: boolean`, `smtp_from_name`, `smtp_from_email`.
  - In `saveTenantAction()`:
    - Encrypt `smtp_password` via `encryptSecret(input.smtp_password)` when provided.
    - If `input.smtp_password` is empty/undefined during edit, preserve existing `smtp_password_encrypted`.
    - Persist all SMTP fields to Neon `tenants` table.
  - Implement `testTenantSmtpAction(input: TestTenantSmtpInput)`:
    - Interface:
      ```ts
      export interface TestTenantSmtpInput {
        tenantId?: string;
        smtpHost: string;
        smtpPort: number;
        smtpSecure: boolean;
        smtpUser: string;
        smtpPassword?: string;
        smtpFromName?: string;
        smtpFromEmail?: string;
        recipientEmail: string;
      }
      ```
    - Resolve password (use provided raw password or decrypt stored password from database).
    - Instantiate ephemeral nodemailer transporter.
    - Measure handshake latency via `transporter.verify()`.
    - Dispatch a test email with subject `"PharmaQL SMTP Verification - [Tenant Display Name]"` and clean diagnostic HTML card.
    - Return `{ success: boolean, latencyMs: number, error?: string }`.
  - Add unit tests verifying encryption roundtrip, input validation, and diagnostic error handling.

---

### Task 3: Tenant Form SMTP UI & 1-Click Provider Presets
- **Files**:
  - `src/components/tenant-form.tsx`
- **Implementation**:
  - Add state variables:
    - `smtpHost`, `smtpPort`, `smtpSecure`, `smtpUser`, `smtpPassword`, `showSmtpPassword`, `smtpFromName`, `smtpFromEmail`.
    - Preset selector state: `"zoho_in" | "zoho_com" | "gmail" | "office365" | "custom"`.
    - Test diagnostic states: `isTestingSmtp`, `smtpTestResult`, `testRecipientType ("admin" | "custom")`, `customRecipientEmail`.
  - Build Section 5: **"Email & Notification Services (SMTP)"**:
    - **Provider Preset Dropdown**:
      - Zoho Mail (India): `smtp.zoho.in`, `465`, `secure: true`.
      - Zoho Mail (Global): `smtp.zoho.com`, `465`, `secure: true`.
      - Google Workspace / Gmail: `smtp.gmail.com`, `465`, `secure: true` (with helper badge explaining Google App Passwords).
      - Microsoft 365 / Outlook: `smtp.office365.com`, `587`, `secure: false` (STARTTLS).
      - Custom SMTP: manual host/port inputs.
    - **Sender Identity**:
      - `smtpFromName` (defaults to Organization Display Name).
      - `smtpFromEmail` (defaults to `smtpUser`).
    - **Live Diagnostics Box**:
      - Toggle recipient: "Send to Admin Email (`adminEmail`)" vs "Custom Recipient".
      - "Send Test Verification Email" button with inline loading spinner and latency/error badge.
  - Include SMTP fields in `handleSubmit` payload sent to `saveTenantAction`.

---

### Task 4: Dynamic Tenant Mailer Pool & White-Labeled Templates
- **Files**:
  - `src/lib/mailer.ts`
  - `src/lib/__tests__/mailer.test.ts`
- **Implementation**:
  - Maintain an in-memory cache:
    ```ts
    const tenantTransporters = new Map<string, { transporter: Transporter; cachedAt: number }>();
    ```
  - Implement `getTenantMailer(tenantId: string): Promise<{ transporter: Transporter; sender: { name: string; email: string }; brand: { name: string; logoUrl?: string | null; primaryColor?: string | null; supportEmail?: string | null } }>`:
    - Fetch tenant record from Neon (`SELECT * FROM tenants WHERE id = $1`).
    - If `smtp_host` or `smtp_user` or `smtp_password_encrypted` is missing:
      - Return `null` (or throw specific `TenantSmtpNotConfiguredError`).
    - Decrypt `smtp_password_encrypted` using `decryptSecret`.
    - Return or instantiate pooled nodemailer transporter.
  - Refactor `sendOtpEmail`:
    - Add `tenantId?: string` parameter (or accept tenant branding metadata directly).
    - If `tenantId` is provided:
      - Acquire tenant mailer via `getTenantMailer(tenantId)`.
      - Dynamically render white-labeled HTML:
        - Organization logo (`logo_url`) or styled title text.
        - Primary brand color (`primary_color`) on header, OTP box border/background, and verification accents.
        - Support link (`support_email` or `contact_email`).
        - Sender display name and email.
    - If `tenantId` is NOT provided (fallback for legacy or platform dev accounts):
      - Use developer mailer or fallback admin mailer.
  - Export `evictTenantMailer(tenantId: string)` to clear cached transporter when tenant SMTP settings are updated.

---

### Task 5: Strict Tenant SMTP Enforcement & Admin Warning Banner
- **Files**:
  - `src/server/actions/authActions.ts`
  - `src/app/admin/dashboard/page.tsx`
- **Implementation**:
  - In `src/server/actions/authActions.ts` (`requestMrOtpAction`):
    - Retrieve active tenant ID from request headers (`x-tenant-id`).
    - Query tenant SMTP configuration status.
    - If SMTP is not configured for the active tenant:
      - Log audit event `AUTH_LOGIN_FAILURE` with reason `"SMTP not configured for tenant"`.
      - Return user-friendly error response:
        ```json
        {
          "success": false,
          "error": "Email service is not configured for this organization. Please contact your administrator."
        }
        ```
    - If SMTP is configured:
      - Dispatch OTP through `sendOtpEmail(targetEmail, otp, mr.name, tenant.id)`.
  - In `src/app/admin/dashboard/page.tsx`:
    - On client portal views (`!isDevPortal`):
      - Query tenant SMTP configuration.
      - If unconfigured, render an amber warning card at the top of the dashboard:
        ```tsx
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-sm">Email Service Not Configured</h3>
            <p className="text-xs mt-1 text-amber-800">
              Medical Representative OTP logins are currently disabled because SMTP email credentials have not been configured for your organization.
            </p>
          </div>
        </div>
        ```

---

### Task 6: Verification & Validation Testing
- **Files**:
  - `src/lib/__tests__/mailer.test.ts`
  - `src/modules/control-plane/__tests__/tenantActions.test.ts`
  - `src/server/actions/__tests__/authActions.test.ts`
- **Implementation**:
  - Verify encryption & decryption of SMTP credentials.
  - Verify that missing SMTP on a tenant cleanly blocks OTP dispatch and returns the expected message.
  - Verify that configured custom SMTP successfully dispatches with dynamic branding.
  - Run full Vitest suite: `pnpm test`.
  - Run TypeScript typecheck: `tsc --noEmit`.
  - Run Next.js production build: `pnpm run build`.

---

## Acceptance Criteria
- [ ] Neon schema includes all 7 SMTP columns and migrations run idempotently.
- [ ] Passwords stored encrypted at rest via AES-256-GCM.
- [ ] Tenant Form has dedicated Section 5 with presets, custom inputs, and live test action.
- [ ] OTP emails display dynamic logo, organization name, primary colors, and support contacts.
- [ ] Unconfigured tenant portals block MR OTP requests with the locked user message.
- [ ] Client Admin dashboard alerts administrators when SMTP is unconfigured.
- [ ] All Vitest unit tests pass and build succeeds cleanly.
