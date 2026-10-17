"use server";

import { apiGet } from "@/lib/api-client";
import { getPermissionsForRank, type MRRank, type MROverride } from "@/lib/permissions";
import { getLatestLoginTimestamps } from "@/lib/audit-logger";
import { getMROverrides } from "./mrs";

export interface MRAssignment {
	id: string;
	divisionId?: number | null;
	division: string | null;
	companyId?: number | null;
	companyCode?: string;
	company?: string | null;
	manufacturer: string;
}

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
	assignments?: MRAssignment[];
	allIds?: string[];
}

export interface MRDisplayItem {
	id: string;
	legacyId?: string;
	allIds?: string[];
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
	assignments: MRAssignment[];
}

function isSyntheticEmail(email?: string | null): boolean {
	if (!email) return true;
	const clean = email.trim().toLowerCase();
	return clean === "" || clean.includes("@asmeepharma.com");
}

/**
 * Picks the newest valid ISO timestamp from a list of candidates.
 */
function pickLatestTimestamp(
	...timestamps: (string | null | undefined)[]
): string | undefined {
	let latest: string | undefined;
	let latestMs = -1;
	for (const ts of timestamps) {
		if (!ts) continue;
		const ms = new Date(ts).getTime();
		if (!isNaN(ms) && ms > latestMs) {
			latestMs = ms;
			latest = ts;
		}
	}
	return latest;
}

/**
 * Consolidates duplicate database rows for the same MR across multiple division IDs.
 * Priority rule: Email ID is prioritized first. Rows with identical valid non-synthetic
 * emails belong to the same MR. Remaining rows are matched by case-insensitive trimmed MRName.
 */
