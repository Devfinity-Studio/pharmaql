# Phase 26: Developer Debug Suite & Email Credentials Integration - Summary

## Overview
Phase 26 equips developers with a high-visibility, full-featured **Debug Console** tab within the Developer Control Center (`/admin/dev`), providing interactive diagnostic tools for Web Push notifications, in-app alerts, SMTP gateway handshakes, active storage write/read latency, rate limiter bucket resets, and API/database roundtrip probes. Dedicated **Developer Email Credentials** (`DEV_SMTP_USER`, `DEV_SMTP_PASS`, `DEV_EMAIL`) were also implemented so license renewal invoices, killswitch notifications, and technical alerts sent from the developer portal originate directly from developer credentials rather than the standard admin mailer.

---

## Deliverables & Key Changes

### 1. Developer Mailer Infrastructure (`src/lib/mailer.ts`)
- **Developer Transporter Factory (`getDeveloperMailer`)**:
  - Dynamically detects `DEV_SMTP_USER` and `DEV_SMTP_PASS` in environment.
  - Supports custom SMTP hosts (`DEV_SMTP_HOST`, `DEV_SMTP_PORT`), defaulting to Gmail service when omitted.
  - Automatically falls back to standard `mailer` if developer credentials are not yet configured.
- **Dedicated Dispatch Function (`sendDeveloperEmail`)**:
  - Sets verified `from:` header: `"${senderName}" <${devEmail}>`.
  - Used by [`src/lib/license.ts`](file:///e:/work/pharmaql/src/lib/license.ts) in `sendSubscriptionReminderEmails()` to guarantee renewal notices originate from developer credentials.
- **Gateway Handshake Verifier (`verifyMailerConnection`)**:
  - Executes `transporter.verify()` measuring roundtrip handshake latency in milliseconds with clear success/error output.

### 2. Diagnostics Server Actions (`src/server/actions/devDiagnostics.ts`)
- `sendTestEmailAction`: Dispatches formatted test emails (OTP Preview, License Renewal Notice, Service Health Alert, or Custom Diagnostic Note) using either Developer or Admin SMTP credentials.
- `verifyMailerCredentialsAction`: Tests live connection to SMTP providers for either Admin or Developer gateways.
- `probeStorageLatencyAction`: Performs atomic write, read, and delete on active storage (`getServerDataDir()`), returning read/write latency in ms and serverless routing state.
- `probeDatabaseLatencyAction`: Pings Express API `/api/debug` and measures roundtrip HTTP and MySQL response latency.
- `getClientRateLimitStatusAction` & `resetClientIpRateLimitAction`: Inspects detected client IP and unlocks sliding rate limit buckets on demand.

### 3. Developer Debug Console UI (`src/components/dev-control-center.tsx`)
- Added `debug` tab ("Debug Console" with `Terminal` icon) to navigation.
- **Developer Credentials Banner**: Displays real-time configuration status, masked sender email, port, and quick handshake verification buttons for both Developer and Admin SMTP.
- **Send Test Notification Card**: Interactive controls to dispatch Web Push and in-app alerts with target selector (Self-Test, MR, Admin, Broadcast) and live delivered/pruned endpoint counters.
- **Send Test Email Card**: Recipient input, template selector, Developer vs Admin gateway toggle, and live delivery status readout.
- **Active Storage Latency Card**: Displays active directory (`/tmp/pharmaql-data` on Vercel vs `data/` local) and write/read latency benchmark.
- **Rate Limit Inspection Card**: Resolves client IP and provides a one-click "Reset My IP" button.
- **API & Database Latency Card**: Displays roundtrip response time and connection status.

### 4. Configuration & Environment Templates
- Updated [`src/lib/runtime-config.ts`](file:///e:/work/pharmaql/src/lib/runtime-config.ts) `getMaskedEnvInspection()` to expose masked developer SMTP fields.
- Updated [`.env.example`](file:///e:/work/pharmaql/.env.example) with documented variables for `DEV_SMTP_USER`, `DEV_SMTP_PASS`, `DEV_SMTP_HOST`, and `DEV_SMTP_PORT`.
- Updated [`.gitignore`](file:///e:/work/pharmaql/.gitignore) to exclude temporary probe benchmark files (`/data/.probe*`).

---

## Verification & Quality Gates
- **Automated Test Suite (`scratch/test-phase26-debug.ts`)**:
  - `[1/5]` Developer Mailer & Credentials infrastructure: **PASS**
  - `[2/5]` SMTP Verification Handshakes: **PASS** (Admin & Developer)
  - `[3/5]` Masked Environment Inspection: **PASS**
  - `[4/5]` Active Storage Write/Read Benchmark: **PASS** (9ms roundtrip)
  - `[5/5]` Rate Limiting Lock & Reset Engine: **PASS**
- **Phase 25 Notifications Regression (`scratch/test-phase25-notifications.ts`)**: 6/6 tests passed.
- **Typecheck**: `pnpm run typecheck` passed with 0 errors.
- **Production Build**: `pnpm run build` compiled 100% cleanly across all 15 routes.
