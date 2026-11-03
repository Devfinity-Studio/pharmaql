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

/**
 * Calculates the earliest allowed historical date given a maxDataDays window from today.
 * e.g., if maxDataDays is 60 and referenceDate is 2026-11-03, returns "2026-09-04".
 */
export function calculateMaxDataCutoff(
	maxDataDays?: number | null,
	referenceDate = new Date(),
): string | null {
	if (!maxDataDays || isNaN(maxDataDays) || maxDataDays <= 0) return null;
	const cutoff = new Date(referenceDate);
	cutoff.setDate(cutoff.getDate() - maxDataDays);
	const y = cutoff.getFullYear();
	const m = String(cutoff.getMonth() + 1).padStart(2, "0");
	const d = String(cutoff.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * Sanitizes and clamps a date range according to the viewer's role and tenant maxDataDays.
 * - ADMIN / DEVELOPER: completely unrestricted (returns original from/to unchanged).
 * - MR / unauthenticated: if maxDataDays is configured (> 0), from and to cannot be older than the cutoff.
 */
export function sanitizeDateRangeForRole(params: {
	from?: string | null;
	to?: string | null;
	asOn?: string | null;
	role?: string | null;
	maxDataDays?: number | null;
	referenceDate?: Date;
}): {
	from?: string;
	to?: string;
	asOn?: string;
	minAllowedDate: string | null;
	isClamped: boolean;
} {
	const { from, to, asOn, role, maxDataDays, referenceDate } = params;
	const isAdmin = role === "ADMIN" || role === "DEVELOPER";

	if (isAdmin || !maxDataDays || maxDataDays <= 0) {
		return {
			from: from || undefined,
			to: to || undefined,
			asOn: asOn || undefined,
			minAllowedDate: null,
			isClamped: false,
		};
	}

	const minAllowedDate = calculateMaxDataCutoff(maxDataDays, referenceDate);
	if (!minAllowedDate) {
		return {
			from: from || undefined,
			to: to || undefined,
			asOn: asOn || undefined,
			minAllowedDate: null,
			isClamped: false,
		};
	}

	let effectiveFrom = from || undefined;
	let effectiveTo = to || undefined;
	let effectiveAsOn = asOn || undefined;
	let isClamped = false;

	if (effectiveFrom && effectiveFrom < minAllowedDate) {
		effectiveFrom = minAllowedDate;
		isClamped = true;
	} else if (!effectiveFrom) {
		effectiveFrom = minAllowedDate;
	}

	if (effectiveTo && effectiveTo < minAllowedDate) {
		effectiveTo = minAllowedDate;
		isClamped = true;
	}

	if (effectiveAsOn && effectiveAsOn < minAllowedDate) {
		effectiveAsOn = minAllowedDate;
		isClamped = true;
	}

	return {
		from: effectiveFrom,
		to: effectiveTo,
		asOn: effectiveAsOn,
		minAllowedDate,
		isClamped,
	};
}