function consolidateMRProfiles(
	rawList: LegacyMRUser[],
	allOverrides: Record<string, MROverride> = {},
	auditLoginMap?: Map<string, string>,
): MRDisplayItem[] {
	if (!rawList || rawList.length === 0) return [];

	// Disjoint Set (Union-Find)
	const parent: number[] = [];
	for (let i = 0; i < rawList.length; i++) parent[i] = i;

	function find(i: number): number {
		if (parent[i] === i) return i;
		parent[i] = find(parent[i]!);
		return parent[i]!;
	}

	function union(i: number, j: number) {
		const rootI = find(i);
		const rootJ = find(j);
		if (rootI !== rootJ) parent[rootI] = rootJ;
	}

	// Priority 1: Match by valid EmailId
	const emailMap = new Map<string, number>();
	for (let i = 0; i < rawList.length; i++) {
		const email = (rawList[i]?.email || "").trim().toLowerCase();
		if (!isSyntheticEmail(email)) {
			if (emailMap.has(email)) {
				union(i, emailMap.get(email)!);
			} else {
				emailMap.set(email, i);
			}
		}
	}

	// Priority 2: Match by trimmed case-insensitive MRName
	const nameMap = new Map<string, number>();
	for (let i = 0; i < rawList.length; i++) {
		const name = (rawList[i]?.name || "").trim().toLowerCase();
		if (name) {
			if (nameMap.has(name)) {
				union(i, nameMap.get(name)!);
			} else {
				nameMap.set(name, i);
			}
		}
	}

	// Group rows by disjoint set root
	const groups = new Map<number, LegacyMRUser[]>();
	for (let i = 0; i < rawList.length; i++) {
		const root = find(i);
		if (!groups.has(root)) groups.set(root, []);
		groups.get(root)!.push(rawList[i]!);
	}

	const consolidated: MRDisplayItem[] = [];

	for (const members of groups.values()) {
		// Pick primary record: prefer one with valid email and lowest ID
		const sortedMembers = [...members].sort((a, b) => {
			const aSynth = isSyntheticEmail(a.email) ? 1 : 0;
			const bSynth = isSyntheticEmail(b.email) ? 1 : 0;
			if (aSynth !== bSynth) return aSynth - bSynth;
			return (Number(a.id) || 0) - (Number(b.id) || 0);
		});

		const primary = sortedMembers[0]!;
		const allIds = Array.from(new Set(members.map((m) => String(m.id))));

		// Aggregate overrides across all linked IDs and email
		let mergedOverride: MROverride = {};
		for (const id of allIds) {
			if (allOverrides[id]) {
				mergedOverride = { ...mergedOverride, ...allOverrides[id] };
			}
		}
		if (primary.email && allOverrides[primary.email.toLowerCase()]) {
			mergedOverride = {
				...mergedOverride,
				...allOverrides[primary.email.toLowerCase()],
			};
		}

		// Resolve Last Login across overrides (all IDs + email) and audit logs (all IDs + email)
		const resolvedLastLogin = pickLatestTimestamp(
			mergedOverride.lastLogin,
			primary.email ? allOverrides[primary.email.toLowerCase()]?.lastLogin : undefined,
			...allIds.map((id) => allOverrides[id]?.lastLogin),
			...allIds.map((id) => auditLoginMap?.get(id)),
			primary.email ? auditLoginMap?.get(primary.email.toLowerCase()) : undefined,
		);

		// Resolve Rank: Max rank among members or override
		let rank: MRRank = 3;
		if (mergedOverride.rank) {
			rank = mergedOverride.rank;
		} else {
			let maxRank: MRRank = 1;
			for (const m of members) {
				let r: MRRank = 3;
				if (m.rank === 1 || m.rank === 2 || m.rank === 3) {
					r = m.rank;
				} else if (m.JobProfile) {
					const jp = m.JobProfile.toUpperCase().trim();
					if (jp === "MR") r = 1;
					else if (jp === "ABM" || jp === "BO") r = 2;
					else r = 3;
				}
				if (r > maxRank) maxRank = r;
			}
			rank = maxRank;
		}

		const perms = getPermissionsForRank(rank);

		// Collect all unique divisions and companies across all members
		const assignmentMap = new Map<string, MRAssignment>();

		for (const m of members) {
			const divName = m.division || m.DivisionName || null;
			const compName = m.company || m.CompanyName || "";
			const compCode = m.companyCode || m.CompanyCode || undefined;
			const divId = m.DivisionID || null;
			const key = `${divName || ""}_${compCode || compName}`;

			if (!assignmentMap.has(key)) {
				assignmentMap.set(key, {
					id: String(m.id),
					divisionId: divId,
					division: divName,
					companyId: m.CompanyID || null,
					companyCode: compCode,
					company: compName || null,
					manufacturer: compName || divName || "General",
				});
			}
		}

		// Merge any custom assignedManufacturers from overrides if present
		if (mergedOverride.assignedManufacturers) {
			for (const a of mergedOverride.assignedManufacturers) {
				const key = `${a.division || ""}_${a.manufacturer}`;
				if (!assignmentMap.has(key)) {
					assignmentMap.set(key, {
						id: a.id,
						division: a.division || null,
						manufacturer: a.manufacturer,
						company: a.manufacturer,
					});
				}
			}
		}

		const assignments = Array.from(assignmentMap.values());
		const allCompanies = Array.from(
			new Set(assignments.map((a) => a.company || a.manufacturer).filter(Boolean)),
		);
		const allCodes = Array.from(
			new Set(assignments.map((a) => a.companyCode).filter(Boolean)),
		);
		const allDivisions = Array.from(
			new Set(assignments.map((a) => a.division).filter(Boolean)),
		);

		const isBlocked =
			mergedOverride.isBlocked !== undefined
				? mergedOverride.isBlocked
				: members.every((m) => m.isBlocked);

		consolidated.push({
			id: primary.id,
			legacyId: primary.id,
			allIds,
			name: primary.name || "MR User",
			email: primary.email || "",
			company: allCompanies.join(", ") || primary.company,
			companyCode: allCodes.join(",") || primary.companyCode,
			division: allDivisions.join(", ") || primary.division,
			isBlocked,
			role: "MR",
			rank,
			lastLogin: resolvedLastLogin,
			canViewStock: perms.canViewStock,
			canViewSales: perms.canViewSales,
			canViewFreeScheme: perms.canViewFreeScheme,
			canViewPartyWise: perms.canViewPartyWise,
			canViewProductWise: perms.canViewProductWise,
			assignments,
		});
	}

	return consolidated;
}

/**
 * Fetch a single MR user from API server, consolidated with all multi-division entries
 */
