"use server";

import { legacyDb } from "@/lib/legacy-db";

export interface StockMovementRow {
	ItemId: number;
	ItemName: string;
	Packing: string;
	MktById: number;
	Make: string;
	DivisionID: number;
	Division: string;
	Opening: string | number;
	Purchase: string | number;
	SReturn: string | number;
	StkAdjAdd: string | number;
	SalesQty: string | number;
	PReturn: string | number;
	StkAdjLess: string | number;
	Qty: string | number;
	Prate: string | number;
	PTR: string | number;
	MRP: string | number;
	Days: number;
	BatchNo?: string;
}

function formatDateToOdbc(dateStr?: string): string {
	if (!dateStr) return "{d '2026-04-01'}";
	const trimmed = dateStr.trim();
	if (trimmed.startsWith("{d") && trimmed.endsWith("}")) return trimmed;
	const d = new Date(trimmed);
	if (isNaN(d.getTime())) return "{d '2026-04-01'}";
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `{d '${year}-${month}-${day}'}`;
}

export type StockMovementResult =
	| { success: true; data: StockMovementRow[]; debugSql?: string }
	| { success: false; error: string; data?: null; debugSql?: string };

export async function getStockMovement(
	companyCode?: string | string[],
	fromDate?: string,
	toDate?: string,
	locNo?: string,
): Promise<StockMovementResult> {
	let conn;
	let debugSql = "";
	try {
		conn = await legacyDb.getConnection();
		await conn.query("SET sql_mode = ''");

		const finYearStart = "2026-04-01";
		const effectiveFrom = fromDate || finYearStart;
		const effectiveTo = toDate || new Date().toISOString().slice(0, 10);
		const odbcFinYearStart = formatDateToOdbc(finYearStart);
		const odbcFromDate = formatDateToOdbc(effectiveFrom);
		const odbcToDate = formatDateToOdbc(effectiveTo);
		const locationParam = locNo ? `('${locNo}')` : "('11')";

		let compCodeParam = "";
		if (Array.isArray(companyCode)) {
			const valid = companyCode.map((c) => c?.trim()).filter(Boolean);
			if (valid.length > 0) {
				compCodeParam = valid.map((c) => `('${c}')`).join(",");
			}
		} else if (
			typeof companyCode === "string" &&
			companyCode.trim() &&
			companyCode !== "All"
		) {
			const trimmed = companyCode.trim();
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

		const formattedParams = [
			11,
			`'${locationParam.replace(/'/g, "''")}'`,
			202627,
			odbcFinYearStart,
			odbcFromDate,
			odbcToDate,
			`'${compCodeParam.replace(/'/g, "''")}'`,
			"''",
			"''",
			"'PRate'",
		].join(", ");

		debugSql = `CALL \`pdyasvtrans\`.\`rptStockMovementStatement\`(${formattedParams})`;

		console.log("\n=======================================================");
		console.log("[DEBUG QUERY] Final SQL Query being executed:\n", debugSql);
		console.log("=======================================================\n");

		const [rows] = await conn.query(debugSql);
		const reportData = ((rows as any)?.[0] || []) as StockMovementRow[];

		return { success: true, data: reportData, debugSql };
	} catch (error: any) {
		console.error("Stock Movement Procedure Failed:", error);
		return {
			success: false,
			error: error.message || "Failed to generate stock report",
			debugSql,
		};
	} finally {
		if (conn) conn.release();
	}
}
