import { Router, Request, Response } from "express";
import { dbPool } from "../db";
import { formatDateToOdbc } from "../utils/dateUtils";
import { formatCompanyCodeParam, resolveCompanyCodeParam } from "../utils/companyCodeUtils";

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

    const compCodeParam = await resolveCompanyCodeParam(conn, companyCode);
    const compNo = req.body?.compNo ?? 11;
    const locParam = locNo ? `('${locNo}')` : "('11')";

    const formattedParams = [
      compNo,
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

    res.json({ success: true, data: reportData, debugSql: sql });
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

    const compNo = params.compNo ?? 11;
    const locNoParam = params.locNo ? `('${params.locNo}')` : "('11')";
    const finYear = params.finYear || 202627;

    const fromDateStr = params.fromDate || "2026-04-01";
    const toDateStr = params.toDate || new Date().toISOString().slice(0, 10);
    const odbcFromDate = formatDateToOdbc(fromDateStr);
    const odbcToDate = formatDateToOdbc(toDateStr);

    const compCodeParam = await resolveCompanyCodeParam(conn, params.compCode);
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

    res.json({ success: true, data: rows || [], debugSql: sql });
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
 * Expected arguments: 11
 * 1: p_CmpNo (INT)
 * 2: p_LocNo (MEDIUMTEXT) e.g. "('11')"
 * 3: p_YearNo (INT) e.g. 202627
 * 4: p_FromDt (DATE) e.g. {d '2026-04-01'}
 * 5: p_ToDt (DATE) e.g. {d '2026-09-30'}
 * 6: p_CustIds (LONGTEXT) e.g. ''
 * 7: p_CompCode (LONGTEXT) e.g. "('SEE')"
 * 8: p_Div (LONGTEXT) e.g. ''
 * 9: p_ItemIds (LONGTEXT) e.g. ''
 * 10: p_IsChallan (CHAR(10)) e.g. 'Y'
 * 11: p_SeriesIds (LONGTEXT) e.g. ''
 */
reportsRouter.post("/party-item-sale", async (req: Request, res: Response) => {
  let conn;
  try {
    const params = req.body || {};
    conn = await dbPool.getConnection();
    await conn.query("SET sql_mode = ''");

    const compNo = params.compNo ?? 11;
    const locNo = params.locNo ? `('${params.locNo}')` : "('11')";
    const finYear = params.finYear || 202627;

    const fromDateStr = params.fromDate || "2026-04-01";
    const toDateStr = params.toDate || new Date().toISOString().slice(0, 10);
    const odbcFromDate = formatDateToOdbc(fromDateStr);
    const odbcToDate = formatDateToOdbc(toDateStr);

    const compCodeParam = await resolveCompanyCodeParam(conn, params.compCode);
    const custIdsParam = params.custIds || "";
    const divParam = params.div || "";
    const itemIdsParam = params.itemIds || "";
    const isChallanParam = params.isChallan || "Y";
    const seriesIdsParam = params.seriesIds || "";

    const formattedParams = [
      compNo,
      `'${locNo.replace(/'/g, "''")}'`,
      finYear,
      odbcFromDate,
      odbcToDate,
      `'${custIdsParam.replace(/'/g, "''")}'`,
      `'${compCodeParam.replace(/'/g, "''")}'`,
      `'${divParam.replace(/'/g, "''")}'`,
      `'${itemIdsParam.replace(/'/g, "''")}'`,
      `'${isChallanParam.replace(/'/g, "''")}'`,
      `'${seriesIdsParam.replace(/'/g, "''")}'`,
    ].join(", ");

    const sql = `CALL \`pdyasvtrans\`.\`rptCompanyCustomerItemwiseSales\`(${formattedParams})`;
    const [callRes] = await conn.query(sql);
    const rows = Array.isArray(callRes) ? callRes[0] : callRes;

    res.json({ success: true, data: rows || [], debugSql: sql });
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

    const compNo = params.compNo ?? 11;
    const locNo = Number(params.locNo) || 11;
    const finYear = params.finYear || 202627;

    const finYearStart = "2026-04-01";
    const fromDateStr = params.fromDate || finYearStart;
    const toDateStr = params.toDate || new Date().toISOString().slice(0, 10);
    const odbcFinYearStart = formatDateToOdbc(finYearStart);
    const odbcFromDate = formatDateToOdbc(fromDateStr);
    const odbcToDate = formatDateToOdbc(toDateStr);

    const cityParam = params.city || "";
    const areaParam = params.area || "";
    const custTypeParam = params.custType || "All";
    const custIdsParam = params.custIds || "";
    const seriesIdsParam = params.seriesIds || "";
    const compCodeParam = await resolveCompanyCodeParam(conn, params.compCode);
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

    res.json({ success: true, data: rows || [], debugSql: sql });
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
    const uniqueCode =
      params.uniqueCode ||
      `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
      const compCodeParam = await resolveCompanyCodeParam(conn, params.compCode);

      // Clean existing rows for this uniqueCode before populating
      await conn.query("DELETE FROM `pdyasvtrans`.`claimdata` WHERE `UniqueCode` = ?", [uniqueCode]);

      const prepSql =
        "CALL `pdyasvtrans`.`rptSaleFreeQtyStatement`(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const prepParams = [
        params.isFC || "F",
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

    const sql = "CALL `pdyasvtrans`.`rptClaimData`(?)";
    const [callRes] = await conn.query(sql, [uniqueCode]);
    const rows = Array.isArray(callRes) ? callRes[0] : callRes;

    // Purge temporary claimdata rows after retrieval to keep database lean
    try {
      await conn.query("DELETE FROM `pdyasvtrans`.`claimdata` WHERE `UniqueCode` = ?", [uniqueCode]);
    } catch (_) {
      // non-blocking cleanup
    }

    res.json({
      success: true,
      data: rows || [],
      debugSql: `CALL \`pdyasvtrans\`.\`rptClaimData\`('${uniqueCode}')`,
    });
  } catch (error: any) {
    console.error("[Reports API] Claim Data Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to load claim data" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * 5. Developer Read-Only Procedure Sandbox & Benchmark
 */
reportsRouter.post("/dev-procedure-sandbox", async (req: Request, res: Response) => {
  let conn;
  let sql = "";
  const start = Date.now();
  try {
    const { procedureName, params = {} } = req.body || {};
    const allowedProcedures = [
      "rptStockMovementStatement",
      "rptItemCustomerSale",
      "rptMRwisePeriodicalOutstanding",
      "rptCompanyCustomerItemwiseSales",
    ];

    if (!allowedProcedures.includes(procedureName)) {
      res.status(400).json({
        success: false,
        error: `Procedure not allowed. Allowed procedures: ${allowedProcedures.join(", ")}`,
      });
      return;
    }

    conn = await dbPool.getConnection();
    await conn.query("SET sql_mode = ''");

    sql = "";
    const compCodeParam = await resolveCompanyCodeParam(conn, params.companyCode || "");
    const odbcFrom = formatDateToOdbc(params.fromDate || "2026-04-01");
    const odbcTo = formatDateToOdbc(params.toDate || new Date().toISOString().slice(0, 10));
    const locParam = params.locNo ? `('${params.locNo}')` : "('11')";

    if (procedureName === "rptStockMovementStatement") {
      const formattedParams = [
        params.compNo ?? 11,
        `'${locParam.replace(/'/g, "''")}'`,
        202627,
        formatDateToOdbc("2026-04-01"),
        odbcFrom,
        odbcTo,
        `'${compCodeParam.replace(/'/g, "''")}'`,
        "''",
        "''",
        "'PRate'",
      ].join(", ");
      sql = `CALL \`pdyasvtrans\`.\`rptStockMovementStatement\`(${formattedParams})`;
    } else if (procedureName === "rptItemCustomerSale") {
      const formattedParams = [
        odbcFrom,
        odbcTo,
        params.compNo ?? 11,
        `'${locParam.replace(/'/g, "''")}'`,
        202627,
        "''",
        "''",
        "''",
        `'${compCodeParam.replace(/'/g, "''")}'`,
        "''",
        "'Y'",
        "''",
        "''",
        `'${locParam.replace(/'/g, "''")}'`,
        "'SalesEntry'",
        "''",
      ].join(", ");
      sql = `CALL \`pdyasvtrans\`.\`rptItemCustomerSale\`(${formattedParams})`;
    } else if (procedureName === "rptMRwisePeriodicalOutstanding") {
      const formattedParams = [
        params.compNo ?? 11,
        Number(params.locNo) || 11,
        202627,
        formatDateToOdbc("2026-04-01"),
        odbcFrom,
        odbcTo,
        "''",
        "''",
        "'All'",
        "''",
        "''",
        `'${compCodeParam.replace(/'/g, "''")}'`,
        "''",
        "''",
        "''",
      ].join(", ");
      sql = `CALL \`rptMRwisePeriodicalOutstanding\`(${formattedParams})`;
    } else if (procedureName === "rptCompanyCustomerItemwiseSales") {
      const formattedParams = [
        params.compNo ?? 11,
        `'${locParam.replace(/'/g, "''")}'`,
        202627,
        odbcFrom,
        odbcTo,
        "''",
        `'${compCodeParam.replace(/'/g, "''")}'`,
        "''",
        "''",
        "'Y'",
        "''",
      ].join(", ");
      sql = `CALL \`pdyasvtrans\`.\`rptCompanyCustomerItemwiseSales\`(${formattedParams})`;
    }

    const [rows, fields] = await conn.query(sql);
    const durationMs = Date.now() - start;
    const resultRows = Array.isArray(rows) && Array.isArray((rows as any)[0]) ? (rows as any)[0] : (rows as any) || [];
    const columns = Array.isArray(resultRows) && resultRows.length > 0 ? Object.keys(resultRows[0]) : [];
    const fullDebugSql = `SET sql_mode = '';\n${sql};`;

    res.json({
      success: true,
      procedureName,
      durationMs,
      rowCount: resultRows.length,
      columns,
      sampleRows: resultRows.slice(0, 50),
      debugSql: fullDebugSql,
      data: {
        procedureName,
        durationMs,
        rowCount: resultRows.length,
        columns,
        sampleRows: resultRows.slice(0, 50),
        debugSql: fullDebugSql,
      },
    });
  } catch (error: any) {
    const durationMs = Date.now() - start;
    console.error("[Reports API Sandbox Error]:", error);
    const fullDebugSql = sql ? `SET sql_mode = '';\n${sql};` : "";
    res.status(500).json({
      success: false,
      error: error.message || "Procedure execution failed",
      durationMs,
      debugSql: fullDebugSql,
    });
  } finally {
    if (conn) conn.release();
  }
});

