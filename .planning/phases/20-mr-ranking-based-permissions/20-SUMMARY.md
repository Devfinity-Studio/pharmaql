# Phase 20 Summary: MR Ranking-Based Permissions & Admin UI Cleanup

## Completed Scope

1. **ERP Rank Column Integration & Normalization:**
   - Updated `SELECT_MKT_MR_COLUMNS` in `api-server/src/routes/master.ts` to select `mr.\`Rank\` AS \`Rank\``.
   - In `normalizeLegacyMR`: Normalized ERP rank into `1 | 2 | 3` and strictly derived permissions from the rank.
   - Fallback logic: Checks `override.rank` -> `mr.rank` (ERP column) -> `mr.JobProfile` (`MR` -> Rank 1, `ABM`/`BO` -> Rank 2, `ASM`/`RSM`/`ZSM` -> Rank 3) -> default Rank 3.

2. **Strict Rank Permission Matrix:**
   - **Rank 1**: Only sees **Stock** reports (`canViewStock: true`, all other permissions `false`).
   - **Rank 2**: Sees **Stock** and **Claim Quantity / Free Scheme** reports (`canViewStock: true`, `canViewFreeScheme: true`, all other permissions `false`).
   - **Rank 3**: Sees **All** reports (`canViewStock: true`, `canViewFreeScheme: true`, `canViewSales: true`, `canViewPartyWise: true`, `canViewProductWise: true`).
   - Implemented helper `getPermissionsForRank(rank: MRRank)` in `src/server/actions/mrs.ts`.
   - Updated `LegacyMRUser` and `MRDisplayItem` interfaces in `src/server/actions/mrInfo.ts` to include `rank` and `lastLogin`.

3. **Last Login Timestamp Tracking:**
   - In `src/server/actions/authActions.ts`:
     - When an MR completes OTP verification (`verifyMrOtp`), their `lastLogin` timestamp is permanently recorded in `data/mr_overrides.json` via `recordMRLastLogin(mrId)`.
     - In `requestMrOtp`: Automatically applies rank and strict permissions to `SessionUser` and JWT token.
   - Formatted in Indian Standard Time (`DD Mon YYYY, HH:MM AM/PM`) or displayed as `"Never logged in"`.

4. **MR Dashboard Access Enforcement:**
   - In `src/components/mr-dashboard-content.tsx`:
     - Derived `allowedTabs` strictly based on active rank permissions.
     - Automatic tab fallback: If an MR lacks permission for a requested tab, the system falls back to their primary allowed tab (`"stock"` for Rank 1).
     - Gated all tab link headers, report views, and download action buttons based on `activeTab`.
     - Replaced old `"Debug Permissions"` badge with a professional, clean `Rank X` badge and access summary.

5. **Admin MR Management UI Simplification:**
   - In `src/app/admin/mrs/MRListInfiniteScroll.tsx`:
     - **Removed cluttered forms**: Removed the "Assign Manufacturer / Division" dropdown form, "Remove Assignment" buttons, and the 5-checkbox permission form with "Save Permissions" button.
     - **Display-only information**:
       1. **MR Name** & **Email**
       2. **Block / Unblock** action toggle
       3. **View Data** link (`/admin/mrs/[id]`)
       4. **Last Login** timestamp
       5. **Manufacturer & Division** (read-only from ERP profile)
       6. **MR Rank Indicator** with styled badge + quick rank switcher buttons (`[Rank 1]` `[Rank 2]` `[Rank 3]`)
       7. **Active Report Permissions** (clean read-only status pills with green checkmarks or line-through for disabled)

6. **Quality & Verification Gates:**
   - TypeScript checks passing with 0 errors (`pnpm exec tsc --noEmit`).
   - API server builds with 0 errors (`npm run build`).
   - Unit test assertions for Rank 1, 2, and 3 passed.
