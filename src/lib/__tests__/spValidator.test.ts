import { describe, it, expect } from "vitest";
import {
	validateOutstandingParams,
	validateStockMovementParams,
	validateStockAndSalesParams,
	validatePartyItemSaleParams,
} from "../../../api-server/src/utils/spValidator";

describe("spValidator - Stored Procedure Parameter Schema Guards", () => {
	describe("validateOutstandingParams (rptMRwisePeriodicalOutstanding)", () => {
		it("accepts requests where mrId is omitted or empty (company-wide / all MRs)", () => {
			const resEmpty = validateOutstandingParams({
				fromDate: "2026-04-01",
				toDate: "2026-10-31",
			});
			expect(resEmpty.isValid).toBe(true);
			expect(resEmpty.errors).toHaveLength(0);

			const resEmptyString = validateOutstandingParams({
				mrId: "",
				fromDate: "2026-04-01",
				toDate: "2026-10-31",
			});
			expect(resEmptyString.isValid).toBe(true);
			expect(resEmptyString.errors).toHaveLength(0);
		});

		it("accepts requests with numeric or string mrId", () => {
			const resNumeric = validateOutstandingParams({
				mrId: 47,
				fromDate: "2026-04-01",
				toDate: "2026-10-31",
			});
			expect(resNumeric.isValid).toBe(true);

			const resString = validateOutstandingParams({
				mrId: "47",
				fromDate: "2026-04-01",
				toDate: "2026-10-31",
			});
			expect(resString.isValid).toBe(true);
		});

		it("rejects invalid date formats", () => {
			const res = validateOutstandingParams({
				fromDate: "invalid-date",
				toDate: "2026-10-31",
			});
			expect(res.isValid).toBe(false);
			expect(res.errors[0]).toContain("fromDate must be a valid date formatted as YYYY-MM-DD");
		});

		it("validates recDate if provided", () => {
			const resValid = validateOutstandingParams({
				recDate: "2026-04-01",
			});
			expect(resValid.isValid).toBe(true);

			const resInvalid = validateOutstandingParams({
				recDate: "01/04/2026",
			});
			expect(resInvalid.isValid).toBe(false);
			expect(resInvalid.errors[0]).toContain("recDate must be a valid date formatted as YYYY-MM-DD");
		});
	});

	describe("validateStockMovementParams (rptStockMovementStatement)", () => {
		it("validates valid parameters", () => {
			const res = validateStockMovementParams({
				fromDate: "2026-04-01",
				toDate: "2026-10-31",
				compNo: 11,
			});
			expect(res.isValid).toBe(true);
		});

		it("rejects non-numeric compNo", () => {
			const res = validateStockMovementParams({
				compNo: "non-numeric",
			});
			expect(res.isValid).toBe(false);
			expect(res.errors[0]).toContain("compNo must be a numeric value");
		});
	});

	describe("validateStockAndSalesParams", () => {
		it("rejects empty string finYear", () => {
			const res = validateStockAndSalesParams({
				finYear: "   ",
			});
			expect(res.isValid).toBe(false);
			expect(res.errors[0]).toContain("finYear cannot be an empty string");
		});
	});

	describe("validatePartyItemSaleParams", () => {
		it("validates valid dates", () => {
			const res = validatePartyItemSaleParams({
				fromDate: "2026-04-01",
				toDate: "2026-10-31",
			});
			expect(res.isValid).toBe(true);
		});
	});
});

