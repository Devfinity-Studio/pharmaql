"use server";

import { apiPost } from "@/lib/api-client";

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
	const res = await apiPost<ItemCustomerSaleRow[]>(
		"/api/reports/customer-item-sale",
		params,
	);

	if (!res.success || !res.data) {
		return {
			success: false,
			error: res.error || "Failed to execute rptItemCustomerSale",
			data: null,
		};
	}

	return {
		success: true,
		data: res.data,
		debugSql: res.debugSql,
	};
}
