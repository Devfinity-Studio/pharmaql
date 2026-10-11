import { Router, Request, Response } from "express";
import { dbPool } from "../db.js";
import { getOrSetCache } from "../cache.js";

export const masterRouter = Router();

const SELECT_MKT_MR_COLUMNS = `
  mr.ID AS ID,
  mr.DivisionID AS DivisionID,
  mr.MRName AS MRName,
  mr.EmailId AS EmailId,
  mr.MobileNo AS MobileNo,
  mr.JobProfile AS JobProfile,
  mr.IsInActive AS IsInActive,
  mr.ShowDealerSalesinWeb AS ShowDealerSalesinWeb,
  l.Division AS DivisionName,
  m.ID AS CompanyID,
  m.Code AS CompanyCode,
  m.Description AS CompanyName
`;

const LEGACY_MKT_MR_QUERY = `
  SELECT ${SELECT_MKT_MR_COLUMNS}
  FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` mr
  LEFT JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON mr.DivisionID = l.ID
  LEFT JOIN \`pdyasvmaster\`.\`m_mktcompany\` m ON l.CompCode = m.Code
`;

function normalizeLegacyMR(raw: any) {
  const isBlocked = Number(raw.IsInActive ?? raw.IsBlocked ?? 0) === 1;
  const name = (raw.MRName || raw.Description || raw.UCode || "MR User").toString().trim();
  const email = (raw.EmailId || `${raw.ID}@asmeepharma.com`).toString().trim();
  const division = raw.DivisionName ? String(raw.DivisionName).trim() : undefined;
  const company = raw.CompanyName || raw.CompanyCode ? String(raw.CompanyName || raw.CompanyCode).trim() : undefined;
  const companyCode = raw.CompanyCode ? String(raw.CompanyCode).trim() : undefined;

  return {
    ID: raw.ID,
    MRName: name,
    EmailId: raw.EmailId || null,
    MobileNo: raw.MobileNo || null,
    JobProfile: raw.JobProfile || null,
    DivisionID: raw.DivisionID || null,
    DivisionName: division,
    CompanyID: raw.CompanyID || null,
    CompanyCode: companyCode || null,
    CompanyName: company,
    IsInActive: raw.IsInActive ?? 0,
    ShowDealerSalesinWeb: raw.ShowDealerSalesinWeb || "N",
    id: String(raw.ID),
    name,
    email,
    locNo: "11",
    division,
    company,
    companyCode,
    isBlocked,
    canViewStock: true,
    canViewSales: true,
    canViewFreeScheme: true,
    canViewPartyWise: true,
    canViewProductWise: true,
  };
}

/**
 * 1. Single MR Info Lookup
 */
masterRouter.get("/mr-info/:id", async (req: Request, res: Response) => {
  try {
    const identifier = req.params.id;
    if (!identifier) {
      res.status(400).json({ success: false, error: "ID is required" });
      return;
    }

    const strId = String(identifier).trim();
    const numId = Number(identifier);
    const isNumeric = !isNaN(numId) && String(numId) === strId;

    const query = isNumeric
      ? `${LEGACY_MKT_MR_QUERY} WHERE mr.ID = ? LIMIT 1`
      : `${LEGACY_MKT_MR_QUERY} WHERE mr.EmailId = ? OR mr.MRName = ? OR mr.MobileNo = ? LIMIT 1`;

    const params = isNumeric ? [numId] : [strId, strId, strId];
    const [rows] = await dbPool.query(query, params);
    const results = rows as any[];

    if (results && results.length > 0) {
      res.json({ success: true, data: normalizeLegacyMR(results[0]) });
      return;
    }

    // Fuzzy search
    const [fallbackRows] = await dbPool.query(
      `${LEGACY_MKT_MR_QUERY} WHERE mr.MRName LIKE ? OR mr.EmailId LIKE ? LIMIT 1`,
      [`%${strId}%`, `%${strId}%`]
    );
    const fallbackResults = fallbackRows as any[];
    if (fallbackResults && fallbackResults.length > 0) {
      res.json({ success: true, data: normalizeLegacyMR(fallbackResults[0]) });
      return;
    }

    // Check internal m_user
    const [userRows] = await dbPool.query(
      `SELECT ID, UCode, Description, EmailId, MobileNo, IsBlocked FROM \`pdyasvmaster\`.\`m_user\` WHERE ID = ? OR UCode = ? LIMIT 1`,
      [isNumeric ? numId : -1, strId]
    );
    const userResults = userRows as any[];
    if (userResults && userResults.length > 0) {
      const u = userResults[0];
      res.json({
        success: true,
        data: normalizeLegacyMR({
          ID: u.ID,
          MRName: u.Description || u.UCode,
          EmailId: u.EmailId,
          MobileNo: u.MobileNo,
          IsInActive: u.IsBlocked,
        }),
      });
      return;
    }

    res.json({ success: true, data: null });
  } catch (error: any) {
    console.error("[Master API] MR Info Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to query MR info" });
  }
});

