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

