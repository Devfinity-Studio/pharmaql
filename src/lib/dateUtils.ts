export function formatReportDate(
	dateString: string | null | undefined,
): string {
	if (!dateString) return "";
	try {
		const d = new Date(dateString);
		if (isNaN(d.getTime())) return dateString;
		const formatter = new Intl.DateTimeFormat("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
		return formatter.format(d).replace(/ /g, "/");
	} catch {
		return dateString;
	}
}

export function formatFilenameDate(
	dateString: string | null | undefined,
): string {
	if (!dateString) return "";
	try {
		const d = new Date(dateString);
		if (isNaN(d.getTime())) return dateString;
		const formatter = new Intl.DateTimeFormat("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
		return formatter.format(d).replace(/ /g, "-");
	} catch {
		return dateString;
	}
}

/**
 * Returns default date range for T-1 month (previous full calendar month).
 * e.g., in October 2026, returns { from: "2026-09-01", to: "2026-09-30" }.
 */
export function getDefaultTMinus1MonthRange(): { from: string; to: string } {
	const today = new Date();
	const firstDayLastMonth = new Date(
		today.getFullYear(),
		today.getMonth() - 1,
		1,
	);
	const lastDayLastMonth = new Date(
		today.getFullYear(),
		today.getMonth(),
		0,
	);

	const formatDate = (d: Date) => {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	};

	return {
		from: formatDate(firstDayLastMonth),
		to: formatDate(lastDayLastMonth),
	};
}

/**
 * Formats date string into ODBC format: {d 'YYYY-MM-DD'}
 */
export function formatDateToOdbc(dateStr?: string, defaultDate = "2026-04-01"): string {
	if (!dateStr) return `{d '${defaultDate}'}`;
	const trimmed = dateStr.trim();
	if (trimmed.startsWith("{d") && trimmed.endsWith("}")) return trimmed;
	const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
	if (match?.[1]) return `{d '${match[1]}'}`;
	const d = new Date(trimmed);
	if (isNaN(d.getTime())) return `{d '${defaultDate}'}`;
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `{d '${year}-${month}-${day}'}`;
}

