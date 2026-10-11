"use server";

import { legacyDb } from "@/lib/legacy-db";

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
 * Optimized projection querying items directly from pdyasvmaster.m_item
 */
export async function getItemCatalog(options?: {
	division?: string;
	company?: string;
	limit?: number;
	offset?: number;
	search?: string;
}): Promise<ItemCatalogRow[]> {
	try {
		const conditions: string[] = ["InActive = 0"];
		const params: any[] = [];

		if (options?.division && options.division !== "All") {
			conditions.push("(Division = ? OR MktBy = ?)");
			params.push(options.division, options.division);
		}

		if (options?.search) {
			conditions.push("(ItemName LIKE ? OR ItemCode LIKE ?)");
			params.push(`%${options.search}%`, `%${options.search}%`);
		}

		const limit = options?.limit || 200;
		const offset = options?.offset || 0;

		const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const sql = `
			SELECT 
				ID, AWACSCode, SeriesID, ItemCode, ItemName, PrintName, Packing,
				BaseUnit, PurcUnit, QtyPerPurcUnit, MktByID, MktBy, MfgByID,
				DivisionId, Division, AllowInvDisc, DiscPer, MinNetQty, MultipleOfQty,
				MinSaleQty, AllowSLRT, AllowChangePTR, IncSS, ItemCatgID, ItemCategory,
				IsColdChain, ItemGroup, MISRate, HSN, TaxGrpCode, GeneralTaxP, CompNo,
				PriQty, PriContains, PriContainsUnit, LBatchNo, LPrate, LPTR, LMRP,
				LExpDt, PTRMarginP, PRateMarginP, InActive
			FROM \`pdyasvmaster\`.\`m_item\`
			${whereSql}
			ORDER BY ItemName ASC
			LIMIT ? OFFSET ?
		`;

		params.push(limit, offset);
		const [rows] = await legacyDb.query(sql, params);
		return (rows as any[]) || [];
	} catch (error) {
		console.error("[Catalog] Error querying pdyasvmaster.m_item:", error);
		return [];
	}
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

