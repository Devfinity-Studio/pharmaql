import { describe, expect, it } from "vitest";
import {
	formatDateToOdbc,
	formatFilenameDate,
	formatReportDate,
	getDefaultTMinus1MonthRange,
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
});
