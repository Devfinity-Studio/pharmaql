# Phase 25: Push Notifications & Instant Field Alerts - Context & Requirements

## Objectives
Arm Medical Representatives (MRs) and Administrators with real-time Web Push Notifications and an in-app Alert Center. Deliver proactive warnings for impending customer blocks (80–90 days overdue), instant broadcast alerts when new official circulars are published, subscription lifecycle reminders, and actionable field notifications directly to field mobile devices and desktop browsers.

---

## 1. Web Push & VAPID Key Infrastructure
- **VAPID Key Pair**:
  - Securely configured VAPID keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY` / `data/vapid_keys.json`).
  - RFC 8292 compliant Web Push protocol with Contact Subject (`mailto:support@devfinity.net`).
- **Subscription Management (`data/push_subscriptions.json`)**:
  - Store push subscriptions isolated by `userId`, `role`, `endpoint`, and `keys: { p256dh, auth }`.
  - Automated pruning of dead/expired subscription endpoints (`410 Gone` / `404 Not Found`).

---

## 2. Service Worker Push & Notification Handlers (`public/sw.js`)
- **`push` Event Handler**:
  - Receives encrypted Web Push payloads containing: `title`, `body`, `icon`, `badge`, `tag`, `data: { url, alertType }`.
  - Renders system notifications with Asmee Pharma logo/badge, vibration pattern (`[200, 100, 200]`), and high priority.
- **`notificationclick` Event Handler**:
  - Automatically focuses or opens the target dashboard tab upon click (e.g. `/dashboard?tab=overdue` for overdue warnings or `/dashboard?tab=notices` for announcements).

---

## 3. Automated Field Alert Triggers
- **Overdue Threshold & Impending Block Alerts**:
  - Whenever an MR has customers nearing overdue thresholds (80–90 days) or triggering ERP block rules, dispatch an urgent push alert to the assigned MR's registered devices:
    `"⚠️ Impending Block: Customer [Name] has an invoice overdue by 85 days. Please follow up to prevent order suspension."`
- **Admin Notice & Broadcast Alerts**:
  - When an Admin creates a new announcement or uploads an urgent circular in `/admin/notices`, automatically dispatch a push notification to all target MRs.
- **Subscription Renewal Reminders**:
  - Push alerts sent to Admins regarding subscription renewal milestones.

---

## 4. In-App Notification Bell & Preference Center
- **Interactive Notification Bell**:
  - Header bell icon on MR and Admin layouts with an unread badge indicator.
  - Dropdown drawer listing recent notifications with timestamps, urgency indicators (Urgent / Info / Warning), and "Mark as read" controls.
- **Push Permission Toggle**:
  - One-click "Enable Push Notifications" banner / toggle with browser permission check (`Notification.requestPermission()`).

---

## 5. Developer Test Dispatcher & Verification
- **Developer Test Push Tool**:
  - Add a "Dispatch Test Web Push" control to the Developer Control Center (`/admin/dev`) to test push delivery on active sessions.
- **Automated Test Suite**:
  - `scratch/test-phase25-notifications.ts` verifying VAPID key initialization, payload serialization, subscription storage isolation, and dispatch simulation.
