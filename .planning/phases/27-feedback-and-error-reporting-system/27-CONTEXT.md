# Phase 27: In-App Feedback & Error Reporting System - Context & Requirements

## Objectives
Equip PharmaQL with a streamlined, reliable **In-App Feedback and Error Reporting System**. This empowers Medical Representatives (MRs) and Admins to report issues, bugs, data discrepancies, or suggestions directly from the field or office. Submissions are strictly text-based and lightweight, augmented with automated client diagnostics (route, tab, division, browser, OS, viewport, user metadata, recent console errors). Submitted reports are **accessible exclusively to Developers** within `/admin/dev`, and trigger an automated email to the Developer via the Admin Mailer containing full user and MR attribution details. A global React Error Boundary prevents white-screen crashes and provides a 1-click crash reporting flow.

---

## Locked Implementation Decisions

### 1. Trigger Placement & UI
- **Bottom-Right Corner Floating Icon**:
  - A discreet, modern floating action button (`z-50`) placed in the bottom-right corner of the viewport.
  - Visible and accessible on all pages for authenticated MRs, Admins, and Developers.
  - Clicking opens an elegant, responsive modal dialog.
  - Includes smooth hover effects and mobile-friendly touch targets.

### 2. Submission Content & Format (Text-Only)
- **Text-Only Design**:
  - Strictly text-based input (no heavy image or canvas screenshot uploads) ensuring instant loading, zero bundle bloat, and maximum reliability across poor mobile network connections.
- **Form Fields**:
  - **Category**:
    - 🐛 `Bug / Crash Report` (something is broken or behaving incorrectly)
    - 📊 `Data Discrepancy` (incorrect sales values, missing invoices, unexpected stock quantities)
    - 💡 `Feature Request / Suggestion`
    - 💬 `General Feedback`
  - **Urgency Level**: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`.
  - **Title / Subject**: Short summary of the issue.
  - **Description**: Detailed description of what happened, expected vs actual behavior.
  - **Contact Note (Optional)**: Optional phone or alternative contact note for field follow-up.

### 3. Automated Client Diagnostics & Telemetry
- Automatically collected and bundled with every ticket without requiring user effort:
  - **Application Context**: Current pathname, search params, active tab (`tab=stock`, `tab=sales`, etc.), active division/company filter.
  - **User & MR Attribution**: User ID, Name, Email, Role (`MR`, `ADMIN`, `DEVELOPER`), and MR Rank level (if MR).
  - **Device & Environment**: User-Agent, Browser name & version, OS, device type (mobile / tablet / desktop), PWA standalone status (`isPwa`).
  - **Viewport**: Screen dimensions and device pixel ratio (`window.innerWidth` x `window.innerHeight`).
  - **Network & State**: Online status (`navigator.onLine`).
  - **Recent Console Errors**: Ring buffer capturing the last 5 uncaught console errors or failed API fetch calls.

### 4. Visibility & Role Access (Developer-Only)
- **Submissions**: Allowed by **both Admins and MRs**.
- **Viewing & Management**: **Exclusively accessible to Developers** inside `/admin/dev` under a dedicated "Feedback & Bug Reports" tab. Admins do not see or manage bug reports, keeping the admin panel focused strictly on pharma business operations.

### 5. Automated Email Alerts to Developer
- **Email Route**:
  - Upon ticket submission, an automated notification is sent to the Developer email address (`DEV_EMAIL` or fallback developer inbox).
  - Sent via the **Admin Mailer** (`GMAIL_USER` / primary SMTP transporter).
- **Email Content**:
  - Subject: `[PharmaQL ${urgency}] ${category}: ${title} (from ${userName})`
  - Rich HTML body displaying:
    - **Submitted By**: Full MR/Admin name, User ID, Email, Role, Rank, and Division.
    - **Report Details**: Category, Urgency badge, Title, and Description.
    - **Diagnostic Snapshot**: Page URL, active tab, browser/device info, and error log snippet.
    - Direct link to inspect and manage the report in the Developer Control Center (`/admin/dev?tab=feedback`).

### 6. React Error Boundary & Crash Interceptor
- **Global Error Boundary (`src/components/error-boundary.tsx`)**:
  - Wraps dashboard page trees to intercept any uncaught client render exceptions.
  - Replaces white screens with a polished, branded fallback card ("Something went wrong").
  - Offers two instant actions:
    1. **"Report this Error to Developers"**: Pre-fills the feedback dialog with the crash message, component stack, and environment diagnostics for immediate 1-click submission.
    2. **"Reload Page"** or return to dashboard.

---

## Storage & Data Schema (`data/feedback_reports.json`)

```typescript
export interface FeedbackReport {
  id: string; // e.g. "FB-20261017-X8K2"
  category: "BUG" | "DATA_DISCREPANCY" | "FEATURE_REQUEST" | "GENERAL";
  urgency: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "WONT_FIX";
  title: string;
  description: string;
  contactNote?: string;
  submittedBy: {
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    mrRank?: number;
    division?: string;
  };
  diagnostics: {
    url: string;
    tab?: string;
    division?: string;
    userAgent: string;
    viewport: string;
    isPwa: boolean;
    isOnline: boolean;
    recentErrors?: string[];
  };
  developerNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}
```

---

## Planned Implementation Waves

- **Wave 1**: Storage & Server Actions
  - `src/lib/feedback.ts`: Core data management, read/write to `data/feedback_reports.json`, atomic lock persistence, filter/query engine.
  - `src/server/actions/feedback.ts`: `submitFeedbackAction`, `getFeedbackReportsAction`, `updateFeedbackReportAction`.
  - Integration with Admin mailer to dispatch email alert to Developer with MR attribution details.
- **Wave 2**: Floating Trigger & In-App Submission Dialog
  - `src/components/feedback-modal.tsx` & `src/components/floating-feedback-button.tsx`.
  - Mount globally across authenticated MR and Admin portal layouts.
  - Automatic diagnostics and error ring-buffer gathering.
- **Wave 3**: Global React Error Boundary
  - `src/components/error-boundary.tsx` with friendly fallback card and 1-click "Report Crash" workflow.
  - Integration into root MR and Admin layouts.
- **Wave 4**: Developer Control Center Feedback Management Tab
  - Add "Feedback & Bug Reports" tab into `src/components/dev-control-center.tsx`.
  - Filtering by status, category, urgency; search by MR/user/keyword.
  - Detailed diagnostic inspection drawer and status updates (`OPEN` -> `UNDER_REVIEW` -> `RESOLVED`) with developer notes.
- **Wave 5**: Verification & End-to-End Validation
  - Automated test script `scratch/test-phase27-feedback.ts`.
  - Validation of ticket persistence, email alerts, error boundary fallback, and typecheck/build checks.
