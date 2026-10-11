"use server";

import { legacyDb } from "@/lib/legacy-db";

export interface PartyCustomerItemSaleRow {
	City?: string;
	CustCode?: string;
	CustIds?: string;
	CustID: number;
	Customer: string;
	Address?: string;
	Area?: string;
	MktByID?: string;
	MktBy?: string;
	DivisionId?: string;
	Division?: string;
	ItemID: number;
	ItemCode: string;
	ItemName: string;
	Packing: string;
	BatchNo: string;
	Qty: number;
	SNC?: string;
	FQty: number;
	Srate: string | number;
	PTR?: string | number;
	PRate?: string | number;
	Amt: string | number;
	InvDt: string | Date;
	InvNo: string;
	SeriesID?: number;
	Series?: string;
	Location?: string;
	Remarks?: string;
	ExpDt?: string | Date;
	MRP?: string | number;
	GSTAmt?: string | number;
}

export type PartyCustomerItemSaleResult =
	| { success: true; data: PartyCustomerItemSaleRow[]; debugSql?: string }
	| { success: false; error: string; data?: null; debugSql?: string };

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

/**
 * Execute stored procedure `rptCompanyCustomerItemwiseSales` from pdyasvtrans
 * Syntax:
 * CALL `rptCompanyCustomerItemwiseSales`(11, '(''11'')', 202627, {d '2026-09-01'}, {d '2026-09-29'}, '', '(''SEE'')', '', '', 'Y', '')
 *
 * Parameters:
 * 1: p_CmpNo (INT)
 * 2: p_LocNo (MEDIUMTEXT) e.g. "('11')"
 * 3: p_YearNo (INT) e.g. 202627
 * 4: p_FromDt (DATE) e.g. {d '2026-09-01'}
 * 5: p_ToDt (DATE) e.g. {d '2026-09-29'}
 * 6: p_CustIds (LONGTEXT) e.g. ''
 * 7: p_CompCode (LONGTEXT) e.g. "('SEE')"
 * 8: p_Div (LONGTEXT) e.g. ''
 * 9: p_ItemIds (LONGTEXT) e.g. ''
 * 10: p_IsChallan (CHAR(10)) e.g. 'Y'
 * 11: p_SeriesIds (LONGTEXT) e.g. ''
 */
export async function getPartyCustomerItemSale(params: {
	fromDate: string;
	toDate: string;
	compNo?: number;
	locNo?: string;
	finYear?: number;
	custIds?: string;
	compCode?: string | string[];
	div?: string;
	itemIds?: string;
	isChallan?: string;
	seriesIds?: string;
}): Promise<PartyCustomerItemSaleResult> {
	let conn;
	let debugSql = "";
	try {
		conn = await legacyDb.getConnection();
		await conn.query("SET sql_mode = ''");

		const compNo = params.compNo ?? 11;
		const locNoParam = params.locNo ? `('${params.locNo}')` : "('11')";
		const finYear = params.finYear ?? 202627;
		const odbcFromDate = formatDateToOdbc(params.fromDate);
		const odbcToDate = formatDateToOdbc(params.toDate);
		const custIdsParam = params.custIds || "";

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

		const divParam = params.div || "";
		const itemIdsParam = params.itemIds || "";
		const isChallanParam = params.isChallan || "Y";
		const seriesIdsParam = params.seriesIds || "";

		const formattedParams = [
			compNo,
			`'${locNoParam.replace(/'/g, "''")}'`,
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

		debugSql = `CALL \`pdyasvtrans\`.\`rptCompanyCustomerItemwiseSales\`(${formattedParams})`;

		const [callRes] = await conn.query(debugSql);
		const rows = (Array.isArray(callRes) ? callRes[0] : callRes) as PartyCustomerItemSaleRow[];
		return { success: true, data: rows || [], debugSql };
	} catch (error: any) {
		console.error("Failed to execute rptCompanyCustomerItemwiseSales:", error);
		return { success: false, error: error.message || "Failed to load party sales", debugSql };
	} finally {
		if (conn) conn.release();
	}
}
