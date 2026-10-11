# Phase 9: Legacy MySQL MR User Integration Plan

## Goal
Transition all Medical Representative (MR) identity, profile, and authorization metadata lookups from the Neon PostgreSQL `user` table to the client's legacy MySQL database schema (`pdyasvmaster.m_user`).

---

## 1. Overview & Architecture

### Legacy Schema: `pdyasvmaster.m_user`
The legacy MySQL database is accessed via `legacyDb` (`mysql2/promise`) using credentials configured in `.env` (`CLIENT_MYSQL_*` pointing to `pdyasvmaster` and `pdyasvtrans`).

The explicit SQL schema specified by the client:
```sql
SELECT 
    `pdyasvmaster`.`m_user`.`ID` AS `ID`,
    `pdyasvmaster`.`m_user`.`UCode` AS `UCode`,
    `pdyasvmaster`.`m_user`.`Description` AS `Description`,
    `pdyasvmaster`.`m_user`.`Password` AS `Password`,
    `pdyasvmaster`.`m_user`.`JobProfile` AS `JobProfile`,
    `pdyasvmaster`.`m_user`.`Education` AS `Education`,
    `pdyasvmaster`.`m_user`.`Address1` AS `Address1`,
    `pdyasvmaster`.`m_user`.`Address2` AS `Address2`,
    `pdyasvmaster`.`m_user`.`Address3` AS `Address3`,
    `pdyasvmaster`.`m_user`.`City` AS `City`,
    `pdyasvmaster`.`m_user`.`Area` AS `Area`,
    `pdyasvmaster`.`m_user`.`ContactNoR` AS `ContactNoR`,
    `pdyasvmaster`.`m_user`.`MobileNo` AS `MobileNo`,
    `pdyasvmaster`.`m_user`.`EmailId` AS `EmailId`,
    `pdyasvmaster`.`m_user`.`DOB` AS `DOB`,
    `pdyasvmaster`.`m_user`.`DOA` AS `DOA`,
    `pdyasvmaster`.`m_user`.`DOJ` AS `DOJ`,
    `pdyasvmaster`.`m_user`.`DOR` AS `DOR`,
    `pdyasvmaster`.`m_user`.`Gender` AS `Gender`,
    `pdyasvmaster`.`m_user`.`BloodGroup` AS `BloodGroup`,
    `pdyasvmaster`.`m_user`.`RefrenceBy` AS `RefrenceBy`,
    `pdyasvmaster`.`m_user`.`RefrenceContact` AS `RefrenceContact`,
    `pdyasvmaster`.`m_user`.`Guardian` AS `Guardian`,
    `pdyasvmaster`.`m_user`.`GuardianContact` AS `GuardianContact`,
    `pdyasvmaster`.`m_user`.`ValidityDays` AS `ValidityDays`,
    `pdyasvmaster`.`m_user`.`PasswordExpDt` AS `PasswordExpDt`,
    `pdyasvmaster`.`m_user`.`Notes` AS `Notes`,
    `pdyasvmaster`.`m_user`.`IsSalesMan` AS `IsSalesMan`,
    `pdyasvmaster`.`m_user`.`IsDeliveryman` AS `IsDeliveryman`,
    `pdyasvmaster`.`m_user`.`IsBlocked` AS `IsBlocked`,
    `pdyasvmaster`.`m_user`.`IsSaleUser` AS `IsSaleUser`,
    `pdyasvmaster`.`m_user`.`RestrictComNo` AS `RestrictComNo`,
    `pdyasvmaster`.`m_user`.`RestrictLocNo` AS `RestrictLocNo`,
    `pdyasvmaster`.`m_user`.`RestrictYearNo` AS `RestrictYearNo`,
    `pdyasvmaster`.`m_user`.`UserImg` AS `UserImg`,
    `pdyasvmaster`.`m_user`.`xCode` AS `xCode`,
    `pdyasvmaster`.`m_user`.`WorkingDate` AS `WorkingDate`,
    `pdyasvmaster`.`m_user`.`LogCmpNo` AS `LogCmpNo`,
    `pdyasvmaster`.`m_user`.`LogLocNo` AS `LogLocNo`,
    `pdyasvmaster`.`m_user`.`LogYearNo` AS `LogYearNo`,
    `pdyasvmaster`.`m_user`.`LogStatus` AS `LogStatus`,
    `pdyasvmaster`.`m_user`.`WorkingAddress` AS `WorkingAddress`,
    `pdyasvmaster`.`m_user`.`LogInDateTime` AS `LogInDateTime`,
    `pdyasvmaster`.`m_user`.`WorkingDateTime` AS `WorkingDateTime`,
    `pdyasvmaster`.`m_user`.`CreatedBy` AS `CreatedBy`,
    `pdyasvmaster`.`m_user`.`CreatedDate` AS `CreatedDate`,
    `pdyasvmaster`.`m_user`.`EditedBy` AS `EditedBy`,
    `pdyasvmaster`.`m_user`.`EditedDate` AS `EditedDate`,
    `pdyasvmaster`.`m_user`.`RowVersion` AS `RowVersion`,
    `pdyasvmaster`.`m_user`.`UserGroup` AS `UserGroup`,
    `pdyasvmaster`.`m_user`.`showMargin` AS `showMargin`,
    `pdyasvmaster`.`m_user`.`Chalprinter` AS `Chalprinter`,
    `pdyasvmaster`.`m_user`.`SalePrinter` AS `SalePrinter`,
    `pdyasvmaster`.`m_user`.`SaleRestrictedICS` AS `SaleRestrictedICS`,
    `pdyasvmaster`.`m_user`.`StageID` AS `StageID`,
    `pdyasvmaster`.`m_user`.`PrintInvoice` AS `PrintInvoice`
FROM `pdyasvmaster`.`m_user`
```

