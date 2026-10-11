"use server";

import { apiPost } from "@/lib/api-client";

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
	const res = await apiPost<ClaimDataRow[]>("/api/reports/claim-data", params);

	if (!res.success || !res.data) {
		return {
			success: false,
			error: res.error || "Failed to load claim data",
			data: null,
		};
	}

	return {
		success: true,
		data: res.data,
	};
}
