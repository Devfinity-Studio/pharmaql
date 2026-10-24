# Phase 33: Standalone Windows x64 Executable (.exe) & NSSM Packaging - Plan

## Objective
Package the on-premise Express API server into a standalone, compiled, and minified Windows x64 native executable (`api-server.exe`) for on-premise deployment via NSSM. Protect intellectual property from client viewing/modification, ensure resilient path resolution when run under Windows `SYSTEM` accounts, provide graceful pool drainage on service shutdown, and assemble a structured `release/` package.

---

## Detailed Task Breakdown

### Task 1: Runtime Path & Configuration Resolution (`api-server/src/config.ts`)
- [x] Create `api-server/src/config.ts` resolving `APP_ROOT` via `path.dirname(process.execPath)` when running in packaged mode.
- [x] Prevent virtual filesystem bugs (`C:\snapshot\...`) and Windows `SYSTEM` account `C:\Windows\System32` directory drift.
- [x] Anchor `.env` file discovery to `APP_ROOT/.env` before falling back to `process.cwd()`.
- [x] Update `src/db.ts` and `src/index.ts` to import `config.ts` before reading environment variables.

### Task 2: Code Bundling, Minification & IP Obfuscation (`api-server/tsup.config.ts`)
- [x] Install `tsup` and `@yao-pkg/pkg`.
- [x] Configure `tsup.config.ts` to bundle, tree-shake, and minify all application logic and dependencies into `dist/bundle.cjs`.
- [x] Disable source maps (`sourcemap: false`) and strip all legal/license comments (`legalComments: "none"`).
- [x] Target Node 20 runtime (`target: "node20"`, `format: ["cjs"]`).

### Task 3: Single-File Executable Packaging & Target Configuration (`api-server/pkg.json`)
- [x] Create `pkg.json` targeting `node22-win-x64` with V8 bytecode compilation.
- [x] Output standalone native binary `release/api-server.exe`.
- [x] Verify bytecode compiles cleanly without plain JavaScript source exposure.

### Task 4: Process Lifecycle & Database Pool Safe Drainage (`api-server/src/index.ts`, `api-server/src/db.ts`)
- [x] Export `closeDatabasePool()` in `src/db.ts`.
- [x] Capture `http.Server` instance and attach `SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection` handlers.
- [x] Emulate clean shutdown on NSSM `AppStopMethodConsole` events with a 10-second force-kill safeguard.

### Task 5: Structured Release Artifact Assembly (`api-server/scripts/copy-release-assets.js`)
- [x] Create `scripts/copy-release-assets.js` to assemble:
  ```text
  release/
  ├── api-server.exe
  ├── .env.example
  ├── bin/
  └── logs/ (.gitkeep)
  ```
- [x] Add `"build:exe"` script to `api-server/package.json`.
- [x] Verify `.gitignore` ignores binary and logs while tracking packaging scripts and release structure.

---

## Verification Criteria
- [x] `tsup` generates `dist/bundle.cjs` (~1.8 MB) with zero source maps or unminified comments.
- [x] `@yao-pkg/pkg` compiles `dist/bundle.cjs` into `release/api-server.exe` (~57 MB).
- [x] Executable boots cleanly and resolves `.env` relative to its own folder.
- [x] All 8 test suites (41 tests) pass in `pnpm test`.
- [x] Both `api-server` (`tsc`) and Next.js (`next build`) pass with zero errors.
