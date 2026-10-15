# Phase 24: Mobile PWA & Offline Access for Medical Representatives - Context & Requirements

## Objectives
Transform PharmaQL into an installable, high-performance Progressive Web Application (PWA) tailored for field Medical Representatives (MRs). Equip MRs with offline data caching for essential reports, seamless reconnection handling, and mobile-optimized touch experiences—enabling continuous operation even inside low-connectivity clinics, hospitals, and rural chemist counters.

---

## 1. PWA Foundation & App Shell Installation
- **Web App Manifest (`src/app/manifest.ts` / Next.js Metadata)**:
  - Name: `PharmaQL | Asmee Pharma MR Portal`
  - Short Name: `PharmaQL`
  - Theme Color: `#0071BC`
  - Background Color: `#0B2545`
  - Display: `standalone`
  - Start URL: `/dashboard`
  - Scope: `/`
  - Icons: High-res square icons (192x192, 512x512) and maskable icons.
- **Service Worker Lifecycle**:
  - Cache static core assets: application shell, fonts, icons, CSS bundles, branding logos.
  - Implement stale-while-revalidate strategy for UI assets.
  - Automatic cache cleanup on new application releases.
- **In-App Install Prompt**:
  - Subtle, unobtrusive "Install PharmaQL App" banner on mobile devices capturing `beforeinstallprompt` event.
  - iOS Safari instruction banner ("Tap Share & Add to Home Screen").

---

## 2. Offline Data Caching & Local Storage
- **Browser-Side Offline Cache (IndexedDB / CacheStorage)**:
  - Cache recently loaded report datasets (Stock Movement Statement, Sales Details, Product Master, Customer Outstanding).
  - Keyed by MR ID and date filters to prevent cross-account contamination.
- **Offline Snapshot Rendering**:
  - When connection is unavailable, render the cached snapshot with a clear visual badge:
    `"Viewing offline snapshot as of [Time/Date]"`.
  - Disallow destructive actions (like live unblocks) while offline, but keep read-only reports fully interactive.

---

## 3. Network Detection & Online/Offline Handshake
- **Connection Status Listener (`navigator.onLine`)**:
  - Global floating status pill or banner alerting MRs when connection drops.
  - Smooth animation transitioning from "Offline Mode" to "Connected — Refreshing live data".
- **Auto-Revalidation**:
  - When connection is restored, background fetch validates whether newer data is available and prompts/updates view.

---

## 4. Mobile Touch UX & Viewport Polish
- **Safe Area Inset Handling**:
  - Adapt top and bottom safe-areas (`env(safe-area-inset-bottom)`) for iPhones with notches and Android gesture bars.
- **Bottom Navigation Bar for Mobile**:
  - Quick-access bottom navigation bar on mobile viewports for rapid switching between Dashboard, Reports, Notices, and Profile.
- **Pull-To-Refresh Support**:
  - Smooth native pull-down-to-refresh interaction on touch devices to refresh active report data.

---

## 5. Verification & Quality Gates
- **PWA Audit**:
  - Verify Lighthouse PWA criteria (valid manifest, service worker registered, responsive viewport).
- **Offline Simulation**:
  - Test behavior in browser offline mode: verify cached reports open smoothly without error pages.
- **Zero Desktop / Legacy Regression**:
  - Guarantee zero disruption to desktop Admin, Developer Control Center, and read-only MySQL ERP procedures.
