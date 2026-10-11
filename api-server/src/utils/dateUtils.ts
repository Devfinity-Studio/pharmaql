export function formatDateToOdbc(dateStr?: string, defaultDate = "2026-04-01"): string {
  if (!dateStr) return `{d '${defaultDate}'}`;
  const trimmed = dateStr.trim();
  if (trimmed.startsWith("{d") && trimmed.endsWith("}")) return trimmed;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return `{d '${defaultDate}'}`;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `{d '${year}-${month}-${day}'}`;
}
