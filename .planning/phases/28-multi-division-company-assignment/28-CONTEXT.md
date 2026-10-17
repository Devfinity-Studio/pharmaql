# Phase 28: Multi-Division MR Database Scanning & Aggregation - Context & Requirements

## Objectives
Equip PharmaQL with automated **Multi-Division Database Scanning and Aggregation** for Medical Representatives (MRs). The ERP database (`pdyasvmaster.l_mktcompany_mr`) has been updated to contain multiple rows for the same MR (sharing the same `MRName` and/or `EmailId`, but having different `ID` and `DivisionID` values linking to different divisions in `l_mktcompany` and marketing companies in `m_mktcompany`).

Previously, queries in `auth.ts`, `master.ts`, and `mrInfo.ts` executed with `LIMIT 1` or treated each row in isolation, causing MRs to see only their first division and hiding all other assigned divisions. Furthermore, MR impersonation in the Developer Control Center (`/admin/dev`) did not consolidate these entries or allow full search by company name.

This phase implements automated scanning across all duplicate MR records in the database, consolidating them into unified MR profiles with all their divisions and companies, upgrading the MR Dashboard division selector, and making all MRs searchable by company name, code, division, and name.

---

## Locked Implementation Decisions

### 1. Database Scanning & Entity Consolidation (Zero Manual Input Needed)
- **Automatic Matching Criteria**:
  - Two or more records in `pdyasvmaster.l_mktcompany_mr` represent the same MR if:
    1. They share the same `MRName` (case-insensitive, trimmed), OR
    2. They share the same non-placeholder `EmailId` (case-insensitive, trimmed, excluding `@asmeepharma.com` synthetic emails).
- **Aggregated Profile**:
  - Primary identity: Uses the primary row ID, name, email, mobile, and rank.
  - `assignments` / `divisions`: An array containing all distinct divisions and companies associated with the MR across all matching database rows:
    ```ts
    assignments: [
      {
        id: string; // row ID in l_mktcompany_mr
        divisionId: number; // l_mktcompany.ID
        division: string; // l_mktcompany.Division
        companyId: number; // m_mktcompany.ID
        companyCode: string; // m_mktcompany.Code
        company: string; // m_mktcompany.Description
        manufacturer: string;
      }
    ]
    ```

### 2. API Server & Next.js Backend Layer
- **`api-server/src/routes/auth.ts`**:
  - In `/api/auth/mr-lookup`: Remove `LIMIT 1`. Query all rows matching the user's email, phone, or name. Aggregate all divisions into the returned user session payload.
- **`api-server/src/routes/master.ts`**:
  - In `/api/master/mr-info/:id`: When an MR is queried by ID or identifier, locate the primary record, then query all related rows for that MR in `l_mktcompany_mr` to attach the full list of divisions and companies.
- **`src/server/actions/mrInfo.ts`**:
  - In `getMRInfo(identifier)`: Ensure the returned `LegacyMRUser` includes all scanned database divisions in `assignments`.
  - In `fetchMRsPage`: Group rows by MR identity so MRs with multiple divisions appear as a single consolidated rep with all divisions displayed. Support search across `company`, `companyCode`, `division`, `name`, and `email`.
  - In `getAllMRsForDev`: Consolidate multi-division entries so that the Developer Impersonation table lists all MRs cleanly with all their companies and divisions.

### 3. Developer Impersonation (`/admin/dev`) & Admin List (`/admin/mrs`)
- **Search Capabilities**:
  - Reps are searchable by:
    - Company Name (e.g., "Altrex", "Alembic", "Apical", "Valite")
    - Company Code (e.g., "ALTRX", "ALEMBIC", "APICAL", "VALITE")
    - Division Name (e.g., "ALTRX", "MEDIBRUCK", "SHREEJI", "SUMMIT")
    - MR Name (e.g., "Amit Bhagat", "Kalpesh")
    - MR Email and ID
- **Display**:
  - Cards and table rows clearly display all assigned divisions as distinct badges or pills (e.g., `ALTRX`, `MEDIBRUCK`, `SHREEJI`).
  - Clicking "View As MR" or "View Data" retains access to all of that MR's divisions.

### 4. MR Dashboard Multi-Division Switcher (`MrDashboardContent`)
- **Division Dropdown**:
  - Upgraded from using single `legacyDivision` to using the full list of scanned divisions from `mrInfo.assignments`.
  - Displays all divisions (e.g. `ALTRX`, `MEDIBRUCK`, `SHREEJI`), with the option to filter by a specific division or view "All Divisions".
  - Switching division filters the report queries (Stock Movement, Sales, Overdue/Outstanding, Claim Quantity) to that specific division and its corresponding company code.

---

## Verification & Quality Gates
1. Type check: `pnpm exec tsc --noEmit` must pass with 0 errors.
2. Build check: `pnpm run build` must succeed cleanly.
3. Multi-division verification:
   - Amit Bhagat (ID 47 / 244 / 245) shows 3 divisions: `ALTRX`, `MEDIBRUCK`, `SHREEJI`.
   - Kalpesh Rajpurohit (ID 182 / 185) shows 2 divisions: `SUMMIT-1`, `SUMMIT`.
   - Manish Lonkar (ID 82 / 198) shows 2 divisions: `APICAL - INETA`, `APICAL - LEVANTA`.
   - Sachin (ID 26 / 92) shows 2 divisions: `COSMEDERMA`, `VALITE` across 2 companies.
4. Search verification: Searching "altrex" or "alembic" in MR search finds the respective reps.
5. Impersonation verification: "View As MR" loads the dashboard with the division switcher containing all divisions.
