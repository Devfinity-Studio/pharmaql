# Phase 23: Developer Options & Developer Account - Context & Requirements

## Objectives
Introduce an enterprise Developer Control Center and full-fledged Developer role in PharmaQL. Provide software subscription/licensing lifecycle management with an emergency killswitch, automated renewal reminder emails to Admins, global and granular maintenance mode/feature switchboard, runtime environment key management, multi-service health monitors, unified user and system log inspection, MR view-as simulation, and stored procedure diagnostics—while guaranteeing zero writes to the legacy ERP database.

---

## 1. Developer Role Architecture & Access Control
- **Role Differentiation**:
  - `MR`: Medical Representative (strictly scoped to assigned companies and ranking permissions).
  - `ADMIN`: Business administrator (manages notices, MR access, customer unblocks).
  - `DEVELOPER`: Superuser engineer with full administrative authority plus low-level system diagnostic tools, licensing control, maintenance toggles, environment management, and cache flushes.
- **Access Gates**:
  - Update `src/app/admin/layout.tsx` to permit both `ADMIN` and `DEVELOPER`.
  - Restrict `/admin/dev/*` exclusively to `session.user.role === "DEVELOPER"`.
  - Distinct purple/cyan "DEVELOPER" badge and role-scoped navigation in `CollapsibleSidebar`.

---

## 2. Software Subscription Lifecycle, Killswitch & Admin Reminder Mails
- **License Configuration (`data/license.json`)**:
  - `status`: `"ACTIVE"` | `"EXPIRED"` | `"SUSPENDED"`
  - `expiresAt`: ISO Date string (e.g., `2027-03-31T23:59:59Z`)
  - `killswitchActive`: boolean (emergency manual software freeze)
  - `gracePeriodDays`: number (e.g. 7 days grace)
  - `organization`: "Asmee Pharma Pvt. Ltd."
  - `supportEmail`: "support@devfinity.net"
  - `developerEmail`: "dev@asmeepharma.com"
  - `adminEmails`: string[] (list of Admin notification recipients)
  - `updatedAt`: ISO Date string
  - `updatedBy`: Developer email
- **Global Blocking Mechanism**:
  - Intercepted in Next.js middleware and layouts:
    - If `killswitchActive === true` or current date > `expiresAt + gracePeriod`:
      - All regular traffic (MRs, standard Admins) is redirected to `/license-expired` (or a full-page lock screen).
      - Renders a clean, high-contrast lock screen: "Software Subscription Ended — Please contact Devfinity to renew your license."
      - Developers (`DEVELOPER` role) bypass the lockout so they can login and manage/renew the license from `/admin/dev/license`.
- **Developer License Controls**:
  - View subscription status, days remaining countdown, expiration date.
  - Extend expiration date (e.g., +30 days, +1 year, or custom date).
  - Toggle emergency killswitch to instantly lock/unlock the entire application.
- **Automated & Manual Renewal Emailer**:
  - Developer action to dispatch subscription renewal / invoice reminder emails from Developer Email (`dev@asmeepharma.com` / `billing@devfinity.net`) directly to all registered Administrator emails.
  - Template includes company name, expiry date, days remaining, bank/payment details, and official renewal contact.

---

## 3. Granular Feature Switchboard & Global Maintenance Mode
- **Feature Switchboard Storage (`data/feature_toggles.json`)**:
  - Individual feature services can be toggled with 4 scope levels:
    - `ACTIVE`: Available for all authorized roles.
    - `DISABLED_FOR_MRS`: Disabled for MRs (shows maintenance notice on their tab), active for Admins.
    - `DISABLED_FOR_ADMINS`: Disabled for Admins, active for MRs.
    - `DISABLED_FOR_ALL`: Completely disabled for everyone except Developers.
  - Toggled Services:
    1. `Stock Movement Report`
    2. `Sales & Invoice Details`
    3. `Party Wise Sales`
    4. `Product Wise Sales`
    5. `Claim Quantity & Free Scheme`
    6. `Periodical Outstanding & Overdue`
    7. `Report Downloads (PDF & Excel)`
    8. `Notice Board & Announcements`
