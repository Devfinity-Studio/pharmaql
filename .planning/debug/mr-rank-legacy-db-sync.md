---
status: resolved
trigger: "any change in the legacy database for the mr rank is not updated in the frontend. even after logging out and again logging in."
created: 2026-10-24T11:58:00+05:30
updated: 2026-10-24T12:10:00+05:30
---

## Current Focus

hypothesis: Resolved. Fixed rank escalation and defaulting bugs in api-server and Next.js, and documented exact SQL column requirements.
test: Verified with automated Vitest suite (36 tests passing) and TypeScript builds.
expecting: Explicit database rank updates to JobProfile or Rank column now reflect immediately on login or refresh without being masked by null division rows.
next_action: None.

## Symptoms

expected: Changing an MR's rank in the legacy database (e.g. `pdyasvmaster.l_mktcompany_mr`) reflects immediately in the frontend after logging out and logging back in.
actual: Any change in the legacy database for the MR rank is not updated in the frontend, even after logging out and again logging in.
errors: []
reproduction: Update MR rank in the legacy MySQL database, log out of MR dashboard, log back in. The rank and permissions shown in the frontend remain the previous value.
started: Present in current rank sync workflow.

## Eliminated

- Stale local overrides in `data/mr_overrides.json`: Inspected file; it only contains lastLogin timestamps, no rank overrides.
- Next.js fetch caching: `apiGet` explicitly uses `{ cache: "no-store" }`.

## Evidence

- Checked live database for all 188 MRs via `/api/master/mrs`: Breakdown is 25 Rank 1 ('MR'), 18 Rank 2 ('ABM'/'BO'), and 145 Rank 3 (RSM/ZSM/ASM or NULL).
- Checked Hetal Shah (`alplbaroda2021@gmail.com` / ID 243) in live database: `JobProfile` is currently `NULL`.
- In `api-server/src/routes/auth.ts:68`, `let r: 1 | 2 | 3 = 3;` defaulted every row without a rank to 3, and `if (r > maxRank) maxRank = r;` forced maxRank to 3 if any division row was unset.
- In `src/server/actions/mrInfo.ts:202-228`, `consolidateMRProfiles` iterated through all linked division rows. If an MR had one row with Rank 1 and another division row with null, the null row defaulted to 3 in `normalizeLegacyMR`, causing `maxRank` to permanently escalate to 3.

## Resolution

root_cause: |
  1. Escalation-only Rank Resolution in `consolidateMRProfiles`: When an MR has multiple division entries in `l_mktcompany_mr`, any entry with an unassigned/null JobProfile was treated as Rank 3, permanently escalating `maxRank = 3` and preventing downgrades to Rank 1 or Rank 2.
  2. Premature Defaulting in `normalizeLegacyMR`: `api-server/src/routes/master.ts` and `api-server/src/routes/auth.ts` initialized `rank = 3` as fallback for rows with null/empty values, instead of distinguishing between an explicit Rank 3 and an unassigned profile.
  3. Schema Alignment: The legacy database column representing rank is `JobProfile` ('MR' = Rank 1; 'ABM'/'BO' = Rank 2; 'ASM'/'RSM'/'ZSM'/'NSM' = Rank 3) or custom column `Rank` / `rank`. If an admin updates `Rank` or `JobProfile` in MySQL, null division peers must not override it.
fix: |
  1. Updated `api-server/src/routes/auth.ts` to track `explicitRank` (defaulting null rows to `null` instead of `3`), ensuring only rows with actual designations vote on `maxRank`.
  2. Updated `api-server/src/routes/master.ts` to compute and expose `explicitRank`.
  3. Updated `src/server/actions/mrInfo.ts` (`consolidateMRProfiles`) to prioritize explicit database ranks and `JobProfile` mappings across member rows so secondary division rows with null profile cannot override Rank 1 or Rank 2.
  4. Updated `src/server/actions/authActions.ts` (`requestMrOtp`) to look up and apply explicit database rank directly from both `getMRInfo` and `mr-lookup`.
  5. Added automated regression test in `src/lib/__tests__/permissions.test.ts` verifying multi-division rank resolution without null profile escalation.
verification: |
  - Ran `pnpm test`: All 36 Vitest unit tests passed (including new regression test).
  - Ran `api-server` build: `npm run build` completed with 0 errors.
  - Ran `pnpm typecheck`: Clean TypeScript compilation with 0 errors.
files_changed:
  - api-server/src/routes/auth.ts
  - api-server/src/routes/master.ts
  - src/server/actions/mrInfo.ts
  - src/server/actions/authActions.ts
  - src/lib/__tests__/permissions.test.ts
  - .planning/debug/mr-rank-legacy-db-sync.md
