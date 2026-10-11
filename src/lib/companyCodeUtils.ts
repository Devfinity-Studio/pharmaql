/**
 * Utilities for extracting and formatting company codes for stored procedures and report matching.
 */

/**
 * Extracts only the first word of a company or division string.
 * e.g. "STARTOS HEALTHCARE PVT LTD" -> "STARTOS"
 * e.g. "('SEE')" -> "SEE"
 * e.g. "SEE DERMA PHARMA" -> "SEE"
 */
export function extractFirstWordCompany(input?: string | null): string {
	if (!input) return "";
	let clean = input.trim();
	// Remove outer parens if wrapped like ('STARTOS HEALTHCARE')
	if (clean.startsWith("(") && clean.endsWith(")")) {
		clean = clean.slice(1, -1).trim();
	}
	// Remove outer quotes if wrapped like 'STARTOS' or "STARTOS"
	if (
		(clean.startsWith("'") && clean.endsWith("'")) ||
		(clean.startsWith('"') && clean.endsWith('"'))
	) {
		clean = clean.slice(1, -1).trim();
	}
	// Split by whitespace and take only the first word
	const firstWord = clean.split(/\s+/)[0] || "";
	// Clean any stray quotes, parens, or commas
	return firstWord.replace(/['"(),]/g, "").trim();
}

/**
 * Formats company code(s) into procedure parameter format: e.g. ('STARTOS') or ('STARTOS'),('ASMEE')
 * Ensures for any full company name like "STARTOS HEALTHCARE PVT LTD", only the first word ("STARTOS") is passed.
 */
export function formatCompanyCodeParam(compCode?: string | string[]): string {
	if (!compCode) return "";

	if (Array.isArray(compCode)) {
		const valid = compCode
			.map((c) => extractFirstWordCompany(c))
			.filter((c) => Boolean(c) && c !== "All");
		const unique = Array.from(new Set(valid));
		if (unique.length > 0) {
			return unique.map((c) => `('${c}')`).join(",");
		}
		return "";
	}

	if (
		typeof compCode === "string" &&
		compCode.trim() &&
		compCode.trim() !== "All"
	) {
		const trimmed = compCode.trim();
		const parts = trimmed
			.split(",")
			.map((p) => extractFirstWordCompany(p))
			.filter((p) => Boolean(p) && p !== "All");
		const unique = Array.from(new Set(parts));
		if (unique.length > 0) {
			return unique.map((p) => `('${p}')`).join(",");
		}
	}

	return "";
}
