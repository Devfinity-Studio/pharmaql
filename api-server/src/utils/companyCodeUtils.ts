/**
 * Utilities for extracting and formatting company codes for stored procedures and report matching.
 */

export function extractFirstWordCompany(input?: string | null): string {
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
  const firstWord = clean.split(/\s+/)[0] || "";
  return firstWord.replace(/['"(),]/g, "").trim();
}

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