---

## 2. Planned Implementation Tasks

### Task 1: Finalize Centralized Action `src/server/actions/mrInfo.ts`
- Expose `getMRInfo(identifier)` to fetch a single user by ID, UCode, Description, or Email.
- Expose `getAllMRUsers()` to return all legacy users from `pdyasvmaster.m_user`.
- Ensure robust fallbacks for Postgres session mappings while the system transitions to MySQL primary keys.

### Task 2: Update Server Components & Dashboards
Replace all Neon `db.select().from(user).where(eq(user.id, mrId))` calls with `getMRInfo(mrId)`:
1. **`src/app/admin/mrs/[id]/page.tsx`**: Replace direct user query with `await getMRInfo(decodedId)`.
2. **`src/components/mr-dashboard-content.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.
3. **`src/components/stock-report-view.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.
4. **`src/components/sales-report-view.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.
5. **`src/components/new-sales-report-view.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.
6. **`src/components/product-report-view.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.
7. **`src/components/outstanding-report-view.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.
8. **`src/components/overdue-report-view.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.
9. **`src/components/free-scheme-report-view.tsx`**: Replace `db.select().from(user)` with `await getMRInfo(mrId)`.

### Task 3: Update API Report Download Routes
Update all download handlers to call `getMRInfo(mrId)`:
1. `src/app/api/reports/download-stock/route.ts`
2. `src/app/api/reports/download-sales/route.ts`
3. `src/app/api/reports/download/route.ts`
4. `src/app/api/reports/download-outstanding/route.ts`

### Task 4: Update Admin MR Management Views
- In `src/app/admin/mrs/page.tsx`, integrate `getAllMRUsers()` so administrators can see and manage representatives directly from `pdyasvmaster.m_user`.

### Task 5: Build & Type-Check Verification
- Execute `pnpm run build` to verify clean compilation with zero type errors.
- Test dashboard rendering for both legacy codes (`ADMIN`, `ACO01`, `BHA01`, etc.) and mapped identifiers.
