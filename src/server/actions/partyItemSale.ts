"use server";

import { apiPost } from "@/lib/api-client";

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

export async function getCompanyCustomerItemwiseSales(params: {
	fromDate: string;
	toDate: string;
	compNo?: number;
	locNo?: string;
	finYear?: number;
	compCode?: string | string[];
	custIds?: string;
	salesmanIds?: string;
	city?: string;
	div?: string;
	itemIds?: string;
	isChallan?: string;
	seriesIds?: string;
}): Promise<PartyCustomerItemSaleResult> {
	const res = await apiPost<PartyCustomerItemSaleRow[]>(
		"/api/reports/party-item-sale",
		params,
	);

	if (!res.success || !res.data) {
		return {
			success: false,
			error: res.error || "Failed to execute rptCompanyCustomerItemwiseSales",
			data: null,
		};
	}

	return {
		success: true,
		data: res.data,
		debugSql: res.debugSql,
	};
}

export async function getPartyCustomerItemSale(payload: Parameters<typeof getCompanyCustomerItemwiseSales>[0]) {
	return getCompanyCustomerItemwiseSales(payload);
}
