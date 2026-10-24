import { Router, Request, Response } from "express";
import { dbPool } from "../db";
import { getOrSetCache } from "../cache";

export const masterRouter = Router();

const SELECT_MKT_MR_COLUMNS = `
  mr.*,
  mr.ID AS ID,
  mr.DivisionID AS DivisionID,
  mr.MRName AS MRName,
  mr.EmailId AS EmailId,
  mr.MobileNo AS MobileNo,
  mr.JobProfile AS JobProfile,
  mr.Ranking AS Ranking,
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

  // Determine Rank: 1, 2, or 3 directly from database
  // Note: ERP column in pdyasvmaster.l_mktcompany_mr is named `Ranking`
  const rawRank = raw.Ranking ?? raw.ranking ?? raw.Rank ?? raw.rank ?? raw.UserRank ?? raw.MRRank;
  let explicitRank: 1 | 2 | 3 | null = null;
  if (rawRank !== undefined && rawRank !== null && String(rawRank).trim() !== "") {
    const parsed = Number(rawRank);
    if (parsed === 1 || parsed === 2 || parsed === 3) {
      explicitRank = parsed as 1 | 2 | 3;
    }
  } else if (raw.JobProfile) {
    const jp = String(raw.JobProfile).toUpperCase().trim();
    if (jp === "MR") explicitRank = 1;
    else if (jp === "ABM" || jp === "BO") explicitRank = 2;
    else if (jp === "ASM" || jp === "RSM" || jp === "ZSM" || jp === "NSM") explicitRank = 3;
  }

  const rank: 1 | 2 | 3 = explicitRank ?? 3;

  // Strict rank-based permissions:
  // Rank 1: Stock only
  // Rank 2: Stock and Claim Qty (Free Scheme)
  // Rank 3: All reports
  const canViewStock = true;
  const canViewFreeScheme = rank >= 2;
  const canViewSales = rank === 3;
  const canViewPartyWise = rank === 3;
  const canViewProductWise = rank === 3;

  return {
    ID: raw.ID,
    MRName: name,
    EmailId: raw.EmailId || null,
    MobileNo: raw.MobileNo || null,
    JobProfile: raw.JobProfile || null,
    Ranking: raw.Ranking ?? null,
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
    rank,
    explicitRank,
    canViewStock,
    canViewSales,
    canViewFreeScheme,
    canViewPartyWise,
    canViewProductWise,
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
      const primary = results[0];
      const name = (primary.MRName || "").trim();
      const email = (primary.EmailId || "").trim();
      const isSynth = !email || email.toLowerCase().includes("@asmeepharma.com");

      // Query all matching division rows for this MR
      const matchQuery = !isSynth
        ? `${LEGACY_MKT_MR_QUERY} WHERE mr.EmailId = ? OR (LOWER(TRIM(mr.MRName)) = LOWER(TRIM(?))) ORDER BY mr.ID ASC`
        : `${LEGACY_MKT_MR_QUERY} WHERE LOWER(TRIM(mr.MRName)) = LOWER(TRIM(?)) ORDER BY mr.ID ASC`;
      const matchParams = !isSynth ? [email, name] : [name];
      const [allRows] = await dbPool.query(matchQuery, matchParams);
      const allList = (allRows as any[]) || [primary];

      const norm = normalizeLegacyMR(primary) as any;
      const assignments = allList.map((item) => ({
        id: String(item.ID),
        divisionId: item.DivisionID || null,
        division: item.DivisionName ? String(item.DivisionName).trim() : null,
        companyId: item.CompanyID || null,
        companyCode: item.CompanyCode ? String(item.CompanyCode).trim() : null,
        company: item.CompanyName ? String(item.CompanyName).trim() : null,
        manufacturer: item.CompanyName ? String(item.CompanyName).trim() : (item.DivisionName || "General"),
      }));
      norm.assignments = assignments;
      norm.allIds = Array.from(new Set(allList.map((item) => String(item.ID))));

      res.json({ success: true, data: norm });
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
      `SELECT *, ID, UCode, Description, EmailId, MobileNo, IsBlocked FROM \`pdyasvmaster\`.\`m_user\` WHERE ID = ? OR UCode = ? LIMIT 1`,
      [isNumeric ? numId : -1, strId]
    );
    const userResults = userRows as any[];
    if (userResults && userResults.length > 0) {
      const u = userResults[0];
      res.json({
        success: true,
        data: normalizeLegacyMR({
          ...u,
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
 * 2. MR Users (supports optional pagination: limit, offset, search, sort)
 */
masterRouter.get("/mrs", async (req: Request, res: Response) => {
  try {
    const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const rawOffset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
    const search = req.query.search ? String(req.query.search).trim() : "";
    const sort = req.query.sort ? String(req.query.sort).trim() : "name_asc";

    const FROM_JOIN_SQL = `
      FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` mr
      LEFT JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON mr.DivisionID = l.ID
      LEFT JOIN \`pdyasvmaster\`.\`m_mktcompany\` m ON l.CompCode = m.Code
    `;

    const whereClauses: string[] = [];
    const whereParams: any[] = [];

    if (search) {
      whereClauses.push(
        `(mr.MRName LIKE ? OR mr.EmailId LIKE ? OR mr.MobileNo LIKE ? OR l.Division LIKE ? OR m.Description LIKE ?)`
      );
      const pattern = `%${search}%`;
      whereParams.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let orderSql = `ORDER BY mr.MRName ASC`;
    if (sort === "email_asc") {
      orderSql = `ORDER BY mr.EmailId ASC`;
    } else if (sort === "company_asc") {
      orderSql = `ORDER BY m.Description ASC, mr.MRName ASC`;
    }

    // Unpaginated fallback if limit not provided
    if (!rawLimit || isNaN(rawLimit) || rawLimit <= 0) {
      const sql = `SELECT ${SELECT_MKT_MR_COLUMNS} ${FROM_JOIN_SQL} ${whereSql} ${orderSql}`;
      const [rows] = await dbPool.query(sql, whereParams);
      const results = ((rows as any[]) || []).map(normalizeLegacyMR);
      res.json({ success: true, data: results });
      return;
    }

    // Paginated flow
    const limit = Math.min(rawLimit, 100);
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);

    const countSql = `SELECT COUNT(*) AS total ${FROM_JOIN_SQL} ${whereSql}`;
    const [countRows] = await dbPool.query(countSql, whereParams);
    const total = Number((countRows as any[])?.[0]?.total || 0);

    const dataSql = `SELECT ${SELECT_MKT_MR_COLUMNS} ${FROM_JOIN_SQL} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`;
    const [rows] = await dbPool.query(dataSql, [...whereParams, limit, offset]);
    const results = ((rows as any[]) || []).map(normalizeLegacyMR);

    res.json({
      success: true,
      data: results,
      total,
      hasMore: offset + limit < total,
      page: Math.floor(offset / limit) + 1,
      limit,
    });
  } catch (error: any) {
    console.error("[Master API] MRs Query Error:", error);
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
