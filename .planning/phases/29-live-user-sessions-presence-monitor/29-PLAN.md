# Phase 29: Live Active User Sessions & Real-Time Presence Monitor - Implementation Plan

## Goals
Provide developers with a live presence monitoring and active session management console in `/admin/dev`. Developers can track real-time active users across all roles (MR, Admin, Developer), inspect their IP address, browser/OS/device details, see exactly which page/tab they are currently on, monitor idle/active state, and immediately terminate sessions (remote force logout) or block accounts.

---

## Tasks

### Task 1: Client Device Telemetry & User-Agent Parser (`src/lib/user-agent-parser.ts`)
- Parse raw User-Agent headers and client hints into clean structured metadata:
  - `browser`: Chrome, Safari, Firefox, Edge, Opera, Samsung Internet, etc. + version.
  - `os`: Windows, macOS, iOS, Android, Linux + version.
  - `deviceType`: `"desktop" | "mobile" | "tablet"`.
- Clean helper to resolve real client IP addresses (`x-forwarded-for`, `x-real-ip`, socket address).

### Task 2: Active Presence Store & Server Actions (`src/server/actions/presenceActions.ts`, `src/lib/presence-store.ts`)
- Maintain structured session registry in `data/active_sessions.json`:
  - `sessionId`: unique hash or session UUID.
  - `userId`, `userEmail`, `userName`, `role`, `rank`, `division`, `company`.
  - `clientIp`, `deviceType`, `browser`, `os`, `screenResolution`.
  - `currentPage`: current URL path & search query (e.g. `/dashboard?tab=stock&division=AVRIVA`).
  - `currentTitle`: human-readable page name (e.g. "Stock Movement Report - AVRIVA").
  - `firstSeen`: session start timestamp.
  - `lastHeartbeat`: most recent activity timestamp.
  - `isRevoked`: boolean flag indicating if developer has remotely terminated this session.
- Server actions:
  - `recordHeartbeatAction(payload)`: updates heartbeat and active page for the user.
  - `getActiveSessionsAction()`: returns active sessions with status (🟢 Active Now < 2m, 🟡 Idle 2–15m, ⚪ Offline).
  - `revokeUserSessionAction(sessionId | userId)`: immediately marks session as revoked.
  - `purgeStaleSessionsAction()`: cleans up entries older than 24 hours.

### Task 3: Client Presence Beacon Component (`src/components/presence-beacon.tsx`)
- Mount lightweight presence listener in root layout for authenticated sessions.
- Automatically sends heartbeat every 30 seconds and on route change (`usePathname()`, `useSearchParams()`).
- Transmits page unload beacon via `navigator.sendBeacon` or unmount handler.
- Checks response: if `revoked: true`, immediately executes client logout and redirects to `/login?reason=session_revoked`.

### Task 4: Immediate Session Revocation Gate (`src/server/auth.ts`, `src/middleware.ts`)
- Integrate revocation check in `auth.api.getSession`:
  - If a user's session or `userId` is marked revoked in `active_sessions.json`, `getSession()` treats the session as invalid, removes cookies, and rejects requests.
- Ensures developer's "Force Logout" takes effect instantly on the user's very next click or request without waiting for JWT token expiration (7 days).

### Task 5: Developer Live Presence Console Tab (`src/components/dev-live-presence.tsx`)
- Add a new dedicated tab in `DevControlCenter` (`/admin/dev`): **"Live Users & Presence"** (icon: `Radio` / `Activity`).
- Live summary stat cards:
  - Total Active Users right now (with breakdown by MR, Admin, Developer).
  - Mobile vs Desktop distribution.
  - Top Active Pages right now.
- Filterable and searchable table:
  - Search by Name, Email, Division, Page, or IP.
  - Filter by Role (`All`, `MR`, `Admin`, `Developer`) and Status (`All`, `Active`, `Idle`).
  - Auto-refresh toggle (every 10s or 30s) + manual refresh button.
  - Action buttons:
    - **"Force Logout"** (remote session termination).
    - **"Block / Unblock"** MR toggle directly from presence row.
    - **"Inspect"** drawer/modal displaying full telemetry, screen resolution, connection latency, and audit history.

### Task 6: Quality Gates & Verification
- Verify heartbeat does not produce excessive server load or console noise.
- Verify User-Agent parsing accuracy for Windows, Android, iOS, and macOS.
- Verify remote force logout immediately expels the user and redirects to login.
- Run `pnpm exec tsc --noEmit` and `pnpm run build` with 0 errors.
