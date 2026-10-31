"use server";

import { apiGet } from "@/lib/api-client";

export interface ItemCatalogRow {
	ID: number;
	AWACSCode: string;
	SeriesID: number;
	ItemCode: string;
	ItemName: string;
	PrintName: string;
	Packing: string;
	BaseUnit: string;
	PurcUnit: string;
	QtyPerPurcUnit: number;
	MktByID: number;
	MktBy: string;
	MfgByID: number;
	DivisionId: number;
	Division: string;
	AllowInvDisc: number;
	DiscPer: number;
	MinNetQty: number;
	MultipleOfQty: number;
	MinSaleQty: number;
	AllowSLRT: number;
	AllowChangePTR: number;
	IncSS: number;
	ItemCatgID: number;
	ItemCategory: string;
	IsColdChain: number;
	ItemGroup: string;
	MISRate: number;
	HSN: string;
	TaxGrpCode: string;
	GeneralTaxP: number;
	CompNo: number;
	Initial: string;
	Notes: string;
	Remark: string;
	ItemUnder: string;
	shortIname: string;
	AllowSALE: number;
	VendorRefICode: string;
	AllowBranchTrans: number;
	Block: number;
	CNQty: number;
	CNFree: number;
	CreatedBy: string;
	CreatedDate: Date;
	EditedBy: string;
	EditedDate: Date;
	RowVersion: string;
	PriQty: number;
	PriContains: number;
	PriContainsUnit: string;
	PerBoxPri: number;
	PerTerPri: number;
	EffectInward: number;
	LBatchNo: string;
	LPrate: number;
	LPTR: number;
	LMRP: number;
	LExpDt: Date;
	PTRMarginP: number;
	PRateMarginP: number;
	InActive: number;
	IsUpdated: number;
	DropPTR: number;
	ItemMainCategory: string;
	ItemSubCategory: string;
	LMfgBy: string;
	AllowExpiry: number;
	OldTaxGrpCode: string;
	OldLMRP: number;
	SchMinQty: number;
}

/**
 * Query item catalog from API server
 */
export async function getItemCatalog(options?: {
	division?: string;
	company?: string;
	limit?: number;
	offset?: number;
	search?: string;
}): Promise<ItemCatalogRow[]> {
	const res = await apiGet<ItemCatalogRow[]>(
		"/api/master/catalog",
		{
			division: options?.division,
			company: options?.company,
			search: options?.search,
			limit: options?.limit,
			offset: options?.offset,
		},
		{ ttlSeconds: 600 },
	);

	if (!res.success || !res.data) {
		return [];
	}

	return res.data;
}

export async function getProductCatalog(options?: {
	mktBy?: string;
	division?: string;
	search?: string;
}): Promise<{ success: boolean; data: ItemCatalogRow[] }> {
	const data = await getItemCatalog({
		division: options?.division || options?.mktBy,
		search: options?.search,
	});
	return { success: true, data };
}

import { getStockMovement } from "./stockreports";

/**
 * Builds an Item-to-Division mapping dictionary for a company / assigned codes.
 * Maps ItemName and ItemId (all normalized uppercase) to the exact Division.
 */
export async function getItemDivisionMap(
	companyCode?: string | string[],
	locNo: string = "11",
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	try {
		const stockRes = await getStockMovement(
			companyCode,
			"2026-04-01",
			"2026-09-30",
			locNo,
		);
		if (stockRes.success && stockRes.data) {
			for (const r of stockRes.data) {
				const div = (r.Division || "").toString().trim().toUpperCase();
				if (div) {
					if (r.ItemName)
						map.set(r.ItemName.toString().trim().toUpperCase(), div);
					if (r.ItemId) map.set(String(r.ItemId).trim().toUpperCase(), div);
				}
			}
		}
	} catch (e) {
		console.error(
			"[getItemDivisionMap] Error building item-to-division map:",
			e,
		);
	}
	return map;
}
