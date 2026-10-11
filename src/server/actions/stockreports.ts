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

export type StockMovementResult =
	| { success: true; data: StockMovementRow[] }
	| { success: false; error: string; data?: null };

export async function getStockMovement(
	companyCode?: string | string[],
	fromDate?: string,
	toDate?: string,
	locNo?: string,
): Promise<StockMovementResult> {
	try {
		const finYearStart = "2026-04-01";
		const effectiveFrom = fromDate || finYearStart;
		const effectiveTo = toDate || new Date().toISOString().slice(0, 10);
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
					.map((c) => c.trim())
					.filter(Boolean);
				compCodeParam = parts.map((c) => `('${c}')`).join(",");
			}
		}

		const query = `CALL rptStockMovementStatement(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

		const [rows] = await legacyDb.query(query, [
			11,
			locationParam,
			202627,
			finYearStart,
			effectiveFrom,
			effectiveTo,
			compCodeParam,
			"",
			"",
			"PRate",
		]);

		const reportData = ((rows as any)?.[0] || []) as StockMovementRow[];

		return { success: true, data: reportData };
	} catch (error) {
		console.error("Stock Movement Procedure Failed:", error);
		return { success: false, error: "Failed to generate stock report" };
	}
}
