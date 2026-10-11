import { Router, Request, Response } from "express";
import { dbPool } from "../db.js";
import { formatDateToOdbc } from "../utils/dateUtils.js";
import { formatCompanyCodeParam } from "../utils/companyCodeUtils.js";

export const reportsRouter = Router();

/**
 * 1. Stock Movement Statement
 * Procedure: rptStockMovementStatement
 */
reportsRouter.post("/stock-movement", async (req: Request, res: Response) => {
  let conn;
  try {
    const { companyCode, fromDate, toDate, locNo } = req.body || {};

    conn = await dbPool.getConnection();
    await conn.query("SET sql_mode = ''");

    const finYearStart = "2026-04-01";
    const effectiveFrom = fromDate || finYearStart;
    const effectiveTo = toDate || new Date().toISOString().slice(0, 10);
    const odbcFinYearStart = formatDateToOdbc(finYearStart);
    const odbcFromDate = formatDateToOdbc(effectiveFrom);
    const odbcToDate = formatDateToOdbc(effectiveTo);

    const compCodeParam = formatCompanyCodeParam(companyCode);
    const locParam = locNo ? `('${locNo}')` : "('11')";

    const formattedParams = [
      1,
      `'${locParam.replace(/'/g, "''")}'`,
      202627,
      odbcFinYearStart,
      odbcFromDate,
      odbcToDate,
      `'${compCodeParam.replace(/'/g, "''")}'`,
      "''",
      "''",
      "'PRate'",
    ].join(", ");

    const sql = `CALL \`pdyasvtrans\`.\`rptStockMovementStatement\`(${formattedParams})`;
    const [rows] = await conn.query(sql);
    const reportData = ((rows as any)?.[0] || []);

    res.json({ success: true, data: reportData });
  } catch (error: any) {
    console.error("[Reports API] Stock Movement Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate stock report" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * 2. Item Customer Sales
 * Procedure: rptItemCustomerSale
 */
reportsRouter.post("/customer-item-sale", async (req: Request, res: Response) => {
  let conn;
  try {
    const params = req.body || {};
    conn = await dbPool.getConnection();
    await conn.query("SET sql_mode = ''");

    const compNo = params.compNo || 1;
    const locNoParam = params.locNo ? `('${params.locNo}')` : "('11')";
    const finYear = params.finYear || 202627;

    const fromDateStr = params.fromDate || "2026-04-01";
    const toDateStr = params.toDate || new Date().toISOString().slice(0, 10);
    const odbcFromDate = formatDateToOdbc(fromDateStr);
    const odbcToDate = formatDateToOdbc(toDateStr);

    const compCodeParam = formatCompanyCodeParam(params.compCode);
    const custIdsParam = params.custIds || "";
    const itemIdsParam = params.itemIds || "";
    const salesmanIdsParam = params.salesmanIds || "";
    const divParam = params.div || "";
    const includeZero = params.includeZero || "Y";
    const returnTypeParam = params.returnType || "";
    const seriesIdsParam = params.seriesIds || "";
    const locationParam = params.location ? `('${params.location}')` : locNoParam;
    const reportTypeParam = params.reportType || "SalesEntry";
    const cityParam = params.city || "";

    const callParams = [
      compNo,
      locNoParam,
      finYear,
      custIdsParam,
      itemIdsParam,
      salesmanIdsParam,
      compCodeParam,
      divParam,
      includeZero,
      returnTypeParam,
      seriesIdsParam,
      locationParam,
      reportTypeParam,
      cityParam,
    ];

    const formattedRest = callParams
      .map((p) => {
        if (typeof p === "number") return String(p);
        return `'${String(p).replace(/'/g, "''")}'`;
      })
      .join(", ");

    const sql = `CALL \`pdyasvtrans\`.\`rptItemCustomerSale\`(${odbcFromDate}, ${odbcToDate}, ${formattedRest})`;
    const [callRes] = await conn.query(sql);
    const rows = Array.isArray(callRes) ? callRes[0] : callRes;

    res.json({ success: true, data: rows || [] });
  } catch (error: any) {
    console.error("[Reports API] Customer Item Sale Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to execute rptItemCustomerSale" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * 3. Party Customer Itemwise Sales
 * Procedure: rptCompanyCustomerItemwiseSales
 */
reportsRouter.post("/party-item-sale", async (req: Request, res: Response) => {
  let conn;
  try {
    const params = req.body || {};
    conn = await dbPool.getConnection();
    await conn.query("SET sql_mode = ''");

    const compNo = params.compNo || 1;
    const locNo = params.locNo ? `('${params.locNo}')` : "('11')";
    const finYear = params.finYear || 202627;

    const fromDateStr = params.fromDate || "2026-04-01";
    const toDateStr = params.toDate || new Date().toISOString().slice(0, 10);
    const odbcFromDate = formatDateToOdbc(fromDateStr);
    const odbcToDate = formatDateToOdbc(toDateStr);

    const compCodeParam = formatCompanyCodeParam(params.compCode);
    const custIdsParam = params.custIds || "";
    const salesmanIdsParam = params.salesmanIds || "";
    const cityParam = params.city || "";
    const divParam = params.div || "";
    const itemIdsParam = params.itemIds || "";
    const isChallanParam = params.isChallan || "";
    const seriesIdsParam = params.seriesIds || "";

    const formattedParams = [
      compNo,
      `'${locNo.replace(/'/g, "''")}'`,
      finYear,
      odbcFromDate,
      odbcToDate,
      `'${compCodeParam.replace(/'/g, "''")}'`,
      `'${custIdsParam.replace(/'/g, "''")}'`,
      `'${salesmanIdsParam.replace(/'/g, "''")}'`,
      `'${cityParam.replace(/'/g, "''")}'`,
      `'${divParam.replace(/'/g, "''")}'`,
      `'${itemIdsParam.replace(/'/g, "''")}'`,
      `'${isChallanParam.replace(/'/g, "''")}'`,
      `'${seriesIdsParam.replace(/'/g, "''")}'`,
    ].join(", ");

    const sql = `CALL \`pdyasvtrans\`.\`rptCompanyCustomerItemwiseSales\`(${formattedParams})`;
    const [callRes] = await conn.query(sql);
    const rows = Array.isArray(callRes) ? callRes[0] : callRes;

    res.json({ success: true, data: rows || [] });
  } catch (error: any) {
    console.error("[Reports API] Party Item Sale Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to execute rptCompanyCustomerItemwiseSales" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * 4. MR Wise Periodical Outstanding
 * Procedure: rptMRwisePeriodicalOutstanding
 */
reportsRouter.post("/mr-overdue", async (req: Request, res: Response) => {
  let conn;
  try {
    const params = req.body || {};
    conn = await dbPool.getConnection();
    await conn.query("SET sql_mode = ''");

    const compNo = params.compNo || 1;
    const locNo = params.locNo ? `('${params.locNo}')` : "('11')";
    const finYear = params.finYear || 202627;

    const finYearStart = "2026-04-01";
    const fromDateStr = params.fromDate || finYearStart;
    const toDateStr = params.toDate || new Date().toISOString().slice(0, 10);
    const odbcFinYearStart = formatDateToOdbc(finYearStart);
    const odbcFromDate = formatDateToOdbc(fromDateStr);
    const odbcToDate = formatDateToOdbc(toDateStr);

    const cityParam = params.city || "";
    const areaParam = params.area || "";
    const custTypeParam = params.custType || "";
    const custIdsParam = params.custIds || "";
    const seriesIdsParam = params.seriesIds || "";
    const compCodeParam = formatCompanyCodeParam(params.compCode);
    const custGrpParam = params.custGrp || "";
    const divIdsParam = params.divIds || "";

    let mrIdParam = "";
    if (params.mrId !== undefined && params.mrId !== null && String(params.mrId).trim()) {
      const rawMr = String(params.mrId).trim();
      mrIdParam = rawMr.startsWith("(") && rawMr.endsWith(")") ? rawMr : `(${rawMr})`;
    }

    const formattedParams = [
      compNo,
      locNo,
      finYear,
      odbcFinYearStart,
      odbcFromDate,
      odbcToDate,
      `'${cityParam.replace(/'/g, "''")}'`,
      `'${areaParam.replace(/'/g, "''")}'`,
      `'${custTypeParam.replace(/'/g, "''")}'`,
      `'${custIdsParam.replace(/'/g, "''")}'`,
      `'${seriesIdsParam.replace(/'/g, "''")}'`,
      `'${compCodeParam.replace(/'/g, "''")}'`,
      `'${custGrpParam.replace(/'/g, "''")}'`,
      `'${divIdsParam.replace(/'/g, "''")}'`,
      `'${mrIdParam.replace(/'/g, "''")}'`,
    ].join(", ");

    const sql = `CALL \`rptMRwisePeriodicalOutstanding\`(${formattedParams})`;
    const [resData] = await conn.query(sql);
    const rows = Array.isArray(resData) ? resData[0] : resData;

    res.json({ success: true, data: rows || [] });
  } catch (error: any) {
    console.error("[Reports API] Overdue Report Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to load overdue report" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * 5. Free Scheme / Claim Data
 * Procedure: rptClaimData
 */
reportsRouter.post("/claim-data", async (req: Request, res: Response) => {
  let conn;
  try {
    const params = req.body || {};
    const uniqueCode = params.uniqueCode || "c9510231-4a58-4cb0-b40e-8fd18ff5f4ef";

    conn = await dbPool.getConnection();
    await conn.query("SET sql_mode = ''");

    if (params.fromDate && params.toDate) {
      const matchFrom = String(params.fromDate).match(/\d{4}-\d{2}-\d{2}/);
      const effectiveFrom = matchFrom ? matchFrom[0] : String(params.fromDate).trim();
      const matchTo = String(params.toDate).match(/\d{4}-\d{2}-\d{2}/);
      const effectiveTo = matchTo ? matchTo[0] : String(params.toDate).trim();
      const compNo = params.compNo ?? 11;
      const locNo = Number(params.locNo) || 11;
      const finYear = params.finYear ?? 202627;
      const compCodeParam = formatCompanyCodeParam(params.compCode);

      const prepSql =
        "CALL `pdyasvtrans`.`rptSaleFreeQtyStatement`(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const prepParams = [
        "F",
        effectiveFrom,
        effectiveTo,
        compNo,
        locNo,
        finYear,
        compCodeParam,
        params.div || "",
        params.itemIds || "",
        params.custIds || "",
        params.rate || "SRate",
        uniqueCode,
        params.isChallan || "Y",
        params.includeSRet || "Y",
      ];
      await conn.query(prepSql, prepParams);
    }

    const sql = `CALL \`pdyasvtrans\`.\`rptClaimData\`('${uniqueCode}')`;
    const [callRes] = await conn.query(sql);
    const rows = Array.isArray(callRes) ? callRes[0] : callRes;

    res.json({ success: true, data: rows || [] });
  } catch (error: any) {
    console.error("[Reports API] Claim Data Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to load claim data" });
  } finally {
    if (conn) conn.release();
  }
});
