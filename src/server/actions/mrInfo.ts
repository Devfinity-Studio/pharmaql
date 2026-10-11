"use server";

import { legacyDb } from "@/lib/legacy-db";

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
 * Optimized SQL projection querying ONLY the fields needed
 * from pdyasvmaster.l_mktcompany_mr linked with m_mktcompany and l_mktcompany.
 */
const SELECT_MKT_MR_COLUMNS = `
	mr.ID AS ID,
	mr.DivisionID AS DivisionID,
	mr.MRName AS MRName,
	mr.EmailId AS EmailId,
	mr.MobileNo AS MobileNo,
	mr.JobProfile AS JobProfile,
	mr.IsInActive AS IsInActive,
	mr.ShowDealerSalesinWeb AS ShowDealerSalesinWeb,
	l.Division AS DivisionName,
	m.ID AS CompanyID,
	m.Code AS CompanyCode,
	m.Description AS CompanyName
`;

const LEGACY_MKT_MR_QUERY = `
	SELECT ${SELECT_MKT_MR_COLUMNS}
	FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` mr
	LEFT JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON mr.DivisionID = l.ID
	LEFT JOIN \`pdyasvmaster\`.\`m_mktcompany\` m ON l.CompCode = m.Code
`;

function normalizeLegacyMR(raw: any): LegacyMRUser {
	const isBlocked = Number(raw.IsInActive ?? raw.IsBlocked ?? 0) === 1;
	const name = (raw.MRName || raw.Description || raw.UCode || "MR User")
		.toString()
		.trim();
	const email = (raw.EmailId || `${raw.ID}@asmeepharma.com`).toString().trim();
	const division = raw.DivisionName
		? String(raw.DivisionName).trim()
		: undefined;
	const company =
		raw.CompanyName || raw.CompanyCode
			? String(raw.CompanyName || raw.CompanyCode).trim()
			: undefined;
	const companyCode = raw.CompanyCode
		? String(raw.CompanyCode).trim()
		: undefined;

	return {
		ID: raw.ID,
		MRName: name,
		EmailId: raw.EmailId || null,
		MobileNo: raw.MobileNo || null,
		JobProfile: raw.JobProfile || null,
		DivisionID: raw.DivisionID || null,
		DivisionName: division,
		CompanyID: raw.CompanyID || null,
		CompanyCode: companyCode || null,
		CompanyName: company,
		IsInActive: raw.IsInActive ?? 0,
		ShowDealerSalesinWeb: raw.ShowDealerSalesinWeb || "N",
		id: String(raw.ID),
		name,
		email,
		locNo: "11",
		division,
		company,
		companyCode,
		isBlocked,
		canViewStock: true,
		canViewSales: true,
		canViewFreeScheme: true,
		canViewPartyWise: true,
		canViewProductWise: true,
	};
}

/**
 * Fetch a single MR user from legacy MySQL database (pdyasvmaster.l_mktcompany_mr linked with m_mktcompany)
 * selecting only the required columns.
 */
export async function getMRInfo(
	identifier: string | number,
): Promise<LegacyMRUser | null> {
	try {
		const strId = String(identifier).trim();
		const numId = Number(identifier);
		const isNumeric = !isNaN(numId) && String(numId) === strId;

		const query = isNumeric
			? `${LEGACY_MKT_MR_QUERY} WHERE mr.ID = ? LIMIT 1`
			: `${LEGACY_MKT_MR_QUERY} WHERE mr.EmailId = ? OR mr.MRName = ? OR mr.MobileNo = ? LIMIT 1`;

		const params = isNumeric ? [numId] : [strId, strId, strId];

		const [rows] = await legacyDb.query(query, params);
		const results = rows as any[];

		if (results && results.length > 0) {
			return normalizeLegacyMR(results[0]);
		}

		// Fallback fuzzy search on MRName / EmailId
		const [fallbackRows] = await legacyDb.query(
			`${LEGACY_MKT_MR_QUERY} WHERE mr.MRName LIKE ? OR mr.EmailId LIKE ? LIMIT 1`,
			[`%${strId}%`, `%${strId}%`],
		);
		const fallbackResults = fallbackRows as any[];
		if (fallbackResults && fallbackResults.length > 0) {
			return normalizeLegacyMR(fallbackResults[0]);
		}

		// Secondary fallback: check m_user if ID matches internal user
		const [userRows] = await legacyDb.query(
			`SELECT ID, UCode, Description, EmailId, MobileNo, IsBlocked FROM \`pdyasvmaster\`.\`m_user\` WHERE ID = ? OR UCode = ? LIMIT 1`,
			[isNumeric ? numId : -1, strId],
		);
		const userResults = userRows as any[];
		if (userResults && userResults.length > 0) {
			const u = userResults[0];
			return normalizeLegacyMR({
				ID: u.ID,
				MRName: u.Description || u.UCode,
				EmailId: u.EmailId,
				MobileNo: u.MobileNo,
				IsInActive: u.IsBlocked,
			});
		}

		return null;
	} catch (error) {
		console.error("Failed to query MR info from legacy database:", error);
		return null;
	}
}

/**
 * Fetch all MR users from legacy MySQL database (pdyasvmaster.l_mktcompany_mr)
 * selecting only the needed fields and linked to m_mktcompany.
 */
export async function getAllMRUsers(): Promise<LegacyMRUser[]> {
	try {
		const [rows] = await legacyDb.query(
			`${LEGACY_MKT_MR_QUERY} ORDER BY mr.MRName ASC`,
		);
		const results = (rows as any[]) || [];
		return results.map(normalizeLegacyMR);
	} catch (error) {
		console.error("Failed to query all MR users from legacy database:", error);
		return [];
	}
}

/**
 * Fetch all marketing companies and their respective divisions from m_mktcompany and l_mktcompany.
 * Cached in memory with a 1-hour TTL to accelerate navigation and rendering.
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
	const { getOrSetCache } = await import("@/lib/cache");
	return getOrSetCache(
		"all_marketing_companies_with_divisions",
		3600,
		async () => {
			try {
				const [rows] = await legacyDb.query(`
				SELECT DISTINCT
					m.ID AS companyId,
					m.Code AS companyCode,
					m.Description AS companyName,
					l.ID AS divisionId,
					l.Division AS divisionName
				FROM \`pdyasvmaster\`.\`m_mktcompany\` m
				JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON m.Code = l.CompCode
				WHERE m.IsInActive = 0
				ORDER BY m.Description ASC, l.Division ASC
			`);
				return (rows as any[]) || [];
			} catch (error) {
				console.error(
					"Failed to query marketing companies and divisions:",
					error,
				);
				return [];
			}
		},
	);
}
