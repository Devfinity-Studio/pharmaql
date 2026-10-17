import { Pool, PoolConnection } from "mysql2/promise";

/**
 * Cache for m_mktcompany ERP master codes: Description (lowercase) -> Code, and Code (lowercase) -> Code
 */
let cachedCompanyMap: Map<string, string> | null = null;
let lastCacheTime = 0;

/**
 * Load or retrieve cached map of company descriptions and codes from legacy m_mktcompany table.
 */
export async function getMarketingCompanyCodeMap(
  db: Pool | PoolConnection
): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedCompanyMap && now - lastCacheTime < 3600 * 1000) {
    return cachedCompanyMap;
  }

  const map = new Map<string, string>();
  try {
    const [rows]: any = await db.query(
      "SELECT Code, Description FROM `pdyasvmaster`.`m_mktcompany`"
    );
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const code = String(row.Code || "").trim();
        const desc = String(row.Description || "").trim();
        if (code) {
          map.set(code.toLowerCase(), code);
          if (desc) {
            map.set(desc.toLowerCase(), code);
          }
        }
      }
    }
    cachedCompanyMap = map;
    lastCacheTime = now;
  } catch (err) {
    console.warn("[CompanyCodeUtils] Failed to fetch m_mktcompany codes:", err);
  }
  return map;
}

/**
 * Strips wrapping quotes and parentheses from raw parameter input without chopping words.
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
  return clean.replace(/['"()]/g, "").trim();
}

/**
 * Resolves company codes directly from the Code column of m_mktcompany ERP table.
 * If given a company description (e.g. "AAGAM LIFE SCIENCES PVT LTD"), looks up its exact Code ("AAGAM").
 * If already a Code (e.g. "AAGAM"), preserves it directly without cutting words.
 */
export async function resolveCompanyCodeParam(
  db: Pool | PoolConnection,
  compCode?: string | string[]
): Promise<string> {
  if (!compCode) return "";

  const map = await getMarketingCompanyCodeMap(db);
  const rawList: string[] = Array.isArray(compCode)
    ? compCode
    : String(compCode).split(",");

  const resolvedCodes: string[] = [];
  for (const raw of rawList) {
    const cleaned = cleanCompanyCodeInput(raw);
    if (!cleaned || cleaned.toUpperCase() === "ALL") continue;

    const lower = cleaned.toLowerCase();
    const directCode = map.get(lower) || cleaned;
    resolvedCodes.push(directCode);
  }

  const unique = Array.from(new Set(resolvedCodes.filter(Boolean)));
  if (unique.length > 0) {
    return unique.map((c) => `('${c.replace(/'/g, "''")}')`).join(",");
  }
  return "";
}

/**
 * Formats clean company codes into procedure tuple parameter format without string cutting.
 * e.g. "AAGAM" -> "('AAGAM')", ["AAGAM", "SEE"] -> "('AAGAM'),('SEE')"
 */
export function formatCompanyCodeParam(compCode?: string | string[]): string {
  if (!compCode) return "";

  const rawList: string[] = Array.isArray(compCode)
    ? compCode
    : String(compCode).split(",");

  const cleanCodes = rawList
    .map((c) => cleanCompanyCodeInput(c))
    .filter((c) => Boolean(c) && c.toUpperCase() !== "ALL");

  const unique = Array.from(new Set(cleanCodes));
  if (unique.length > 0) {
    return unique.map((c) => `('${c.replace(/'/g, "''")}')`).join(",");
  }
  return "";
}
