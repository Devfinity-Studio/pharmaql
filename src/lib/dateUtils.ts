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
