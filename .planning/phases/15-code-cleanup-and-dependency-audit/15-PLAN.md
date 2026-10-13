# Phase 15: Code Cleanup, Formatting & Dependency Audit - Execution Plan

## Objective
Execute a comprehensive repository cleanup to eliminate dead prototype files and obsolete test scripts, remove unused packages, fix lint and formatting inconsistencies across all files, and verify a 100% clean production build.

---

## Tasks

### Wave 1: Pruning Dead & Obsolete Artifacts
- **Task 1.1**: Remove obsolete Docker database script:
  - Delete `start-database.sh` (obsolete Postgres Docker script from create-t3-app).
- **Task 1.2**: Remove legacy archive scripts:
  - Delete `archive/scripts/` (91 one-off exploratory scripts from initial database and PDF experimentation).
- **Task 1.3**: Remove dead prototype routes:
  - Delete `src/app/admin/beta/` and remove the "Beta" link from `src/app/admin/layout.tsx`.
  - Delete `src/app/admin/ingest/` and `src/server/actions/ingest.ts` (dead prototype CSV upload).
- **Task 1.4**: Remove redundant lockfiles:
  - Delete `api-server/package-lock.json` (redundant; `pnpm-lock.yaml` is the project authority).

### Wave 2: Dependency Optimization & Cleanup
- **Task 2.1**: Remove redundant devDependencies in root `package.json`:
  - Prune `"eslint"` and `"prettier"` (Biome is the unified toolchain; ESLint/Prettier configs are not used).
  - Run `pnpm install` to update `pnpm-lock.yaml`.
- **Task 2.2**: Audit package versions and ensure consistent formatting in `package.json` and `api-server/package.json`.

### Wave 3: Code Formatting & Lint Fixes
- **Task 3.1**: Run Biome auto-formatting and safe fixes across entire codebase:
  - Run `pnpm run check:write` to normalize indentation, fix line endings, and organize imports.
- **Task 3.2**: Resolve remaining lint diagnostics:
  - Add accessible `aria-hidden="true"` or `<title>` to icons in `src/app/(mr)/layout.tsx`.
  - Replace `any` casts with explicit types where appropriate.

### Wave 4: Validation & Production Verification
- **Task 4.1**: Run TypeScript typecheck: `pnpm run typecheck` & `npm run build` in `api-server`.
- **Task 4.2**: Run production Next.js build: `pnpm run build`.
- **Task 4.3**: Commit clean changes to `localdb`, merge to `prod`, and push to remote.
