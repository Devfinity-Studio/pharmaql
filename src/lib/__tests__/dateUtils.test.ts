import { describe, expect, it } from "vitest";
import {
	calculateMaxDataCutoff,
	formatDateToOdbc,
	formatFilenameDate,
	formatReportDate,
	getDefaultTMinus1MonthRange,
	sanitizeDateRangeForRole,
} from "../dateUtils";

describe("dateUtils", () => {
	describe("formatReportDate", () => {
		it("formats ISO date string into DD/Mon/YYYY", () => {
			const res = formatReportDate("2026-10-23T12:00:00Z");
			expect(res).toBe("23/Oct/2026");
		});

		it("returns empty string for null or undefined", () => {
			expect(formatReportDate(null)).toBe("");
			expect(formatReportDate(undefined)).toBe("");
		});

		it("returns original string for invalid date", () => {
			expect(formatReportDate("invalid-date")).toBe("invalid-date");
		});
	});

	describe("formatFilenameDate", () => {
		it("formats ISO date string into DD-Mon-YYYY", () => {
			const res = formatFilenameDate("2026-10-23T12:00:00Z");
			expect(res).toBe("23-Oct-2026");
		});

		it("returns empty string for empty inputs", () => {
			expect(formatFilenameDate("")).toBe("");
		});
	});

	describe("getDefaultTMinus1MonthRange", () => {
		it("returns an object with from and to strings matching YYYY-MM-DD", () => {
			const range = getDefaultTMinus1MonthRange();
			expect(range).toHaveProperty("from");
			expect(range).toHaveProperty("to");
			expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(new Date(range.from).getTime()).toBeLessThan(
				new Date(range.to).getTime(),
			);
		});
	});

	describe("formatDateToOdbc", () => {
		it("wraps standard YYYY-MM-DD in {d 'YYYY-MM-DD'}", () => {
			expect(formatDateToOdbc("2026-04-15")).toBe("{d '2026-04-15'}");
		});

		it("returns default date when input is undefined or empty", () => {
			expect(formatDateToOdbc(undefined)).toBe("{d '2026-04-01'}");
			expect(formatDateToOdbc("", "2026-01-01")).toBe("{d '2026-01-01'}");
		});

		it("preserves already formatted ODBC date strings", () => {
			expect(formatDateToOdbc("{d '2026-07-01'}")).toBe("{d '2026-07-01'}");
		});

		it("handles ISO strings with timestamps", () => {
			expect(formatDateToOdbc("2026-12-31T23:59:59Z")).toBe("{d '2026-12-31'}");
		});
	});

	describe("calculateMaxDataCutoff", () => {
		it("returns null when maxDataDays is null, undefined, or <= 0", () => {
			expect(calculateMaxDataCutoff(null)).toBeNull();
			expect(calculateMaxDataCutoff(undefined)).toBeNull();
			expect(calculateMaxDataCutoff(0)).toBeNull();
			expect(calculateMaxDataCutoff(-10)).toBeNull();
		});

		it("calculates exact 60-day cutoff date from reference date", () => {
			const ref = new Date("2026-11-03T12:00:00Z");
			const cutoff = calculateMaxDataCutoff(60, ref);
			expect(cutoff).toBe("2026-09-04");
		});
	});

	describe("sanitizeDateRangeForRole", () => {
		const ref = new Date("2026-11-03T12:00:00Z");

		it("leaves dates completely unrestricted for ADMIN role", () => {
			const res = sanitizeDateRangeForRole({
				from: "2026-04-01",
				to: "2026-11-03",
				role: "ADMIN",
				maxDataDays: 60,
				referenceDate: ref,
			});
			expect(res.from).toBe("2026-04-01");
			expect(res.to).toBe("2026-11-03");
			expect(res.isClamped).toBe(false);
			expect(res.minAllowedDate).toBeNull();
		});

		it("leaves dates completely unrestricted for DEVELOPER role", () => {
			const res = sanitizeDateRangeForRole({
				from: "2025-01-01",
				to: "2026-11-03",
				role: "DEVELOPER",
				maxDataDays: 60,
				referenceDate: ref,
			});
			expect(res.from).toBe("2025-01-01");
			expect(res.isClamped).toBe(false);
		});

		it("clamps from date for MR role if from is older than 60 days", () => {
			const res = sanitizeDateRangeForRole({
				from: "2026-04-01",
				to: "2026-10-31",
				role: "MR",
				maxDataDays: 60,
				referenceDate: ref,
			});
			expect(res.from).toBe("2026-09-04");
			expect(res.to).toBe("2026-10-31");
			expect(res.isClamped).toBe(true);
			expect(res.minAllowedDate).toBe("2026-09-04");
		});

		it("does not clamp from date if already within the 60-day window", () => {
			const res = sanitizeDateRangeForRole({
				from: "2026-10-01",
				to: "2026-10-31",
				role: "MR",
				maxDataDays: 60,
				referenceDate: ref,
			});
			expect(res.from).toBe("2026-10-01");
			expect(res.to).toBe("2026-10-31");
			expect(res.isClamped).toBe(false);
		});

		it("clamps to and asOn if older than cutoff", () => {
			const res = sanitizeDateRangeForRole({
				asOn: "2026-08-01",
				to: "2026-08-01",
				role: "MR",
				maxDataDays: 60,
				referenceDate: ref,
			});
			expect(res.asOn).toBe("2026-09-04");
			expect(res.to).toBe("2026-09-04");
			expect(res.isClamped).toBe(true);
		});
	});
});
