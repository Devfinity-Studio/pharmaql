"use server";

import { apiPost } from "@/lib/api-client";

export interface ExpiryStockRow {
	ID: number;
	MktBy: string;
	Division: string;
	ItemCode: string;
	ItemName: string;
	Packing: string;
	BatchNo: string;
	MRP: number | string;
	PRate: number | string;
	PTR: number | string;
	ExpDt: string | Date;
	Godown: string | number;
	Qty: number | string;
	Rate: number | string;
}

export type ExpiryStockResult =
	| {
			success: true;
			data: ExpiryStockRow[];
			debugSql?: string;
	  }
	| {
			success: false;
			error: string;
			data?: null;
			debugSql?: string;
	  };

export async function getExpiryStockStatement(params: {
	asOnDate?: string;
	toDate?: string;
	asOn?: string;
	compCode?: string | string[];
	div?: string;
	divId?: string | number;
	compNo?: number;
	locNo?: string | number;
	finYear?: number;
	rateType?: "PRate" | "PTR" | "MRP";
	forceRefresh?: boolean;
}): Promise<ExpiryStockResult> {
	const asOnDate =
		params.asOnDate ||
		params.asOn ||
		params.toDate ||
		new Date().toISOString().slice(0, 10);

	const res = await apiPost<ExpiryStockRow[]>(
		"/api/reports/expiry-stock",
		{
			...params,
			asOnDate,
		},
		{ forceRefresh: params.forceRefresh, ttlSeconds: 180 },
	);

	if (!res.success || !res.data) {
		return {
			success: false,
			error: res.error || "Failed to load expiry stock report",
			data: null,
		};
	}

	return {
		success: true,
		data: res.data,
		debugSql: res.debugSql,
	};
}
