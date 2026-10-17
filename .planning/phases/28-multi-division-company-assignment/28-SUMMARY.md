# Phase 28: Multi-Division MR Database Scanning & Aggregation - Execution Summary

## Objective Accomplished
Equipped PharmaQL with an automated **Multi-Division Database Scanning and Aggregation Engine**. The ERP database (`pdyasvmaster.l_mktcompany_mr`) contains multiple rows for the same MR sharing the same `MRName` and/or `EmailId`, but each linked to different `DivisionID` values across marketing companies in `m_mktcompany`.

Instead of requiring manual Admin assignments or restricting MRs to a single row via `LIMIT 1`, the system now scans and consolidates all related database entries using **email-first priority**, providing reps, Admins, and Developers with seamless multi-division access and complete company-name searchability.

---

## Key Changes Implemented

### 1. Database Scanning & Profile Consolidation Engine (`src/server/actions/mrInfo.ts`)
- Implemented `consolidateMRProfiles(rawList, allOverrides)`:
  - **Priority 1 (Email)**: Matches records sharing the same valid, non-synthetic `EmailId` (excluding `@asmeepharma.com` placeholders).
  - **Priority 2 (Name)**: Matches remaining records by case-insensitive, trimmed `MRName`.
  - Merges all linked database IDs into `allIds: string[]` and all distinct divisions/companies into `assignments: MRAssignment[]`.
- Updated `getMRInfo(identifier)`:
  - Finds the MR's consolidated cluster whether requested by their primary ID, secondary ID, email, or name.
  - Returns `LegacyMRUser` populated with `assignments` and `allIds`.
- Updated `getAllMRsForDev()` and `fetchMRsPage`:
  - Consolidates the 188 raw database records into 181 unique MR identities.
  - Supports searching across MR name, email, company description, company code, division, and all assigned division tags.

### 2. API Server Route Upgrades (`api-server/src/routes/auth.ts`, `api-server/src/routes/master.ts`)
- Removed `LIMIT 1` restrictions from `/api/auth/mr-lookup` and `/api/master/mr-info/:id`.
- Scans all matching rows across `l_mktcompany_mr` and returns aggregated `assignments` and `allIds`.

### 3. MR Dashboard & Admin View Division Switcher (`src/components/mr-dashboard-content.tsx`)
- Derived `effectiveAssignments` directly from `mrInfo.assignments`.
- Beside the **All Divisions** button (with division count), added individual division-wise buttons (e.g. `ALTRX`, `MEDIBRUCK`, `SHREEJI`) with clean active/inactive styling.
- When **All Divisions** is clicked: queries aggregate across all assigned divisions/companies.
- When a specific division is clicked: queries filter specifically to that division.

### 4. Developer Impersonation & Admin MR List UI Enhancements
- In `/admin/dev` (MR Simulation & View-As):
  - Displays all assigned divisions as badges for each MR.
  - Search filter matches by company name, company code, division name, MR name, and email.
- In `/admin/mrs` (MR Cards):
  - Added an "Assigned Divisions" section rendering all division badges.

### 5. Report Queries & Export Endpoints Alignment
- **`StockReportView` & `/api/reports/download-stock`**:
  - Resolves `targetCodes` from `mrInfo.assignments` so when "All Divisions" is selected, all company codes are queried. When a specific division is selected, only that division's data is exported.
- **`ProductReportView` & `PartyReportView` & `/api/reports/download-sales`**:
  - Automatically resolves company codes across all assignments for "All Divisions" and specific division targets.
- **`OverdueReportView` & `/api/reports/download-outstanding`**:
  - Queries `rptMRwisePeriodicalOutstanding` with `targetMrId` (e.g. `(47, 244, 245)` for "All Divisions", or `244` for a single division).

---

## Verification & Quality Gates
- **TypeScript Typecheck**: `pnpm exec tsc --noEmit` passed with 0 errors.
- **API Server Typecheck**: `npx tsc --noEmit` passed with 0 errors.
- **Next.js Production Build**: `pnpm run build` succeeded cleanly (all 15 routes generated).
- **Live Database MR Verifications**:
  - `AMIT BHAGAT`: 3 divisions (`ALTRX`, `MEDIBRUCK`, `SHREEJI`), IDs: `47, 244, 245`.
  - `KALPESH RAJPUROHIT`: 2 divisions (`SUMMIT-1`, `SUMMIT`), IDs: `182, 185`.
  - `MANISH LONKAR`: 2 divisions (`APICAL - INETA`, `APICAL - LEVANTA`), IDs: `82, 198`.
  - `RAVIKUMAR`: 2 divisions (`SUMMIT-1`, `SUMMIT`), IDs: `181, 183`.
  - `SACHIN`: 2 divisions (`COSMEDERMA`, `VALITE`), IDs: `26, 92`.
