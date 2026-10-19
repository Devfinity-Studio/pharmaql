# Phase 29: Live Active User Sessions & Real-Time Presence Monitor - Execution Summary

## Objective Accomplished
Equipped PharmaQL with a real-time **Live Active User Sessions & Presence Monitoring Engine** for developers in `/admin/dev`. Developers can now monitor all logged-in users across roles (Medical Representatives, Admins, Developers) in real time, view their parsed client IP address, device form factor (mobile/desktop/tablet), operating system, browser, screen resolution, and see what page/tab they are currently browsing. Developers can also remotely terminate user sessions with instant effect ("Force Logout") or toggle MR account blocks directly from the presence row.

---

## Key Changes Implemented

### 1. Client Device Telemetry & User-Agent Parser (`src/lib/user-agent-parser.ts`)
- Implemented high-performance, regex-based client telemetry parser without heavy third-party dependencies:
  - **Browser Parsing**: Chrome, Safari, Firefox, Edge, Opera, Samsung Internet + major version.
  - **OS Parsing**: Windows (7, 8.1, 10, 11), iOS, Android, macOS, Linux, ChromeOS.
  - **Device Form Factor**: `"desktop" | "mobile" | "tablet"` based on User-Agent patterns and viewport indicators.
  - **Client IP Normalization**: Resolves real IP address through `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip` headers with fallback to `127.0.0.1`.

### 2. Active Presence Store & Server Actions (`src/lib/presence-store.ts`, `src/server/actions/presenceActions.ts`)
- **Serialized Storage Management (`data/active_sessions.json`)**:
  - Maintains `ActiveUserSession` registry tracking `sessionId`, `userId`, `userEmail`, `userName`, `role`, `rank`, `division`, `company`, `clientIp`, `deviceType`, `browser`, `os`, `screenResolution`, `currentPage`, `currentTitle`, `firstSeen`, `lastHeartbeat`, and `isRevoked`.
  - Computes real-time status:
    - 🟢 **Active Now**: Heartbeat within last 2 minutes (`< 2m`).
    - 🟡 **Idle**: Heartbeat between 2 and 15 minutes (`2–15m`).
    - ⚪ **Offline**: No heartbeat for > 15 minutes or session revoked.
  - Auto-prunes inactive entries older than 48 hours to keep storage lean.
- **Server Actions**:
  - `sendPresenceHeartbeatAction`: Public client action called periodically by authenticated clients.
  - `getLivePresenceDataAction`: Privileged action restricted to DEVELOPER / ADMIN, returning sorted sessions and aggregated summary metrics (active now, idle, 24h count, mobile/desktop/tablet breakdown, role breakdown, and top visited pages).
  - `forceLogoutUserSessionAction`: Marks a session as revoked, logs a `SECURITY_WARNING` audit event, and purges access.
  - `toggleBlockFromPresenceAction`: Direct shortcut to block/unblock an MR and automatically revoke all their active sessions when blocked.

### 3. Immediate Session Revocation Integration (`src/server/auth.ts`, `src/server/actions/authActions.ts`)
- **Stateless JWT Revocation Gate**:
  - Injected `checkIsSessionRevoked(user.id)` inside `auth.api.getSession`.
  - When a developer clicks "Force Logout", the user's session is invalidated on the server immediately, expelling them on their very next request without waiting for the 7-day JWT expiration.
  - Added `unrevokeUser(userId)` inside `authActions.ts` so that when a previously expelled user authenticates with a fresh OTP or credentials, their revocation flag is cleared and they can log back in smoothly.

### 4. Client Presence Beacon (`src/components/presence-beacon.tsx`)
- Lightweight, non-intrusive client component mounted inside both `src/app/(mr)/layout.tsx` and `src/app/admin/layout.tsx` wrapped in `<Suspense fallback={null}>`.
- Sends automatic heartbeats every 30 seconds and instantaneously upon route transitions (`pathname`, `searchParams`).
- Transmits window title and screen resolution.
- Receives server revocation signals: if `res.isRevoked === true`, instantly clears local session storage and forces browser redirection to `/login?reason=session_revoked`.

### 5. Developer Live Presence Console Tab (`src/components/dev-live-presence.tsx`, `src/components/dev-control-center.tsx`)
- Added a dedicated **"Live Users & Presence"** tab (icon: `Radio`) in `/admin/dev`.
- **Summary Metric Cards**:
  - Active Now (&lt; 2m) with pulsating green indicator and role breakdown (MRs, Admins, Devs).
  - Idle Sessions (2–15m).
  - Device Distribution (Desktop, Mobile, Tablet).
  - 24h Recorded Sessions.
  - Top Active Pages banner with visitor counters.
- **Filtering & Search**:
  - Multi-field search across Name, Email, IP, URL/Page, Document Title, Browser, OS, Division, and Company.
  - Dropdown filters for Role, Status (Active, Idle, Offline), and Device Type.
  - Configurable auto-refresh toggle (10s, 30s, or Pause) + manual refresh button.
- **Table Controls & Actions**:
  - User identity, role, rank, and division badges.
  - Click-to-copy for active URLs and client IPs.
  - **Inspect Telemetry Drawer**: Opens a detailed modal displaying full device specs, user access metadata, session lifecycle, and network details.
  - **Force Logout Button**: One-click remote session termination with confirmation dialog.
  - **Block/Unblock Button**: Instant account block toggle for MRs.

---

## Verification & Quality Gates
- **TypeScript Compilation**: `pnpm exec tsc --noEmit` passed with 0 errors.
- **Next.js Production Build**: `pnpm run build` succeeded cleanly with all 15 routes optimized and 0 compile/runtime warnings.
- **Zero-Dependency Guarantee**: Native parser and storage queue ensure zero external socket server dependencies.
