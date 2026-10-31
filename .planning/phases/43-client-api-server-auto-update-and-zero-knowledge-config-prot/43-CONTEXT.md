# Phase 43: Client API Server Auto-Update and Zero-Knowledge Config Protection - Context

**Status:** Discussed & Aligned  
**Milestone:** Production Hardening & Optimization  
**Decisions Recorded:**
1. **Configuration Protection Strategy**: **Option 2 (Machine-Bound Encrypted Vault - `config.vault`)**
   - Eliminate plaintext `.env` from client servers.
   - Credentials (MySQL host, port, user, password, database, API server secret key) are encrypted into a machine-bound binary vault (`config.vault`) using AES-256-GCM / Windows DPAPI.
   - Decryption is bound to the server's machine SID / service account; credentials cannot be copied or decrypted on other machines.
   - Credentials are hydrated directly into process memory (RAM) at startup and never stored in plaintext on disk.
   - A CLI utility (`api-server.exe --encrypt-config` or dedicated vault tool) allows generating the encrypted vault from initial inputs during setup, immediately deleting plaintext `.env`.

2. **Auto-Update Delivery Strategy**: **Option 1 (Autonomous Heartbeat & OTA Auto-Update)**
   - The on-premise API server runs a periodic background daemon checking for published releases from the central PharmaQL Control Plane (`https://pharmaql.devfinity.net/api/releases/latest`).
   - Atomic update lifecycle:
     1. **Fetch & Verify**: Download candidate binary to `release/api-server.new`, verify SHA-256 checksum and cryptographic signature against published control plane manifest.
     2. **Graceful Drainage**: Drain active MySQL connection pool, signal NSSM service stop.
     3. **Atomic Swap**: Rename current `api-server.exe` to `api-server.bak`, move `api-server.new` to `api-server.exe`.
     4. **Service Restart & Health Probe**: Start NSSM service, poll `http://127.0.0.1:5000/api/health` for 15 seconds.
     5. **Automatic Rollback Safeguard**: If health probe fails or process exits unexpectedly, immediately restore `api-server.bak`, restart service, and notify control plane of failure.
     6. **Telemetry**: On success, notify control plane with new version, hash, and uptime.

---

## Architectural Components

```
Client Server (On-Premise Windows Machine)
├── api-server.exe (Standalone Node/V8 compiled binary)
│   ├── Config Vault Loader (reads config.vault via AES-256 / DPAPI)
│   ├── Express Query Engine (MySQL connection pool, reports, compression)
│   └── Background OTA Auto-Updater Agent (periodic heartbeat)
├── config.vault (Encrypted binary configuration, zero plaintext)
├── logs/ (stdout.log / stderr.log via NSSM)
└── api-server.bak (Fallback binary for atomic rollback)
```

```
Central PharmaQL Control Plane (Vercel / Neon)
├── /api/releases/latest (Serves version manifest: version, sha256, downloadUrl)
├── /api/releases/telemetry (Receives heartbeats, active versions, update reports)
└── Developer Control Center (/admin/dev)
    └── OTA Release Distribution Hub (publish releases, view client API fleet status)
```

