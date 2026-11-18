# Phase 51 Context: Codebase Modularity & Domain Separation

## Overview & Executive Summary
As PharmaQL expanded across 50 phases, business logic and UI components grew into flat directories (`src/server/actions/` and `src/components/`). Phase 51 modularizes the entire codebase into **7 cohesive domain modules** under `src/modules/` and organizes UI components into domain subfolders under `src/components/`, while maintaining 100% backward compatibility via root re-exports to prevent broken imports and ensure seamless testing and builds.

---

## Locked Decisions & Boundaries

### 1. Seven Domain Modules (`src/modules/`)
The server actions, business logic, and domain utilities will be grouped into 7 domains with clean `index.ts` public barrel interfaces:

1. **`src/modules/auth/`**
   - Core files: `authActions.ts`, `impersonation.ts`
   - Barrel export: `src/modules/auth/index.ts`
2. **`src/modules/control-plane/`**
   - Core files: `tenantActions.ts`, `licenseActions.ts`
   - Barrel export: `src/modules/control-plane/index.ts`
3. **`src/modules/reports/`**
   - Core files: `reportQueries.ts`
   - Barrel export: `src/modules/reports/index.ts`
4. **`src/modules/overdue/`**
   - Core files: `overdueEngine.ts`, `overduePolicy.ts`, `customerBlocking.ts`, `adminUnblockActions.ts`, `overdueUtils.ts`
   - Barrel export: `src/modules/overdue/index.ts`
5. **`src/modules/field-mrs/`**
   - Core files: `mrInfo.ts`, `mrs.ts`, `companies.ts`, `itemCatalog.ts`
   - Barrel export: `src/modules/field-mrs/index.ts`
6. **`src/modules/comms/`**
   - Core files: `notices.ts`, `pushActions.ts`, `feedback.ts`
   - Barrel export: `src/modules/comms/index.ts`
7. **`src/modules/dev-telemetry/`**
   - Core files: `devDiagnostics.ts`, `devReleases.ts`, `presenceActions.ts`, `refreshCache.ts`
   - Barrel export: `src/modules/dev-telemetry/index.ts`

### 2. UI Component Modularization (`src/components/`)
UI components will be categorized into domain-focused subdirectories:
- **`src/components/reports/`**:
  - `party-report-view.tsx`, `product-report-view.tsx`, `stock-report-view.tsx`, `stock-and-sales-report-view.tsx`, `overdue-report-view.tsx`, `expiry-report-view.tsx`, `free-scheme-report-view.tsx`, `report-stationery-header.tsx`, `report-download-modal.tsx`, `report-download-buttons.tsx`, `overdue-download-modal.tsx`, `expiry-download-buttons.tsx`, `offline-report-sync.tsx`
- **`src/components/dev/`**:
  - `dev-control-center.tsx`, `dev-platform-dashboard.tsx`, `dev-live-presence.tsx`, `impersonation-banner.tsx`, `admin-policy-settings.tsx`
- **`src/components/admin/`**:
  - `admin-dashboard-content.tsx`, `admin-nav.tsx`, `tenant-switcher.tsx`
- **`src/components/layout/`**:
  - `mr-dashboard-content.tsx`, `main-nav.tsx`, `user-nav.tsx`, `feedback-dialog.tsx`
- **`src/components/ui/`**:
  - Reusable design system primitives (buttons, dialogs, inputs, tables, date-picker, etc.)

### 3. Backward Compatibility & Root Re-Exports
- To ensure zero breaking changes across existing routes (`src/app/`), legacy components, and test suites:
  - All existing action files in `src/server/actions/*.ts` will be maintained as thin re-exports delegating to `@/modules/<domain>`.
  - Root re-exports in `src/components/*.tsx` will be maintained delegating to the new subfolders (e.g. `src/components/party-report-view.tsx` -> `export * from "./reports/party-report-view"`).
- External callers can smoothly adopt `@/modules/<domain>` or `@/components/<domain>/...` without any breakage.

### 4. Execution Staging
- Per user decision, execute as a **Single All-In-One Wave**:
  1. Construct all 7 `src/modules/<domain>/` packages with barrel exports.
  2. Organize components into `src/components/<domain>/`.
  3. Wire backward-compatible root re-exports.
  4. Run verification and test suite.

---

## Verification Plan
1. **TypeScript Compilation**: `pnpm exec tsc --noEmit` must pass with 0 errors.
2. **Vitest Test Suite**: All 27 test suites must pass (164/164 tests).
3. **Next.js Production Build**: `pnpm build` (`next build`) must compile cleanly with all routes generated.
4. **Promotion Constraint**: Push to `dev` and merge to `prod`; **do not merge to deployment**.
