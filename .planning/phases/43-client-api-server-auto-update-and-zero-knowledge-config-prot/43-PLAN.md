# Phase 43 Plan: Client API Server Auto-Update and Zero-Knowledge Config Protection

## Execution Roadmap & Task Breakdown

### Plan 43-1: Machine-Bound Encrypted Configuration Vault (`config.vault`)
- [x] Create `api-server/src/vault.ts` implementing AES-256-GCM encryption with machine-bound key derivation (combining hardware SID / Windows MachineGuid with cryptographically secure PBKDF2 salt).
- [x] Support `api-server.exe --seal`: Encrypts existing `.env` into `config.vault` and securely deletes `.env`.
- [x] Support `api-server.exe --verify-vault`: Validates decryption and integrity of `config.vault` without booting the HTTP service.
- [x] Update `api-server/src/config.ts` to automatically load credentials from `config.vault` into process memory (RAM only) and fail boot if an unsealed plaintext `.env` is detected in production.
- [x] Add unit tests verifying encryption, decryption, invalid machine rejection, and authentication tag tamper detection.

### Plan 43-2: Autonomous Background OTA Auto-Updater Agent (`api-server/src/updater.ts`)
- [x] Implement `api-server/src/updater.ts` with a background interval daemon (default 15 minutes, configurable).
- [x] Implement `checkForUpdates()` to query the PharmaQL Control Plane (`/api/releases/latest`).
- [x] Stream download binary to `release/api-server.new` and verify SHA-256 checksum against signed release manifest.
- [x] Create atomic update swap script `release/swap-service.bat` / PowerShell runner:
  - Gracefully stops NSSM service (`nssm stop PharmaQL-API`).
  - Creates backup `api-server.bak`.
  - Atomically replaces `api-server.exe`.
  - Starts service (`nssm start PharmaQL-API`).
  - Probes health endpoint (`/api/health`) for 15s.
  - Automatically rolls back to `api-server.bak` if boot fails.
- [x] Periodic heartbeat telemetry reporting current version, uptime, and last update state to control plane.

### Plan 43-3: Control Plane Release Distribution API & Telemetry Routes
- [x] Create `src/app/api/releases/latest/route.ts` serving signed release manifest: version, commit SHA, SHA-256 checksum, download URL, and release notes.
- [x] Create `src/app/api/releases/telemetry/route.ts` receiving client API heartbeats and logging fleet metrics to Neon database / server storage.
- [x] Create `src/app/api/releases/download/route.ts` providing secure chunked binary downloads for authorized client API instances.

### Plan 43-4: Developer Control Center Release Hub UI
- [x] Add "On-Premise API Fleet & OTA Releases" management panel in `/admin/dev` (`src/components/dev-control-center.tsx`).
- [x] Live telemetry table showing connected client servers: Host IP, Tenant, Running Version, Config Vault Status, Last Heartbeat, and Online/Offline indicator.
- [x] Release management modal to publish new API releases, set target rollout versions, and view download metrics.

### Plan 43-5: Verification, Packaging & Promotion Pipeline
- [x] Run full Vitest test suite covering vault crypto, updater hash checks, and API routes.
- [x] Run `tsc --noEmit` and compile `pnpm run build:exe` in `api-server`.
- [x] Run Next.js production build (`next build`).
- [x] Execute 3-stage promotion workflow: `dev` (localhost verified) -> `prod` (Vercel preview verified) -> `deploymment` (live production verified).