- **Global Maintenance Mode (`data/maintenance.json`)**:
  - Global switch with target audience:
    - `DISABLED`: Normal operations.
    - `MRS_ONLY`: MR portal under maintenance; Admin & Dev remain open.
    - `ALL_USERS`: Entire software under maintenance for MRs and Admins (Developers always bypass).
  - Configurable maintenance banner message, reason, and estimated completion time (e.g., "System undergoing scheduled database indexing until 10:00 PM").
  - Dedicated branded Maintenance Screen for blocked users.

---

## 4. Environment & Runtime Configuration Management
- **Config Storage (`data/runtime_config.json`)**:
  - Manage dynamic configuration keys without requiring redeployment:
    - `ADMIN_ALLOWED_IPS`: Comma-separated list of allowed admin IPs/subnets.
    - `DEBUG_MODE`: Toggle verbose API and SQL query telemetry.
    - `RATE_LIMIT_STRICT_MODE`: Toggle aggressive vs. lenient rate limiting.
    - `MR_OVERDUE_GRACE_DAYS`: Default grace period for unblock actions.
    - `MAINTENANCE_BANNER`: Custom broadcast message displayed globally.
- **Developer UI**:
  - Form to update runtime configuration with instant hot-reload.
  - Read-only inspection of masked environment variables (SMTP user, API Server URL, Database name, Port) to verify active deployments without exposing secrets.

---

## 5. Multi-Service Health & Telemetry Monitor
- **Health Checks Panel**:
  - **Next.js Web Frontend**: Uptime, Node.js version (`v26.7.0`), RSS memory, heap usage, CPU load.
  - **Express API Backend**: Real-time ping check to `/health`, HTTP status, API latency in milliseconds.
  - **Legacy MySQL ERP Database**: Connection pool status, active query latency, alive check (`SELECT 1`).
  - **SMTP Mailer Service**: Verification of Gmail SMTP connection and credentials handshake.
  - **Local Storage & Data Integrity**: File system write/read latency for `data/` directory (`audit_logs.json`, `license.json`, `notices.json`).

---

## 6. Unified Log Inspector (User Audit + System Logs)
- **User Activity Audit Stream**:
  - Live stream of logins, failed OTP attempts, password checks, unblock exemptions, and report export downloads.
- **System & API Server Logs**:
  - Live system log feed capturing API server HTTP routes, response status codes, execution duration (ms), and internal errors.
- **Filtering & Search**:
  - Real-time search by user, IP, error code, or keyword.
  - Severity level toggles: `ALL`, `INFO`, `WARN`, `ERROR`.
  - One-click log export (JSON / CSV).

---

## 7. MR Impersonation & "View-As" Simulation Mode
- **Feature**:
  - Allows Developers to preview the entire application as any registered MR (e.g., test Rank 1 Stock-only vs Rank 2 Claim-enabled vs Rank 3 Full access, or overdue blocked accounts).
  - Uses an isolated preview session cookie (`pharmaql_impersonate`) that does not overwrite or destroy the developer's master session.
  - Prominent sticky top bar: `"Simulating MR: [MR Name] ([ID]) — Rank [X] | [Exit Simulation]"`.
  - One-click exit returning immediately to the Developer Panel.

---

## 8. Stored Procedure Playground & Cache Management
- **Stored Procedure Sandbox**:
  - Test bench to execute read-only stored procedures (`rptStockMovementStatement`, `rptItemCustomerSale`, `rptMRwisePeriodicalOutstanding`, `rptClaimData`) with custom date/MR parameters.
  - Displays row count, query execution time (ms), column schemas, and formatted table preview.
  - Hardened with safety fences to forbid write operations (`INSERT`, `UPDATE`, `DELETE`, `DROP`).
- **Cache & Rate Limit Controls**:
  - View currently tracked IP / user rate limit buckets.
  - One-click "Flush All Rate Limits" button to clear lockouts.
  - One-click "Flush Master Data Caches" to force re-fetch of ERP customer, item, and company lists.

---

## 9. Verification & Quality Gates
- Verify subscription expiration and killswitch blocks MRs/Admins while permitting Developers.
- Verify subscription renewal reminder email dispatch from developer to admin addresses.
- Verify individual feature toggles correctly disable specific report tabs for MRs or Admins.
- Verify global maintenance mode display with custom estimated completion time.
- Verify runtime config editing updates behavior without server restart.
- Verify multi-service health checks across Next.js, Express API server, and MySQL ERP database.
- Full TypeScript typecheck and clean production Next.js build validation.
