import { describe, expect, it } from "vitest";
import {
	PDF_SAFE_ROW_LIMIT,
	validatePdfDatasetSize,
	resolveEffectiveBranding,
	getFinancialYear,
	type PdfBranding,
} from "../pdf";

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

describe("PDF dynamic branding and financial year", () => {
	it("resolves dynamic tenant branding correctly", () => {
		const customBranding: PdfBranding = {
			companyName: "Santram Pharma",
			address: "Shop 4, Market Yard, Rajkot, Gujarat - 360001",
			phone: "+91 99999 88888",
			email: "info@santrampharma.in",
			gstin: "24BBBBB0000B1Z5",
			logoUrl: "/santram-logo.png",
		};

		const resolved = resolveEffectiveBranding(customBranding);
		expect(resolved.companyName).toBe("SANTRAM PHARMA");
		expect(resolved.address).toBe("Shop 4, Market Yard, Rajkot, Gujarat - 360001");
		expect(resolved.contactInfo).toBe("Contact: +91 99999 88888  |  Email: info@santrampharma.in");
		expect(resolved.gstin).toBe("24BBBBB0000B1Z5");
		expect(resolved.logoUrl).toBe("/santram-logo.png");
	});

	it("calculates Indian Financial Year dynamically", () => {
		expect(getFinancialYear("2026-04-15")).toBe("2026-27");
		expect(getFinancialYear("2026-09-30")).toBe("2026-27");
		expect(getFinancialYear("2027-01-10")).toBe("2026-27");
		expect(getFinancialYear("2027-03-31")).toBe("2026-27");
		expect(getFinancialYear("2027-04-01")).toBe("2027-28");
	});
});
