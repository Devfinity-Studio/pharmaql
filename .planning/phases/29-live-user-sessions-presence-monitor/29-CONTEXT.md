# Phase 29: Live Active User Sessions & Real-Time Presence Monitor - Context

## Overview
A real-time user presence and active session management suite for developers in `/admin/dev`. Enables tracking of who is currently logged in across all roles (MR, Admin, Developer), their client IP address, device/browser details, current active page/tab, last heartbeat timestamp, and provides one-click remote session revocation (force logout) and account blocking.

## Core Requirements & Capabilities

### 1. Real-Time Heartbeat & Presence Beacon
- Lightweight client-side heartbeat (`usePresenceBeacon`) running on active sessions.
- Transmits periodic heartbeat (e.g. every 30–45s or on route transition) with low overhead.
- Sends current pathname (`window.location.pathname + window.location.search`), user session identifier, role, MR rank, and client timestamp.
- Beacon also fires `navigator.sendBeacon` on page unload (`beforeunload`) to record graceful disconnect.

### 2. Client Device & Network Telemetry
- Client IP resolution (from `x-forwarded-for`, `x-real-ip`, or socket connection).
- User-Agent parser extracting:
  - Browser (Chrome, Firefox, Safari, Edge, Opera, Samsung Internet) + version
  - Operating System (Windows, macOS, Android, iOS, Linux) + version
  - Device Form Factor (Desktop, Mobile, Tablet)
- Screen dimensions / viewport resolution.
- Online/offline network status.

### 3. Server-Side Active Session Registry & Revocation Engine
- Server-side store (`data/active_sessions.json` or in-memory registry with persistent backup).
- Status resolution:
  - 🟢 **Active Now**: Heartbeat received within last 2 minutes.
  - 🟡 **Idle**: Heartbeat received 2–15 minutes ago.
  - ⚪ **Offline / Expired**: Heartbeat older than 15 minutes or explicitly logged out.
- **Revocation Engine (Remote Force Logout)**:
  - Stores a revoked session token / revoked user ID blacklist (`revokedSessionIds` / `revokedUserIds`).
  - Next.js auth middleware and `auth.api.getSession` verify tokens against the revocation blacklist.
  - When revoked, the user's next request or client heartbeat immediately clears cookies and redirects them to `/login?reason=session_revoked`.

### 4. Developer Live Monitor Console (`/admin/dev`)
- A dedicated **"Live Sessions & Presence"** tab in Developer Control Center.
- Key metrics at the top:
  - Total Active Users Now (MRs, Admins, Developers)
  - Mobile vs Desktop user breakdown
  - Most active pages right now
- Real-time sessions table with:
  - User Name & Role badge (MR Rank, Admin, Dev)
  - Email & Division
  - Status indicator (🟢 Active Now, 🟡 Idle, ⚪ Offline)
  - Current Page / Route (e.g. `Stock Report (AVRIVA)`, `/admin/mrs`)
  - IP Address & Country/City or network indicator
  - Device & Browser badge (e.g. `Windows • Chrome 124`, `Android • Chrome Mobile`)
  - Session Start Time & Last Seen (relative time)
  - Quick Actions:
    - **"Force Logout"** button with confirmation
    - **"Block User" / "Unblock User"** button
    - **"View Session Details"** drawer/modal
- Auto-refresh toggle (every 10s / 30s) + manual refresh button.
