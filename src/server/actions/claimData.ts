"use server";

import { formatCompanyCodeParam } from "@/lib/companyCodeUtils";
import { legacyDb } from "@/lib/legacy-db";

export interface ClaimDataRow {
	CustCode?: string;
	Customer: string;
	Area?: string;
	City?: string;
	Code?: string;
	Company?: string;
	ItemId?: number;
	ItemCode: string;
	ItemName: string;
	Division?: string;
	Packing?: string;
	InvNo: string;
	InvDt: string | Date;
	BatchNo: string;
	MRP?: string | number;
	PTR?: string | number;
	SRate?: string | number;
	PRate?: string | number;
	Qty: number;
	FreeIAmt?: string | number;
	Scheme?: string;
	Free?: number;
	FQty: number;
	MRName?: string | null;
}

export type ClaimDataResult =
	| { success: true; data: ClaimDataRow[]; debugSql?: string }
	| { success: false; error: string; data?: null; debugSql?: string };

function formatDate(val: string): string {
	const match = val.match(/\d{4}-\d{2}-\d{2}/);
	return match ? match[0] : val.trim();
}

/**
 * Execute claim data query for Claim Qty report.
 * Syntax:
 * CALL `rptClaimData`('c9510231-4a58-4cb0-b40e-8fd18ff5f4ef')
 */
export async function getClaimData(params: {
	uniqueCode?: string;
	fromDate?: string;
	toDate?: string;
	compNo?: number;
	locNo?: string;
	finYear?: number;
	compCode?: string | string[];
	div?: string;
	itemIds?: string;
	custIds?: string;
	rate?: string;
	isChallan?: string;
	includeSRet?: string;
}): Promise<ClaimDataResult> {
	let conn;
	try {
		conn = await legacyDb.getConnection();
		await conn.query("SET sql_mode = ''");

		const uniqueCode = params.uniqueCode || "c9510231-4a58-4cb0-b40e-8fd18ff5f4ef";

		// If date filters are provided, ensure claimdata is populated for this unique code
		if (params.fromDate && params.toDate) {
			const effectiveFrom = formatDate(params.fromDate);
			const effectiveTo = formatDate(params.toDate);
			const compNo = params.compNo ?? 11;
			const locNo = Number(params.locNo) || 11;
			const finYear = params.finYear ?? 202627;

			const compCodeParam = formatCompanyCodeParam(params.compCode);

			const prepSql = "CALL `pdyasvtrans`.`rptSaleFreeQtyStatement`(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
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

		// Exact query syntax requested:
		// CALL `rptClaimData`('c9510231-4a58-4cb0-b40e-8fd18ff5f4ef')
		const debugSql = `CALL \`pdyasvtrans\`.\`rptClaimData\`('${uniqueCode}')`;

		console.log("\n=======================================================");
		console.log("[DEBUG QUERY] Final SQL Query being executed (Claim Qty):\n", debugSql);
		console.log("=======================================================\n");

		const [callRes] = await conn.query(debugSql);
		const rows = (Array.isArray(callRes) ? callRes[0] : callRes) as ClaimDataRow[];
		return { success: true, data: rows || [], debugSql };
	} catch (error: any) {
		console.error("Failed to execute rptClaimData:", error);
		return { success: false, error: error.message || "Failed to load claim data", data: null, debugSql: `CALL \`pdyasvtrans\`.\`rptClaimData\`('${params.uniqueCode || "c9510231-4a58-4cb0-b40e-8fd18ff5f4ef"}')` };
	} finally {
		if (conn) conn.release();
	}
}
