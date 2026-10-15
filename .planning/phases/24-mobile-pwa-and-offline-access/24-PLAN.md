# Phase 24: Mobile PWA & Offline Access for Medical Representatives Plan

## Objective
Transform PharmaQL into an installable, high-performance Progressive Web Application (PWA) tailored for field Medical Representatives (MRs). Equip MRs with offline data caching for essential reports, seamless reconnection handling, and mobile-optimized touch experiences—enabling continuous operation even inside low-connectivity clinics, hospitals, and rural chemist counters.

---

## Detailed Implementation Tasks

### Task 1: PWA Manifest, Branding Icons & Meta Tags
- **File**: `src/app/manifest.ts` (Next.js App Router Dynamic Manifest)
  - Configure PWA metadata:
    - `name: "PharmaQL - Asmee Pharma MR Portal"`
    - `short_name: "PharmaQL"`
    - `description: "Enterprise MR portal for stock movement, sales statements, and order tracking"`
    - `start_url: "/dashboard"`
    - `display: "standalone"`
    - `background_color: "#0B2545"`
    - `theme_color: "#0071BC"`
    - `orientation: "portrait-primary"`
    - `icons`: 192x192, 512x512, maskable icons.
- **Icons Generation & Placement**:
  - Place SVG/PNG app icons in `public/icons/`:
    - `icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`.
- **File**: `src/app/layout.tsx`
  - Add viewport metadata with `themeColor`, `appleWebApp: { capable: true, statusBarStyle: "default", title: "PharmaQL" }`.

---

### Task 2: Service Worker & Application Shell Precaching
- **Create**: `public/sw.js`
  - High-performance, lightweight Service Worker:
    - **Install**: Pre-caches application shell, critical logos, font assets, and offline fallback page.
    - **Activate**: Cleans stale caches automatically on version increments (`pharmaql-pwa-v1`).
    - **Fetch Strategy**:
      - Static assets (`/_next/static/`, `/icons/`, `/fonts/`, images): **Stale-While-Revalidate**.
      - HTML Page Navigations: **Network-First** falling back to cached shell.
      - API & Server Actions: **Network-First** with graceful offline JSON fallback.
- **Create**: `src/components/pwa-register.tsx`
  - Client component registered in root or MR layout that initializes `navigator.serviceWorker.register('/sw.js')`.
  - Captures service worker update events and prompts for reload when a new version deploys.

---

### Task 3: In-App Install Banner & Mobile Add-to-Home Screen Prompt
- **Create**: `src/components/pwa-install-prompt.tsx`
  - Intercepts the browser `beforeinstallprompt` event on Android Chrome/Edge.
  - Renders a sleek, branded bottom drawer / banner on mobile viewports:
    - *"Install PharmaQL on your phone for faster access in the field."*
    - **Install App** button triggering `prompt()`.
    - **Not Now** dismissal saved in `localStorage` (snooze for 7 days).
  - iOS Safari Detection:
    - Renders simple iOS instructions when running on Safari iOS in browser mode: *"Tap Share and select 'Add to Home Screen'"*.
- **Integrate**: Add `<PwaInstallPrompt />` to `src/app/(mr)/layout.tsx`.

---

### Task 4: Offline Report Data Cache & Storage Engine
- **Create**: `src/lib/offline-store.ts`
  - Client-side IndexedDB / local storage wrapper for MR reports:
    - Store methods: `saveReportSnapshot(mrId, reportKey, data, params)`
    - Retrieve methods: `getReportSnapshot(mrId, reportKey)`
    - Clear methods: `clearReportSnapshots(mrId)`
  - Stores:
    - Stock Movement Statement
    - Sales & Invoicing Details
    - Product Wise Sales
    - Party Wise Sales
    - Periodical Outstanding
- **UI Integration in MR Reports & Dashboard**:
  - In `src/components/mr-dashboard-content.tsx`:
    - Automatically cache fetched report data upon successful load.
    - If a network error occurs or user is offline, seamlessly load the latest cached report snapshot.
    - Display snapshot timestamp badge: *"Viewing offline snapshot from 14 Oct, 04:30 PM"*.

---

### Task 5: Network Status Indicator & Mobile Navigation UX
- **Create**: `src/components/offline-indicator.tsx`
  - Subscribes to `online` and `offline` browser window events.
  - Renders a floating indicator at the top of the mobile screen:
    - **Offline**: Amber badge with `WifiOff` icon: *"Offline Mode — Showing cached reports"*.
    - **Online**: Emerald badge with `Wifi` icon: *"Back Online — Reconnecting to live ERP"*.
- **Mobile Bottom Navigation Bar**:
  - In `src/components/mr-mobile-nav.tsx`:
    - Fixed bottom tab bar for mobile viewports (`< 768px`) with icons:
      - **Dashboard** (`/dashboard`)
      - **Reports** (Jump to report tab)
      - **Notices** (Notice board modal)
      - **Menu / Profile**
    - Padded with `env(safe-area-inset-bottom)` for iPhone gestures.
- **Pull-To-Refresh Support**:
  - Native gesture to trigger active tab re-fetch when pull-down is performed on mobile screens.

---

### Task 6: Verification & Test Suite
- **Create**: `scratch/test-phase24-pwa.ts`
  - Test manifest route output (`/manifest.webmanifest`).
  - Verify Service Worker syntax and file accessibility.
  - Verify `offline-store.ts` caching, retrieval, expiration, and key isolation.
  - Validate online/offline state change listeners.
- **Compile & Regression Test**:
  - Run `pnpm exec tsc --noEmit` (0 errors).
  - Test desktop MR, Admin, and Developer views to verify zero regression.
