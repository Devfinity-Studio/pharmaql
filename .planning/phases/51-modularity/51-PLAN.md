# Phase 51 Plan: Codebase Modularity & Domain Separation

## Goal
Modularize PharmaQL's server actions, business logic, and UI components into **7 cohesive domain modules** under `src/modules/` and domain subfolders under `src/components/`, establishing clean public barrel interfaces while maintaining 100% backward compatibility via root re-exports.

---

## Execution Waves

### Wave 1: Server Logic Modularization (`src/modules/`)
- **Plan 51.1: Build 7 Domain Modules with Barrel Interfaces**
  - Move / organize server actions into domain directories:
    1. `src/modules/auth/` (`authActions.ts`, `impersonation.ts`, `index.ts`)
    2. `src/modules/control-plane/` (`tenantActions.ts`, `licenseActions.ts`, `index.ts`)
    3. `src/modules/reports/` (`reportQueries.ts`, `index.ts`)
    4. `src/modules/overdue/` (`overdueEngine.ts`, `overduePolicy.ts`, `customerBlocking.ts`, `adminUnblockActions.ts`, `index.ts`)
    5. `src/modules/field-mrs/` (`mrInfo.ts`, `mrs.ts`, `companies.ts`, `itemCatalog.ts`, `index.ts`)
    6. `src/modules/comms/` (`notices.ts`, `pushActions.ts`, `feedback.ts`, `index.ts`)
    7. `src/modules/dev-telemetry/` (`devDiagnostics.ts`, `devReleases.ts`, `presenceActions.ts`, `refreshCache.ts`, `index.ts`)
  - Keep thin backward-compatible re-exports in `src/server/actions/*.ts` delegating to `@/modules/<domain>`.
- **Plan 51.2: Module Barrel Export Verification Tests**
  - Create `src/modules/__tests__/modules-barrel.test.ts` verifying that every module exports its expected public contract.

### Wave 2: UI Component Modularization (`src/components/`)
- **Plan 51.3: Component Subdirectory Grouping & Root Re-Exports**
  - Reorganize UI components into domain subfolders:
    1. `src/components/reports/` (all report views, stationery headers, sync controls, download modals/buttons)
    2. `src/components/dev/` (dev control center, platform dashboard, live presence table, impersonation banner, policy settings)
    3. `src/components/admin/` (admin dashboard content, admin nav, tenant switcher)
    4. `src/components/layout/` (mr dashboard content, main nav, user nav, feedback dialog)
  - Create root re-exports in `src/components/*.tsx` delegating to the domain subdirectories to ensure zero broken imports across page routes (`src/app/`).

### Wave 3: Verification & Selective Promotion
- **Plan 51.4: Automated Verification & Selective Promotion**
  - Verify complete TypeScript compilation (`pnpm exec tsc --noEmit`).
  - Run all Vitest test suites (`pnpm test`).
  - Run Next.js production build (`pnpm build`).
  - Write `51-UAT.md`.
  - Update `ROADMAP.md` and `STATE.md` marking Phase 51 as completed.
  - Commit and push on `dev`, merge to `prod`, and push to `origin/prod`.
  - **Constraint Enforced**: Do not merge or create PR to `deploymment`.
