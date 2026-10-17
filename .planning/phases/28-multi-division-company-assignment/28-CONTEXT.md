# Phase 28: Multi-Division & Multi-Company MR Assignment Management - Context & Requirements

## Objectives
Equip PharmaQL with comprehensive **Multi-Division & Multi-Company MR Assignment Management**. In the legacy ERP database (`pdyasvmaster`), an MR record is linked by default to a single division (`l_mktcompany_mr.DivisionID -> l_mktcompany.ID -> m_mktcompany.Code`). In actual pharmaceutical field operations, medical representatives often represent multiple divisions or marketing companies simultaneously.

This phase provides:
1. Complete Admin & Developer UI to assign and remove marketing companies and divisions for any MR.
2. Safe persistence via `mr_overrides.json` (`readServerJson` / `writeServerJson`), respecting read-only ERP database rules.
3. Upgraded `LegacyMRUser` and `getMRInfo` resolving both legacy ERP primary assignments and multi-company overrides.
4. MR Dashboard division switcher enhancement displaying all assigned companies & divisions with support for "All Assigned Companies".
5. Multi-company report querying and export alignment for Excel, PDF, and print formats.
6. Enhanced MR search allowing search by company name and code in Admin MR view and Developer impersonation.

---

## Locked Implementation Decisions

### 1. Data Model & Storage (`mr_overrides.json`)
- **Structure**:
  Each assignment item stored in `mr_overrides[mrId].assignedManufacturers` contains:
  - `id`: Unique UUID (`string`).
  - `manufacturer`: Company description/name (e.g., `"ABBOTT HEALTHCARE PVT LTD"`).
  - `companyCode`: ERP company code (e.g., `"ABBOTTH"`).
  - `division`: Division description (e.g., `"ABBOTT -> CARDIAC"` or `"ALL"`).
  - `divisionId`: Division integer ID (or `null` if assigned to entire company).
  - `assignedAt`: ISO timestamp string.
- **Legacy ERP Default Inclusion**:
  If an MR has a legacy division/company from ERP (`mrInfo.company`, `mrInfo.division`), that legacy assignment is always preserved and treated as the primary assignment, seamlessly unioned with additional assigned companies/divisions.
- **Zero ERP Table Writes**:
  All custom assignments are stored in `data/mr_overrides.json` using atomic `writeServerJson` with lock guards.

### 2. Admin Assignment Modal & Manager UI (`/admin/mrs`)
- **Card Placement**:
  - Each MR card in `src/app/admin/mrs/MRListInfiniteScroll.tsx` displays an "Assignments" summary badge indicating the total assigned companies (e.g., `3 Companies / 5 Divisions`).
  - A prominent "Manage Assignments" button opens `MRAssignmentModal`.
- **Modal Features**:
  - **Existing Assignments List**: Shows each active company & division tag with a red removal (`✕`) button and confirmation.
  - **Company Selector**: Searchable combobox/dropdown listing all 74 marketing companies (`getAllMarketingCompaniesWithDivisions()`).
  - **Division Selector**: Shows all divisions for the selected company, with an "All Divisions in this Company" option.
  - **Add Assignment Button**: Adds the company/division mapping instantly with optimistic UI update and server revalidation.

### 3. MR Search by Company Name / Code
- **Admin Search (`MRSearchForm`) & Developer Sim**:
  - Upgraded filter logic in `fetchMRsPage` and `getAllMRsForDev` to search by `name`, `email`, `company`, `companyCode`, `division`, and any assigned multi-companies.
  - Resolves the issue where reps could not be discovered by their company name.

### 4. MR Dashboard Multi-Division Switcher (`MrDashboardContent`)
- **Dynamic Dropdown**:
  - In `src/components/mr-dashboard-content.tsx`, `effectiveAssignments` is populated from `mrInfo.assignments` (containing both ERP default and multi-company overrides).
  - The division selector dropdown lists all assigned divisions grouped by company.
  - Includes an "All Assigned Companies" option for reps with multi-company coverage.

### 5. Report Querying & Export Synchronization
- **Report Actions**:
  - When an MR selects a specific company/division, reports query for that specific company code / division.
  - When "All" is selected, report queries aggregate across all assigned company codes.
- **Export Verification**:
  - Download endpoints (`/api/reports/download-stock`, `/api/reports/download-sales`, `/api/reports/download-outstanding`) accept `companyCode` or `division` validated against the user's assigned companies.

---

## Verification & Quality Gates
1. Type check: `pnpm exec tsc --noEmit` must pass with 0 errors.
2. Build check: `pnpm run build` must succeed cleanly.
3. End-to-end assignment check: Assigning, removing, viewing in MR dashboard, switching company/division in report views.
4. Git synchronization: Push cleanly across `localdb`, `dev`, and `prod`.
