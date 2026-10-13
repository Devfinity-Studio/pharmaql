"use server";

import { apiGet } from "@/lib/api-client";
import { getMROverrides } from "./mrs";

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

export interface PaginatedMRResponse {
	mrs: LegacyMRUser[];
	total: number;
	hasMore: boolean;
	page: number;
}

/**
 * Fetch paginated MR users from API server (10 at a time by default)
 */
export async function getPaginatedMRUsers(params: {
	page?: number;
	limit?: number;
	search?: string;
	sort?: string;
}): Promise<PaginatedMRResponse> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.max(1, params.limit || 10);
	const offset = (page - 1) * limit;

	const res = await apiGet<LegacyMRUser[]>("/api/master/mrs", {
		limit,
		offset,
		search: params.search?.trim() || undefined,
		sort: params.sort?.trim() || "name_asc",
	});

	if (!res.success || !res.data) {
		return { mrs: [], total: 0, hasMore: false, page };
	}

	return {
		mrs: res.data,
		total: res.total ?? res.data.length,
		hasMore: res.hasMore ?? false,
		page,
	};
}

export interface MRDisplayItem {
	id: string;
	legacyId?: string;
	name: string;
	email: string;
	company?: string;
	division?: string;
	isBlocked: boolean;
	role: string;
	canViewStock: boolean;
	canViewSales: boolean;
	canViewFreeScheme: boolean;
	canViewPartyWise: boolean;
	canViewProductWise: boolean;
	assignments: Array<{
		id: string;
		manufacturer: string;
		division: string | null;
	}>;
}

/**
 * Fetch a page of MRs with custom overrides merged (10 at a time by default)
 */
export async function fetchMRsPage(params: {
	page: number;
	limit?: number;
	search?: string;
	sort?: string;
}): Promise<{
	items: MRDisplayItem[];
	total: number;
	hasMore: boolean;
	page: number;
}> {
	const paginated = await getPaginatedMRUsers(params);
	const allOverrides = await getMROverrides();

	const items: MRDisplayItem[] = paginated.mrs.map((mr) => {
		const override = allOverrides[mr.id] || {};
		const isBlocked =
			override.isBlocked !== undefined ? override.isBlocked : mr.isBlocked;
		const perms = override.permissions || {
			canViewStock: mr.canViewStock,
			canViewSales: mr.canViewSales,
			canViewFreeScheme: mr.canViewFreeScheme,
			canViewPartyWise: mr.canViewPartyWise,
			canViewProductWise: mr.canViewProductWise,
		};
		const assignments =
			override.assignedManufacturers &&
			override.assignedManufacturers.length > 0
				? override.assignedManufacturers
				: mr.company
					? [
							{
								id: `legacy-${mr.id}`,
								manufacturer: mr.company,
								division: mr.division || null,
							},
						]
					: [];

		return {
			id: mr.id,
			legacyId: mr.id,
			name: mr.name,
			email: mr.email,
			company: mr.company,
			division: mr.division,
			isBlocked,
			role: "MR",
			canViewStock: perms.canViewStock,
			canViewSales: perms.canViewSales,
			canViewFreeScheme: perms.canViewFreeScheme,
			canViewPartyWise: perms.canViewPartyWise,
			canViewProductWise: perms.canViewProductWise,
			assignments,
		};
	});

	return {
		items,
		total: paginated.total,
		hasMore: paginated.hasMore,
		page: paginated.page,
	};
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
