# Debug Session: Stock & Sales Stored Procedure Argument Count Mismatch

**Status:** Resolved  
**Date:** 2026-10-23  
**Symptom:**  
`Failed to load Stock & Sales report: API Server HTTP 500: {"success":false,"error":"Incorrect number of arguments for PROCEDURE pdyasvtrans.rptStockandSalesStatementReport; expected 11, got 10"}`

---

## 1. Root Cause Analysis

In commit `0350aff` (`feat(auth,master,reports): align Stock & Sales parameters...`), `api-server/src/routes/reports.ts` was refactored to add `itemCategory`, `divId`, `includeBr`, and `showFree` options.

During this refactor:
1. The 8th parameter `finYear` (defaults to `202627`) was inadvertently removed from the `formattedParams` array in both:
   - `POST /api/reports/stock-and-sales` (line 107)
   - `POST /api/reports/dev-procedure-sandbox` (line 630)
2. This reduced the total number of arguments passed in `CALL \`pdyasvtrans\`.\`rptStockandSalesStatementReport\`(...)` from **11** to **10**.
3. The underlying MySQL stored procedure `pdyasvtrans.rptStockandSalesStatementReport` expects exactly 11 arguments:
   1. `p_CmpNo` (INT) — e.g. `11`
   2. `p_LocNo` (mediumtext) — e.g. `'(''11'')'`
   3. `p_FromDt` — e.g. `{d '2026-10-01'}`
   4. `p_ToDt` — e.g. `{d '2026-10-19'}`
   5. `p_CompCode` (longtext) — e.g. `'(''AASPAN'')'`
   6. `p_DivId` (longtext) — e.g. `'(''1'')'` or `''`
   7. `p_ItemIds` (longtext) — e.g. `''`
   8. `p_FinYear` (INT) — e.g. `202627`
   9. `p_IncludeBr` (varchar) — e.g. `'N'`
   10. `p_ItemCategory` (longtext) — e.g. `''`
   11. `p_ShowFree` (varchar) — e.g. `'Y'`

Consequently, MySQL rejected all procedure executions with HTTP 500: `"Incorrect number of arguments for PROCEDURE pdyasvtrans.rptStockandSalesStatementReport; expected 11, got 10"`.

---

## 2. Changes Made

1. **`api-server/src/routes/reports.ts`:**
   - In `/stock-and-sales`: Restored `finYear = req.body?.finYear ?? 202627` as parameter 8, shifting `includeBrParam`, `itemCatParam`, and `showFreeParam` to positions 9, 10, and 11.
   - In `/dev-procedure-sandbox`: Added `finYear = params.finYear ?? 202627` to position 8 for procedure `rptStockandSalesStatementReport`.
   - Built and verified with `tsc`.
   - Committed and pushed to `https://github.com/AstronautGuy/api-server.git` (`890da92`).

2. **Root Frontend & Diagnostics (`src/components/dev-control-center.tsx`, `src/server/actions/stockAndSales.ts`):**
   - Corrected SQL preview string in `dev-control-center.tsx` to include `202627`.
   - Updated procedure documentation comment in `stockAndSales.ts`.

---

## 3. Server Deployment Requirement

Because the API server (`api.asmeepharma.com`) is hosted on the client's on-premises/VPS server (`157.20.190.91`), the updated commit `890da92` must be pulled and rebuilt on the host machine:
```bash
git pull origin master
pnpm build
pnpm start # or pm2 restart api-server
```
