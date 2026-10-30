"use server";

import { apiPost } from "@/lib/api-client";

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
	| { success: true; data: StockMovementRow[]; debugSql?: string }
	| { success: false; error: string; data?: null; debugSql?: string };

export async function getStockMovement(
	companyCode?: string | string[],
	fromDate?: string,
	toDate?: string,
	locNo?: string,
	forceRefresh?: boolean,
): Promise<StockMovementResult> {
	const res = await apiPost<StockMovementRow[]>(
		"/api/reports/stock-movement",
		{
			companyCode,
			fromDate,
			toDate,
			locNo,
			forceRefresh,
		},
		{ forceRefresh, ttlSeconds: 180 },
	);

	if (!res.success || !res.data) {
		return {
			success: false,
			error: res.error || "Failed to generate stock report",
			data: null,
		};
	}

	return {
		success: true,
		data: res.data,
		debugSql: res.debugSql,
	};
}
