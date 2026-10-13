# Phase 15: Code Cleanup, Formatting & Dependency Audit - Context

## Objective
Audit the entire codebase to eliminate dead files, obsolete test scripts, and unused demo data; format and prettify code across frontend and `api-server`; fix compiler and linter warnings/deprecations; and audit all project dependencies for duplicates or vulnerabilities.

## Core Directives

1. **Dead Code & Scratch Script Pruning:**
   - Scan for root-level scratch files (e.g. `scratch-test.mjs`, `test-odbc-date.mjs`, `test-proc.js`, or outdated batch files).
   - Review `/archive`, `/data`, and `/demo data` to ensure no active runtime code is referencing deleted or duplicate files.
   - Clean up stray debug endpoints or temporary testing code no longer required in production.

2. **File Organization & Directory Structure:**
   - Ensure clean directory demarcation between Next.js frontend (`/src`) and the standalone Express API service (`/api-server`).
   - Move or categorize any misplaced utilities, scripts, or types into standard directories.

3. **Code Formatting & Prettifying:**
   - Execute Biome (`pnpm run check:write` / `biome format --write`) across all Next.js TS/TSX and CSS files.
   - Run linter checks to ensure proper class sorting (`clsx`, `cn`, `twMerge`) and import organization.
   - Ensure consistent code style and indentation across `api-server`.

4. **Warnings & Deprecation Removal:**
   - Fix all TypeScript compiler warnings (`tsc --noEmit`).
   - Review and resolve Node.js deprecation warnings (such as `module.register()`, Node 22+ deprecations, or Next.js build warnings).
   - Clean unhandled console logs and debug traces in production builds.

5. **Dependency Audit & Optimization:**
   - Inspect `package.json` in root and `api-server/package.json`.
   - Remove unused dependencies (e.g. old cloud DB packages, unreferenced utility packages).
   - Audit for duplicate or mismatched package versions between workspace packages.
   - Run security audit (`pnpm audit`) to address any high/critical vulnerabilities where feasible without breaking changes.

6. **Reporting & Verification:**
   - Compile a comprehensive audit report documenting all changes, deleted files, and updated packages.
   - Verify build integrity with `pnpm run build` (Next.js) and `npm run build` (`api-server`).
