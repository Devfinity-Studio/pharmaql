/**
 * Utilities for formatting company codes for stored procedures and report matching.
 * Company codes are retrieved directly from the Code column of the legacy m_mktcompany ERP table.
 */

export function cleanCompanyCodeInput(input?: string | null): string {
	if (!input) return "";
	let clean = input.trim();
	if (clean.startsWith("(") && clean.endsWith(")")) {
		clean = clean.slice(1, -1).trim();
	}
	if (
		(clean.startsWith("'") && clean.endsWith("'")) ||
		(clean.startsWith('"') && clean.endsWith('"'))
	) {
		clean = clean.slice(1, -1).trim();
	}
	return clean.replace(/['"(),]/g, "").trim();
}

/**
 * Formats company code(s) directly into procedure parameter format: e.g. ('AAGAM') or ('AAGAM'),('SEE')
 * Preserves the exact Code column from m_mktcompany without string cutting.
 */
export function formatCompanyCodeParam(compCode?: string | string[]): string {
	if (!compCode) return "";

	const rawList = Array.isArray(compCode) ? compCode : String(compCode).split(",");

	const valid = rawList
		.map((c) => cleanCompanyCodeInput(c))
		.filter((c) => Boolean(c) && c.toUpperCase() !== "ALL");

	const unique = Array.from(new Set(valid));
	if (unique.length > 0) {
		return unique.map((c) => `('${c.replace(/'/g, "''")}')`).join(",");
	}
	return "";
}
