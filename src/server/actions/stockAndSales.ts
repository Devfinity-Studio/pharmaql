"use server";

import { apiPost } from "@/lib/api-client";

export interface StockAndSalesRow {
	ItemId?: number;
	ItemID?: number;
	ItemCode?: string;
	ItemName: string;
	Pack?: string;
	Packing?: string;
	MktByID?: number;
	MktBy?: string;
	Division?: string;
	CompanyName?: string;
	CompanyCode?: string;
	BatchNo?: string;
	ExpDt?: string | Date;
	MRP?: number | string;
	PTR?: number | string;
	PRate?: number | string;
	Rate?: number | string;
	Srate?: number | string;
	OpenQty?: number | string;
	OpQty?: number | string;
	OpeningQty?: number | string;
	PQty?: number | string;
	PFQty?: number | string;
	RecQty?: number | string;
	PurQty?: number | string;
	PurchaseQty?: number | string;
	SQty?: number | string;
	SaleQty?: number | string;
	SalesQty?: number | string;
	SFQty?: number | string;
	FreeQty?: number | string;
	OSQty?: number | string;
	SRetQty?: number | string;
	PRetQty?: number | string;
	CurrStck?: number | string;
	BalQty?: number | string;
	ClosingQty?: number | string;
	OpVal?: number | string;
	SaleVal?: number | string;
	SalesValue?: number | string;
	BalVal?: number | string;
	ClosingValue?: number | string;
	[key: string]: any;
}

export type StockAndSalesResult =
	| { success: true; data: StockAndSalesRow[]; debugSql?: string }
	| { success: false; error: string; data?: null; debugSql?: string };

/**
 * Fetch Stock & Sales Statement report from database via stored procedure:
 * CALL `rptStockandSalesStatementReport`(11, '(''11'')', {d '2026-10-01'}, {d '2026-10-19'}, '(''AASPAN'')', '', '', '', 'N', 'Y')
 */
export async function getStockAndSales(params: {
	fromDate?: string;
	toDate?: string;
	compNo?: number;
	locNo?: string;
	compCode?: string | string[];
	divId?: number;
	div?: string;
	itemIds?: string;
	itemCategory?: string;
	includeBr?: string;
	showFree?: string;
}): Promise<StockAndSalesResult> {
	const res = await apiPost<StockAndSalesRow[]>("/api/reports/stock-and-sales", {
		...params,
		companyCode: params.compCode,
	});

	if (!res.success || !res.data) {
		return {
			success: false,
			error: res.error || "Failed to load Stock & Sales statement report",
			data: null,
			debugSql: res.debugSql,
		};
	}

	return {
		success: true,
		data: res.data,
		debugSql: res.debugSql,
	};
}
