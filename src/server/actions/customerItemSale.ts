"use server";

import { legacyDb } from "@/lib/legacy-db";

export interface ItemCustomerSaleRow {
	ID: number;
	InvNo: string;
	InvDt: string | Date;
	CustID: number;
	Customer: string;
	Address?: string;
	City?: string;
	Trans?: string;
	CreatedBy?: string;
	ItemID: number;
	ItemCode: string;
	ItemName: string;
	Packing: string;
	BatchNo: string;
	ExpDt?: string | Date;
	Qty: number;
	FQty: number;
	PTR: string | number;
	Srate: string | number;
	IAmt: string | number;
	Godown?: string;
	ReturnType?: string;
	DocType: string;
	SeriesID?: number;
	Series?: string;
	SNC?: string;
	Remarks?: string;
}

export type ItemCustomerSaleResult =
	| { success: true; data: ItemCustomerSaleRow[]; debugSql?: string }
	| { success: false; error: string; data?: null; debugSql?: string };

/**
 * Execute stored procedure `rptItemCustomerSale` from pdyasvtrans
 * Syntax:
 * CALL `rptItemCustomerSale`(p_FromDate, p_ToDate, p_CompNo, p_LocNo, p_FinYear, p_CustIds, p_CityIds, p_ItemIds, p_CompCode, p_Div, p_IncludeZero, p_SalesmanIds, p_ReturnType, p_SeriesIds, p_ReportType, p_Remarks)
 */
function formatDateToOdbc(dateStr: string): string {
	if (!dateStr) return "''";
	const trimmed = dateStr.trim();
	if (trimmed.startsWith("{d") && trimmed.endsWith("}")) {
		return trimmed;
	}
	const match = trimmed.match(/\d{4}-\d{2}-\d{2}/);
	const ymd = match ? match[0] : trimmed;
	return `{d '${ymd}'}`;
}

export async function getItemCustomerSale(params: {
	fromDate: string;
	toDate: string;
	compNo?: number;
	locNo?: string;
	finYear?: number;
	custIds?: string;
	itemIds?: string;
	salesmanIds?: string;
	compCode?: string | string[];
	div?: string;
	includeZero?: string;
	returnType?: string;
	seriesIds?: string;
	location?: string;
	reportType?: string;
	city?: string;
}): Promise<ItemCustomerSaleResult> {
	let conn;
	let debugSql = "";
	try {
		conn = await legacyDb.getConnection();
		await conn.query("SET sql_mode = ''");

		const odbcFromDate = formatDateToOdbc(params.fromDate);
		const odbcToDate = formatDateToOdbc(params.toDate);
		const compNo = params.compNo ?? 11;
		const locNoParam = params.locNo ? `('${params.locNo}')` : "('11')";
		const finYear = params.finYear ?? 202627;

		let compCodeParam = "";
		if (Array.isArray(params.compCode)) {
			const valid = params.compCode.map((c) => c?.trim()).filter(Boolean);
			if (valid.length > 0) {
				compCodeParam = valid.map((c) => `('${c}')`).join(",");
			}
		} else if (
			typeof params.compCode === "string" &&
			params.compCode.trim() &&
			params.compCode !== "All"
		) {
			const trimmed = params.compCode.trim();
			if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
				compCodeParam = trimmed;
			} else {
				const parts = trimmed
					.split(",")
					.map((p) => p.trim())
					.filter(Boolean);
				compCodeParam = parts.map((p) => `('${p}')`).join(",");
			}
		}

		// Exact parameter order for `rptItemCustomerSale`:
		// 1: p_FromDt (DATE) - formatted as {d 'YYYY-MM-DD'}
		// 2: p_ToDt (DATE)   - formatted as {d 'YYYY-MM-DD'}
		// 3: p_CmpNo (INT)
		// 4: p_LocNo (MEDIUMTEXT) e.g. "('11')"
		// 5: p_YearNo (INT) e.g. 202627
		// 6: p_CustIds (LONGTEXT)
		// 7: p_ItemIds (LONGTEXT)
		// 8: p_SalesmanIds (LONGTEXT)
		// 9: p_CompCode (LONGTEXT) e.g. "('SEE')"
		// 10: p_Div (LONGTEXT)
		// 11: p_IsSalesReturn (CHAR(20)) e.g. 'Y'
		// 12: p_ReturnType (LONGTEXT)
		// 13: p_SeriesIds (LONGTEXT)
		// 14: p_Location (MEDIUMTEXT) e.g. "('11')"
		// 15: p_SalesmanFrom (VARCHAR(30)) e.g. 'SalesEntry'
		// 16: p_City (LONGTEXT)
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
		debugSql = `CALL \`pdyasvtrans\`.\`rptItemCustomerSale\`(${odbcFromDate}, ${odbcToDate}, ${formattedRest})`;

		console.log("\n=======================================================");
		console.log("[TEMP DEBUG] Final SQL Query being executed:\n", debugSql);
		console.log("=======================================================\n");

		const [callRes] = await conn.query(debugSql);
		const rows = (Array.isArray(callRes) ? callRes[0] : callRes) as ItemCustomerSaleRow[];
		return { success: true, data: rows || [], debugSql };
	} catch (error: any) {
		console.error("Failed to execute rptItemCustomerSale:", error);
		return { success: false, error: error.message || "Failed to load sales", debugSql };
	} finally {
		if (conn) conn.release();
	}
}
