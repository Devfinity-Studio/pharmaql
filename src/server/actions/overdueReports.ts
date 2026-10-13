"use server";

import { apiPost } from "@/lib/api-client";

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

export type OverduePeriodicalOutstandingResult =
	| {
			success: true;
			data: OverduePeriodicalOutstandingRow[];
			debugSql?: string;
	  }
	| {
			success: false;
			error: string;
			data?: null;
			debugSql?: string;
	  };

export async function getMRwisePeriodicalOutstanding(params: {
	fromDate?: string;
	toDate?: string;
	compCode?: string | string[];
	mrId?: string | number;
	compNo?: number;
	locNo?: string;
	finYear?: number;
	city?: string;
	area?: string;
	custType?: string;
	custIds?: string;
	seriesIds?: string;
	custGrp?: string;
	divIds?: string;
}): Promise<OverduePeriodicalOutstandingResult> {
	const res = await apiPost<OverduePeriodicalOutstandingRow[]>(
		"/api/reports/mr-overdue",
		params,
	);

	if (!res.success || !res.data) {
		return {
			success: false,
			error: res.error || "Failed to load overdue report",
			data: null,
		};
	}

	return {
		success: true,
		data: res.data,
		debugSql: res.debugSql,
	};
}
