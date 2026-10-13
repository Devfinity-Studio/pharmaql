# Phase 20: MR Ranking-Based Permissions Plan

## Objective
Implement strict ranking-based permission enforcement for Medical Representatives (MRs) across PharmaQL, simplify the Admin MR management card UI, and track last login timestamps.

---

## Rank & Permission Matrix

| Rank | Rank Title | Allowed Reports | Permissions Granted |
| :---: | :---: | :---: | :---: |
| **Rank 1** | Junior / Field Rep | Stock Reports | `canViewStock = true`<br>`canViewFreeScheme = false`<br>`canViewSales = false`<br>`canViewPartyWise = false`<br>`canViewProductWise = false` |
| **Rank 2** | Senior Rep / Area Specialist | Stock Reports & Claim Quantity (Free Scheme) | `canViewStock = true`<br>`canViewFreeScheme = true`<br>`canViewSales = false`<br>`canViewPartyWise = false`<br>`canViewProductWise = false` |
| **Rank 3** | Manager / All Access | All Reports (Stock, Free Scheme, Sales Overview, Party Wise, Product Wise) | `canViewStock = true`<br>`canViewFreeScheme = true`<br>`canViewSales = true`<br>`canViewPartyWise = true`<br>`canViewProductWise = true` |

---

## Detailed Implementation Tasks

### Task 1: Rank Model & Server Actions
- **File**: `src/server/actions/mrs.ts`
  - Add `rank?: 1 | 2 | 3` and `lastLogin?: string` to `MROverride` interface.
  - Create helper `getPermissionsForRank(rank: 1 | 2 | 3)` returning strict boolean flags.
  - Create server action `updateMRRank(mrId: string, rank: 1 | 2 | 3)` to save rank in `mr_overrides.json` and revalidate paths.
  - Update `verifyMROTP` in `src/server/actions/authActions.ts` to update `lastLogin` timestamp on successful login.

### Task 2: MR Info & Display Projection Updates
- **File**: `src/server/actions/mrInfo.ts`
  - Add `rank: 1 | 2 | 3` and `lastLogin?: string` to `MRDisplayItem` and `LegacyMRUser`.
  - In `fetchMRsPage`, resolve MR rank:
    - Default to `override.rank` if set (1, 2, or 3).
    - If not set, check ERP `JobProfile` (ZSM/RSM/ASM -> Rank 3; ABM/BO -> Rank 2; MR -> Rank 1; fallback -> Rank 3).
    - Strictly derive permissions from `getPermissionsForRank(rank)`.
  - Expose `lastLogin` formatted from `override.lastLogin || "Never"`.

### Task 3: Enforce Strict Rank Access in MR Dashboard & Navigation
- **File**: `src/components/mr-dashboard-content.tsx`
  - Gate tabs strictly according to MR rank permissions:
    - Overview/Sales tab: only if Rank 3 (`canViewSales`).
    - Party Wise tab: only if Rank 3 (`canViewPartyWise`).
    - Product Wise tab: only if Rank 3 (`canViewProductWise`).
    - Free Scheme tab: only if Rank 2 or 3 (`canViewFreeScheme`).
    - Stock tab: accessible by all Ranks (1, 2, 3).
  - Default tab resolution: If an MR accesses a tab they lack permission for, gracefully fall back to their first allowed tab (e.g. "stock" for Rank 1).

### Task 4: Admin MRs UI Simplification
- **File**: `src/app/admin/mrs/MRListInfiniteScroll.tsx`
  - Remove "Assign Manufacturer / Division" form.
  - Remove "Remove Assignment" buttons.
  - Remove permissions checkboxes and "Save Permissions" form.
  - Display on each MR card:
    1. **MR Name** & **Email**
    2. **Last Login** timestamp
    3. **Block / Unblock** button
    4. **View Data** link (`/admin/mrs/[id]`)
    5. **Manufacturer & Division** (read-only)
    6. **Rank Selector** (Rank 1, Rank 2, Rank 3 pills/buttons with instant update)
    7. **Current Permissions Badges** (displaying active accessible reports)

### Task 5: Verification & Quality Gates
- Verify type checks with `pnpm run typecheck` (`tsc --noEmit`).
- Verify rank switching in UI and check that permissions immediately update.
- Verify MR dashboard respects rank permissions.
