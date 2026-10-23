import { describe, expect, it } from "vitest";
import { PDF_SAFE_ROW_LIMIT, validatePdfDatasetSize } from "../pdf";

describe("PDF safe row limits", () => {
	it("allows datasets within the safe limit", () => {
		const check = validatePdfDatasetSize(500);
		expect(check.safe).toBe(true);
		expect(check.cappedRowCount).toBe(500);
		expect(check.warning).toBeUndefined();
	});

	it("caps datasets exceeding PDF_SAFE_ROW_LIMIT and provides warning", () => {
		const check = validatePdfDatasetSize(5000);
		expect(check.safe).toBe(false);
		expect(check.cappedRowCount).toBe(PDF_SAFE_ROW_LIMIT);
		expect(check.warning).toContain(`exceeds the safe PDF limit (${PDF_SAFE_ROW_LIMIT} rows)`);
	});
});