/**
 * 2. All MR Users
 */
masterRouter.get("/mrs", async (_req: Request, res: Response) => {
  try {
    const [rows] = await dbPool.query(`${LEGACY_MKT_MR_QUERY} ORDER BY mr.MRName ASC`);
    const results = ((rows as any[]) || []).map(normalizeLegacyMR);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("[Master API] All MRs Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to query MRs" });
  }
});

/**
 * 3. Marketing Companies & Divisions (Cached 1 hour)
 */
masterRouter.get("/companies", async (_req: Request, res: Response) => {
  try {
    const data = await getOrSetCache("all_marketing_companies_with_divisions", 3600, async () => {
      const [rows] = await dbPool.query(`
        SELECT DISTINCT
          m.ID AS companyId,
          m.Code AS companyCode,
          m.Description AS companyName,
          l.ID AS divisionId,
          l.Division AS divisionName
        FROM \`pdyasvmaster\`.\`m_mktcompany\` m
        JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON m.Code = l.CompCode
        WHERE m.IsInActive = 0
        ORDER BY m.Description ASC, l.Division ASC
      `);
      return (rows as any[]) || [];
    });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("[Master API] Companies Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to query companies" });
  }
});

/**
 * 4. Customer Blocking Status Map (Cached 10 minutes)
 */
masterRouter.get("/customer-blocking", async (_req: Request, res: Response) => {
  try {
    const items = await getOrSetCache("customer_blocking_items", 600, async () => {
      const [rows] = await dbPool.query(`
        SELECT 
          ID, CustCode, Customer, InActive, BlackList, NotAllowInvoice,
          BlackListRmk, MaxOutDays, CrossigLimitAmt
        FROM \`pdyasvmaster\`.\`m_customer\`
      `);
      return (rows as any[]) || [];
    });
    res.json({ success: true, data: items });
  } catch (error: any) {
    console.error("[Master API] Customer Blocking Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to query customer blocking" });
  }
});

/**
 * 5. Item Catalog (Cached 30 minutes)
 */
masterRouter.get("/catalog", async (req: Request, res: Response) => {
  try {
    const division = req.query.division ? String(req.query.division) : undefined;
    const company = req.query.company ? String(req.query.company) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 200;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

    const cacheKey = `catalog:${division || "all"}:${company || "all"}:${search || ""}:${limit}:${offset}`;

    const items = await getOrSetCache(cacheKey, 1800, async () => {
      const conditions: string[] = ["InActive = 0"];
      const params: any[] = [];

      if (division && division !== "All") {
        conditions.push("(Division = ? OR MktBy = ?)");
        params.push(division, division);
      }

      if (search) {
        conditions.push("(ItemName LIKE ? OR ItemCode LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const sql = `
        SELECT 
          ID, AWACSCode, SeriesID, ItemCode, ItemName, PrintName, Packing,
          BaseUnit, PurcUnit, QtyPerPurcUnit, MktByID, MktBy, MfgByID,
          DivisionId, Division, AllowInvDisc, DiscPer, MinNetQty, MultipleOfQty,
          MinSaleQty, AllowSLRT, AllowChangePTR, IncSS, ItemCatgID, ItemCategory,
          IsColdChain, ItemGroup, MISRate, HSN, TaxGrpCode, GeneralTaxP, CompNo,
          PriQty, PriContains, PriContainsUnit, LBatchNo, LPrate, LPTR, LMRP,
          LExpDt, PTRMarginP, PRateMarginP, InActive
        FROM \`pdyasvmaster\`.\`m_item\`
        ${whereSql}
        ORDER BY ItemName ASC
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);
      const [rows] = await dbPool.query(sql, params);
      return (rows as any[]) || [];
    });

    res.json({ success: true, data: items });
  } catch (error: any) {
    console.error("[Master API] Catalog Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to query catalog" });
  }
});
