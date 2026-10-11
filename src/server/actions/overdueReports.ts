"use server";

import { formatCompanyCodeParam } from "@/lib/companyCodeUtils";
import { legacyDb } from "@/lib/legacy-db";

export interface OverduePeriodicalOutstandingRow {
	ID: number;
	DocType: string;
	DocTypeNo: number;
	RefID: number;
	CompNo: number;
	LocNo: number;
	YearNo: number;
	SeriesID: number;
	ActId: number;
	DocNo: string;
	AgainstNo: string;
	DocDate: string | Date;
	Amount: string | number;
	CustID: number;
	CustCode: string;
	Customer: string;
	City: string;
	Area: string;
	Address1: string;
	PartyGroup: string;
	DueDate: string;
	OverDays: number;
	MRID: number;
	MRName: string;
	Remarks: string;
	PostingDt: string | Date | null;
	AdjAmt: string | number;
	RecDate: string;
	RecNo: string;
	RecDocType: string;
	OnAC: number;
	MRMobile: string;
	CompCode: string;
	Division: string;
}

function formatDateToOdbc(
	dateStr?: string,
	defaultDate: string = "2026-04-01",
): string {
	if (!dateStr) return `{d '${defaultDate}'}`;
	const trimmed = dateStr.trim();
	if (trimmed.startsWith("{d") && trimmed.endsWith("}")) return trimmed;
	const d = new Date(trimmed);
	if (isNaN(d.getTime())) return `{d '${defaultDate}'}`;
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `{d '${year}-${month}-${day}'}`;
}

export type OverduePeriodicalOutstandingResult =
	| {
			success: true;
			data: OverduePeriodicalOutstandingRow[];
			debugSql?: string;
	  }
	| { success: false; error: string; data?: null; debugSql?: string };

/**
 * Executes stored procedure `rptMRwisePeriodicalOutstanding` from pdyasvtrans
 * Syntax:
 * CALL `rptMRwisePeriodicalOutstanding`(11, 11, 202627, {d '2026-04-01'}, {d '2026-09-01'}, {d '2026-09-30'}, '', '', 'All', '', '', '(''AASPAN'')', '', '', '(163)')
 */
export async function getMRwisePeriodicalOutstanding(params: {
	mrId?: string | number;
	fromDate?: string;
	toDate?: string;
	finYearStart?: string;
	compNo?: number;
	locNo?: string | number;
	finYear?: number;
	compCode?: string | string[];
	city?: string;
	area?: string;
	custType?: string;
	custIds?: string;
	seriesIds?: string;
	custGrp?: string;
	divIds?: string;
}): Promise<OverduePeriodicalOutstandingResult> {
	let conn;
	let debugSql = "";
	try {
		conn = await legacyDb.getConnection();
		await conn.query("SET sql_mode = ''");

		const compNo = params.compNo ?? 11;
		const locNo = Number(params.locNo) || 11;
		const finYear = params.finYear ?? 202627;
		const odbcFinYearStart = formatDateToOdbc(
			params.finYearStart || "2026-04-01",
			"2026-04-01",
		);
		const odbcFromDate = formatDateToOdbc(
			params.fromDate || "2026-09-01",
			"2026-09-01",
		);
		const odbcToDate = formatDateToOdbc(
			params.toDate || "2026-09-30",
			"2026-09-30",
		);

		const cityParam = params.city || "";
		const areaParam = params.area || "";
		const custTypeParam = params.custType || "All";
		const custIdsParam = params.custIds || "";
		const seriesIdsParam = params.seriesIds || "";
		const compCodeParam = formatCompanyCodeParam(params.compCode);
		const custGrpParam = params.custGrp || "";
		const divIdsParam = params.divIds || "";

		let mrIdParam = "";
		if (
			params.mrId !== undefined &&
			params.mrId !== null &&
			String(params.mrId).trim()
		) {
			const rawMr = String(params.mrId).trim();
			if (rawMr.startsWith("(") && rawMr.endsWith(")")) {
				mrIdParam = rawMr;
			} else {
				mrIdParam = `(${rawMr})`;
			}
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

		debugSql = `CALL \`rptMRwisePeriodicalOutstanding\`(${formattedParams})`;

		const [res] = await conn.query(debugSql);
		const rows = (
			Array.isArray(res) ? res[0] : res
		) as OverduePeriodicalOutstandingRow[];

		return { success: true, data: rows || [], debugSql };
	} catch (error: any) {
		console.error("Failed to execute rptMRwisePeriodicalOutstanding:", error);
		return {
			success: false,
			error: error.message || "Failed to load overdue report",
			data: null,
			debugSql,
		};
	} finally {
		if (conn) conn.release();
	}
}