export async function getMRInfo(
	identifier: string | number,
): Promise<LegacyMRUser | null> {
	const strId = String(identifier).trim();
	const allRawMRs = await getAllMRUsers();
	const allOverrides = await getMROverrides();
	const auditLoginMap = await getLatestLoginTimestamps();

	if (allRawMRs && allRawMRs.length > 0) {
		const consolidated = consolidateMRProfiles(allRawMRs, allOverrides, auditLoginMap);
		const found = consolidated.find(
			(m) =>
				m.id === strId ||
				m.allIds?.includes(strId) ||
				(m.email && m.email.toLowerCase() === strId.toLowerCase()) ||
				(m.name && m.name.toLowerCase() === strId.toLowerCase()),
		);

		if (found) {
			const rawMember =
				allRawMRs.find((r) => r.id === strId) ||
				allRawMRs.find((r) => r.id === found.id) ||
				allRawMRs[0];

			return {
				ID: Number(found.id) || 0,
				MRName: found.name,
				EmailId: found.email || null,
				MobileNo: rawMember?.MobileNo || null,
				JobProfile: rawMember?.JobProfile || null,
				DivisionID: found.assignments[0]?.divisionId || null,
				DivisionName: found.assignments[0]?.division || null,
				CompanyID: found.assignments[0]?.companyId || null,
				CompanyCode: found.assignments[0]?.companyCode || found.companyCode || null,
				CompanyName: found.assignments[0]?.company || found.company || null,
				IsInActive: found.isBlocked ? 1 : 0,
				id: found.id,
				name: found.name,
				email: found.email,
				locNo: rawMember?.locNo || "11",
				division: found.division,
				company: found.company,
				companyCode: found.companyCode,
				isBlocked: found.isBlocked,
				rank: found.rank,
				lastLogin: found.lastLogin,
				canViewStock: found.canViewStock,
				canViewSales: found.canViewSales,
				canViewFreeScheme: found.canViewFreeScheme,
				canViewPartyWise: found.canViewPartyWise,
				canViewProductWise: found.canViewProductWise,
				assignments: found.assignments,
				allIds: found.allIds,
			};
		}
	}

	// Fallback to individual API endpoint if not present in allRawMRs (e.g. internal m_user)
	const res = await apiGet<LegacyMRUser>(
		`/api/master/mr-info/${encodeURIComponent(strId)}`,
	);
	if (!res.success || !res.data) {
		return null;
	}

	const rawData = res.data;
	const override = allOverrides[rawData.id] || {};
	const resolvedLastLogin = pickLatestTimestamp(
		override.lastLogin,
		rawData.email ? allOverrides[rawData.email.toLowerCase()]?.lastLogin : undefined,
		auditLoginMap.get(String(rawData.id)),
		rawData.email ? auditLoginMap.get(rawData.email.toLowerCase()) : undefined,
	);

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

	const defaultAssignment: MRAssignment = {
		id: rawData.id,
		divisionId: rawData.DivisionID || null,
		division: rawData.division || rawData.DivisionName || null,
		companyId: rawData.CompanyID || null,
		companyCode: rawData.companyCode || rawData.CompanyCode || undefined,
		company: rawData.company || rawData.CompanyName || null,
		manufacturer: rawData.company || rawData.CompanyName || rawData.division || "General",
	};

	return {
		...rawData,
		rank,
		lastLogin: resolvedLastLogin,
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
		assignments: rawData.assignments || [defaultAssignment],
		allIds: [rawData.id],
	};
}

/**
 * Fetch all raw MR users from API server
 */
export async function getAllMRUsers(): Promise<LegacyMRUser[]> {
	const res = await apiGet<LegacyMRUser[]>("/api/master/mrs");
	if (!res.success || !res.data) {
		return [];
	}
	return res.data;
}

/**
 * Fetch all MRs with overrides and multi-division database records consolidated
 * (for developer simulation & management)
 */
export async function getAllMRsForDev(): Promise<MRDisplayItem[]> {
	const allRawMRs = await getAllMRUsers();
	const allOverrides = await getMROverrides();
	const auditLoginMap = await getLatestLoginTimestamps();
	return consolidateMRProfiles(allRawMRs, allOverrides, auditLoginMap);
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
			assignments: i.assignments,
			allIds: i.allIds,
		})),
		total: res.total,
		hasMore: res.hasMore,
		page: res.page,
	};
}

/**
 * Fetch a page of MRs with multi-division records consolidated (10 at a time by default).
 * Performs robust in-memory search across names, emails, companies, codes, and divisions.
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
	const auditLoginMap = await getLatestLoginTimestamps();

	let allItems = consolidateMRProfiles(allRawMRs, allOverrides, auditLoginMap);

	// Search filter across MR name, email, company, company code, division, and all assigned divisions
	if (searchQuery) {
		allItems = allItems.filter((mr) => {
			if (mr.name?.toLowerCase().includes(searchQuery)) return true;
			if (mr.email?.toLowerCase().includes(searchQuery)) return true;
			if (mr.company?.toLowerCase().includes(searchQuery)) return true;
			if (mr.companyCode?.toLowerCase().includes(searchQuery)) return true;
			if (mr.division?.toLowerCase().includes(searchQuery)) return true;
			if (mr.allIds?.some((id) => id.includes(searchQuery))) return true;
			return mr.assignments.some(
				(a) =>
					a.manufacturer?.toLowerCase().includes(searchQuery) ||
					a.company?.toLowerCase().includes(searchQuery) ||
					a.companyCode?.toLowerCase().includes(searchQuery) ||
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
			const compA = a.company || "";
			const compB = b.company || "";
			const cmp = compA.localeCompare(compB);
			if (cmp !== 0) return cmp;
			return (a.name || "").localeCompare(b.name || "");
		}
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
