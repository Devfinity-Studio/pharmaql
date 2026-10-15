# Phase 26: Developer Debug Suite & Email Credentials Integration - Context & Requirements

## Objectives
Provide developers with a dedicated, high-visibility **Debug Console** tab within the Developer Control Center (`/admin/dev`), equipping them with one-click interactive test tools for Web Push notifications, in-app alerts, SMTP email dispatch, storage latency, rate limit testing, and procedure diagnostics. Add full support for **Developer Email Credentials** (`DEV_SMTP_USER`, `DEV_SMTP_PASS`, `DEV_EMAIL`) so subscription reminders, renewal notices, and developer system alerts originate directly from the developer's email credentials to Admins and MRs.

---

## 1. Developer Email Credentials & Dedicated Transporter (`src/lib/mailer.ts`)
- **Developer SMTP Configuration**:
  - Support `DEV_SMTP_USER`, `DEV_SMTP_PASS`, and `DEV_EMAIL` in environment variables.
  - Optional support for custom host/port (`DEV_SMTP_HOST`, `DEV_SMTP_PORT`), defaulting to Gmail service if not specified.
  - Implement `getDeveloperMailer()` helper with connection pooling and graceful fallback to primary admin transporter if developer credentials are unset.
- **Developer Email Dispatch Action (`sendDeveloperEmail`)**:
  - Formats `from:` header as `"${license.organization || 'PharmaQL'} Developer" <${devEmail}>`.
  - Replaces generic admin dispatch in `sendSubscriptionReminderEmails()` in `src/lib/license.ts` so license invoices and alerts to Admins/MRs use the developer's verified sender address.
- **Test Email Dispatcher Server Action**:
  - Server action `sendTestEmailAction({ recipient, subject, useDeveloperCredentials })` allowing developers to send an immediate test email and receive real-time SMTP connection handshake status and detailed error traces.

---

## 2. Dedicated Developer Debug Console Tab in `/admin/dev`
- **New Tab Addition**:
  - Add `debug` tab ("Debug & Diagnostics") with icon `Terminal` / `Bug` to the main navigation of `DevControlCenter` (`src/components/dev-control-center.tsx`).
- **Core Diagnostic Sections**:
  1. **Notification Dispatch Sandbox**:
     - Interactive controls to send test Web Push and In-App notifications.
     - Custom payload options: Title, Message Body, Deep Link (`/dashboard?tab=overdue`, etc.), Urgency level (`HIGH`, `MEDIUM`, `LOW`), Target (`CURRENT_USER`, `SPECIFIC_MR`, `ALL_MRS`, `ALL_ADMINS`, `BROADCAST_ALL`).
     - Live response banner displaying delivery count, pruned endpoints, and in-app archive ID.
  2. **Email Connectivity & Dispatch Test**:
     - Real-time verification of both Admin SMTP (`GMAIL_USER`) and Developer SMTP (`DEV_SMTP_USER`).
     - One-click "Send Test Email" to specified recipient with template selector (OTP preview, Subscription Reminder preview, System Alert preview).
     - Visual indicator showing whether Developer Email Credentials are configured in environment.
  3. **Rate Limiting & Security Debugger**:
     - Real-time client IP resolution (`getClientIp`).
     - Display active rate limit buckets and remaining token allowances.
     - "Reset My IP Rate Limit" button and "Simulate Limit Hit" test button.
  4. **Active Storage Engine Latency & Integrity Test**:
     - Automated probe writing a test file to active storage (`getServerDataDir()`), reading back bytes, calculating round-trip write/read latency, and safely cleaning up.
     - Displays active storage backend path (`/tmp/pharmaql-data` on Vercel vs `data/` local).
  5. **API & Database Roundtrip Benchmark**:
     - Live round-trip query probe measuring Express API latency and MySQL connection pool responsiveness.

---

## 3. Masked Environment & Config Guidance
- **Developer Credentials Guidance**:
  - Update `getMaskedEnvInspection()` in `src/lib/runtime-config.ts` to display masked status of `DEV_SMTP_USER` and `DEV_SMTP_PASS`.
  - Update `.env.example` with documented developer credentials.

---

## 4. Verification & Quality Gates
- **Automated Test Script (`scratch/test-phase26-debug.ts`)**:
  - Validate developer mailer initialization and fallback logic.
  - Validate test notification dispatch and recipient routing.
  - Validate storage latency probe execution and error handling.
- **Typecheck & Build**:
  - `pnpm run typecheck` passes with zero errors.
  - `pnpm run build` succeeds across all static and dynamic pages.
