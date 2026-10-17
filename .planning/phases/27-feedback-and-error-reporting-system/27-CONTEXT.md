# Phase 27: In-App Feedback & Error Reporting System - Context & Requirements

## Objectives
Equip PharmaQL with a comprehensive, professional **In-App Feedback and Error Reporting System**. This empowers Medical Representatives (MRs) in the field and Admins in the office to report bugs, data discrepancies, UI glitches, or feature requests with automated contextual diagnostics (route, tab, browser, screen size, user metadata, recent client logs). Provide developers and administrators with a centralized **Feedback & Crash Management Center** in `/admin/dev` (and `/admin/feedback`), integrated with automatic React error boundaries and instant email alert dispatch via the Developer Mailer configured in Phase 26.

---

## 1. In-App Feedback & Bug Submission Widget
- **Accessible Widget / Button**:
  - Discreet floating trigger or top-bar button ("Report an Issue" / "Feedback" with icon) accessible across both MR portal and Admin dashboards.
  - Non-intrusive modal dialog with responsive mobile-friendly form layout.
- **Report Categorization & Metadata**:
  - Category selector:
    - 🐛 **Bug / Crash Report** (broken feature, display glitch, export issue)
    - 📊 **Data Discrepancy** (wrong values, missing invoices/stock rows)
    - 💡 **Feature Request / Suggestion**
    - 💬 **General Feedback**
  - Urgency level: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`.
  - Subject line and rich markdown/multiline description.
  - Optional contact phone / alternative email for field follow-up.
  - Optional screenshot / file attachment (image/pdf base64 data upload).

---

## 2. Automated Diagnostics & Crash Telemetry Collection
- **Client Context Snapshot**:
  - Automatically captures without user effort:
    - Current URL path, query params, active tab (`tab=stock`, `tab=sales`, etc.), selected division/company.
    - Current authenticated user ID, name, email, role (`MR`, `ADMIN`, `DEVELOPER`), and MR ranking level.
    - Browser name, version, OS, user-agent, device type (mobile, tablet, desktop, PWA standalone mode).
    - Viewport dimensions and screen resolution (`window.innerWidth`, `devicePixelRatio`).
    - Network status (`navigator.onLine`, connection type/downlink if supported).
    - Client timestamp.
- **Recent Console & Network Error Ring Buffer**:
  - Lightweight client-side error interceptor capturing the last 5 uncaught console errors or failed `fetch()` calls (status 4xx/5xx) to attach to bug reports.

---

## 3. Global React Error Boundary & Unhandled Crash Interceptor
- **React Error Boundary Component (`src/components/error-boundary.tsx`)**:
  - Wrap top-level dashboard layouts to catch unexpected React render errors.
  - Clean, branded error fallback card ("Something went wrong") preventing white screen of death.
  - One-click **"Send Crash Report to Developers"** button automatically pre-filling error message, component stack, and telemetry.
  - Options to reload page or navigate back to safety.

---

## 4. Persistent Ticket Storage & Server Actions
- **Data Persistence (`data/feedback_reports.json`)**:
  - Store tickets with structure:
    ```typescript
    interface FeedbackReport {
      id: string; // e.g., "FB-20261017-XXXX"
      category: "BUG" | "DATA_DISCREPANCY" | "FEATURE_REQUEST" | "GENERAL";
      urgency: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
      status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "WONT_FIX";
      title: string;
      description: string;
      submittedBy: {
        userId: string;
        userName: string;
        userEmail: string;
        userRole: string;
        mrRank?: number;
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
      attachmentUrl?: string;
      developerNotes?: string;
      createdAt: string;
      updatedAt: string;
      resolvedAt?: string;
    }
    ```
- **Server Actions**:
  - `submitFeedbackAction(payload)`: Validates input, captures server headers/IP, appends ticket, and triggers developer notification.
  - `getFeedbackReportsAction(filters)`: Paginated/filtered ticket query for Admin/Developer review.
  - `updateFeedbackStatusAction({ id, status, developerNotes })`: Updates ticket lifecycle state.

---

## 5. Admin & Developer Feedback Management Center
- **Management UI in `/admin/dev` (Dedicated "Feedback & Bug Reports" Tab)**:
  - Ticket cards and tabular summary with status badges (`OPEN`, `UNDER_REVIEW`, `RESOLVED`).
  - Search by user, ticket ID, keywords, or URL.
  - Filter by category, urgency, and status.
  - Detailed modal/drawer to inspect complete diagnostic stack, user details, and attachment.
  - Developer quick-actions: mark resolved, add internal notes.

---

## 6. Automated Developer & Admin Email Alerts
- When a ticket with urgency `HIGH` or `CRITICAL` (or any crash error) is submitted:
  - Uses `sendDeveloperEmail` / primary mailer to dispatch an instant alert to developers and administrators.
  - Formatted alert email with ticket summary, user info, urgency badge, and direct link to review the issue.

---

## 7. Verification & Quality Gates
- **Automated Test Script (`scratch/test-phase27-feedback.ts`)**:
  - Test feedback ticket creation, validation, and JSON persistence.
  - Test diagnostic collection payload integrity.
  - Test status update and ticket querying.
  - Test alert dispatch logic.
- **Typecheck & Production Build**:
  - `pnpm exec tsc --noEmit` passes with zero errors.
  - `pnpm run build` succeeds cleanly.
