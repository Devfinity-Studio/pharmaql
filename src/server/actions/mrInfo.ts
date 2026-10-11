"use server";

import { apiGet } from "@/lib/api-client";

/**
 * Compact MR profile containing only the necessary fields
 * for dashboard authorization, reporting, and UI display.
 */
export interface LegacyMRUser {
	ID: number;
	MRName: string;
	EmailId: string | null;
	MobileNo: string | null;
	JobProfile?: string | null;
	DivisionID?: number | null;
	DivisionName?: string | null;
	CompanyID?: number | null;
	CompanyCode?: string | null;
	CompanyName?: string | null;
	IsInActive?: number | null;
	ShowDealerSalesinWeb?: string | null;
	// Normalized properties used by PharmaQL
	id: string;
	name: string;
	email: string;
	locNo: string;
	division?: string;
	company?: string;
	companyCode?: string;
	isBlocked: boolean;
	canViewStock: boolean;
	canViewSales: boolean;
	canViewFreeScheme: boolean;
	canViewPartyWise: boolean;
	canViewProductWise: boolean;
}

/**
 * Fetch a single MR user from API server
 */
export async function getMRInfo(
	identifier: string | number,
): Promise<LegacyMRUser | null> {
	const res = await apiGet<LegacyMRUser>(
		`/api/master/mr-info/${encodeURIComponent(String(identifier))}`,
	);
	if (!res.success || !res.data) {
		return null;
	}
	return res.data;
}

/**
 * Fetch all MR users from API server
 */
export async function getAllMRUsers(): Promise<LegacyMRUser[]> {
	const res = await apiGet<LegacyMRUser[]>("/api/master/mrs");
	if (!res.success || !res.data) {
		return [];
	}
	return res.data;
}

/**
 * Fetch all marketing companies and their respective divisions from API server
 */
export async function getAllMarketingCompaniesWithDivisions(): Promise<
	Array<{
		companyId: number;
		companyCode: string;
		companyName: string;
		divisionId: number;
		divisionName: string;
	}>
> {
	const res = await apiGet<
		Array<{
			companyId: number;
			companyCode: string;
			companyName: string;
			divisionId: number;
			divisionName: string;
		}>
	>("/api/master/companies");

	if (!res.success || !res.data) {
		return [];
	}
	return res.data;
}
