"use server";

import { apiGet } from "@/lib/api-client";
import { getPermissionsForRank, type MRRank } from "@/lib/permissions";
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
	rank: MRRank;
	lastLogin?: string;
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

	const rawData = res.data;
	const allOverrides = await getMROverrides();
	const override = allOverrides[rawData.id] || {};

	// Resolve Rank directly from database (ERP Rank column -> ERP JobProfile -> default 3)
	let rank: MRRank = 3;
	if (override.rank === 1 || override.rank === 2 || override.rank === 3) {
		rank = override.rank;
	} else if (rawData.rank === 1 || rawData.rank === 2 || rawData.rank === 3) {
		rank = rawData.rank;
	} else if (rawData.JobProfile) {
		const jp = rawData.JobProfile.toUpperCase().trim();
		if (jp === "MR") rank = 1;
		else if (jp === "ABM" || jp === "BO") rank = 2;
		else rank = 3;
	}

	const perms = getPermissionsForRank(rank);

	return {
		...rawData,
		rank,
		lastLogin: override.lastLogin,
		isBlocked:
			override.isBlocked !== undefined ? override.isBlocked : rawData.isBlocked,
		canViewStock: override.permissions?.canViewStock ?? perms.canViewStock,
		canViewSales: override.permissions?.canViewSales ?? perms.canViewSales,
		canViewFreeScheme:
			override.permissions?.canViewFreeScheme ?? perms.canViewFreeScheme,
		canViewPartyWise:
			override.permissions?.canViewPartyWise ?? perms.canViewPartyWise,
		canViewProductWise:
			override.permissions?.canViewProductWise ?? perms.canViewProductWise,
	};
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
 * Fetch paginated MR users (10 at a time by default)
 */
export async function getPaginatedMRUsers(params: {
	page?: number;
	limit?: number;
	search?: string;
	sort?: string;
}): Promise<PaginatedMRResponse> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.max(1, params.limit || 10);

	const res = await fetchMRsPage({
		page,
		limit,
		search: params.search,
		sort: params.sort,
	});

	return {
		mrs: res.items.map((i) => ({
			ID: Number(i.id) || 0,
			MRName: i.name,
			EmailId: i.email,
			MobileNo: null,
			id: i.id,
			name: i.name,
			email: i.email,
			locNo: "11",
			company: i.company,
			division: i.division,
			isBlocked: i.isBlocked,
			rank: i.rank,
			lastLogin: i.lastLogin,
			canViewStock: i.canViewStock,
			canViewSales: i.canViewSales,
			canViewFreeScheme: i.canViewFreeScheme,
			canViewPartyWise: i.canViewPartyWise,
			canViewProductWise: i.canViewProductWise,
		})),
		total: res.total,
		hasMore: res.hasMore,
		page: res.page,
	};
}

export interface MRDisplayItem {
	id: string;
	legacyId?: string;
	name: string;
	email: string;
	company?: string;
	companyCode?: string;
	division?: string;
	isBlocked: boolean;
	role: string;
	rank: MRRank;
	lastLogin?: string;
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
 * Performs robust in-memory search across names, emails, companies, and assignments,
 * applies sorting, and slices into 10 items per page.
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
	const page = Math.max(1, params.page || 1);
	const limit = Math.max(1, params.limit || 10);
	const searchQuery = (params.search || "").trim().toLowerCase();
	const sortQuery = (params.sort || "name_asc").trim();

	const allRawMRs = await getAllMRUsers();
	const allOverrides = await getMROverrides();

	let allItems: MRDisplayItem[] = allRawMRs.map((mr) => {
		const override = allOverrides[mr.id] || {};
		const isBlocked =
			override.isBlocked !== undefined ? override.isBlocked : mr.isBlocked;

		// Resolve Rank directly from database (ERP Rank column -> ERP JobProfile -> default 3)
		let rank: MRRank = 3;
		if (mr.rank === 1 || mr.rank === 2 || mr.rank === 3) {
			rank = mr.rank;
		} else if (mr.JobProfile) {
			const jp = mr.JobProfile.toUpperCase().trim();
			if (jp === "MR") {
				rank = 1;
			} else if (jp === "ABM" || jp === "BO") {
				rank = 2;
			} else {
				rank = 3;
			}
		}

		// Strictly derive permissions from rank
		const perms = getPermissionsForRank(rank);

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
			name: mr.name || "MR User",
			email: mr.email || "",
			company: mr.company,
			companyCode: mr.companyCode || mr.CompanyCode || undefined,
			division: mr.division,
			isBlocked,
			role: "MR",
			rank,
			lastLogin: override.lastLogin,
			canViewStock: perms.canViewStock,
			canViewSales: perms.canViewSales,
			canViewFreeScheme: perms.canViewFreeScheme,
			canViewPartyWise: perms.canViewPartyWise,
			canViewProductWise: perms.canViewProductWise,
			assignments,
		};
	});

	// Search filter across MR name, email, company, division, and assigned manufacturers
	if (searchQuery) {
		allItems = allItems.filter((mr) => {
			if (mr.name?.toLowerCase().includes(searchQuery)) return true;
			if (mr.email?.toLowerCase().includes(searchQuery)) return true;
			if (mr.company?.toLowerCase().includes(searchQuery)) return true;
			if (mr.division?.toLowerCase().includes(searchQuery)) return true;
			return mr.assignments.some(
				(a) =>
					a.manufacturer?.toLowerCase().includes(searchQuery) ||
					a.division?.toLowerCase().includes(searchQuery),
			);
		});
	}

	// Sort items
	allItems.sort((a, b) => {
		if (sortQuery === "email_asc") {
			return (a.email || "").localeCompare(b.email || "");
		}
		if (sortQuery === "company_asc") {
			const compA = a.assignments[0]?.manufacturer || a.company || "";
			const compB = b.assignments[0]?.manufacturer || b.company || "";
			const cmp = compA.localeCompare(compB);
			if (cmp !== 0) return cmp;
			return (a.name || "").localeCompare(b.name || "");
		}
		// Default name_asc
		return (a.name || "").localeCompare(b.name || "");
	});

	const total = allItems.length;
	const offset = (page - 1) * limit;
	const pageItems = allItems.slice(offset, offset + limit);
	const hasMore = offset + limit < total;

	return {
		items: pageItems,
		total,
		hasMore,
		page,
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
