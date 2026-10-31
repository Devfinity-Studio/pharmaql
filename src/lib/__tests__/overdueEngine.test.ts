import { describe, expect, it, vi } from "vitest";
import {
	calculateBlockDate,
	evaluateOverdueInvoices,
} from "../overdueUtils";

describe("overdueEngine", () => {
	describe("calculateBlockDate", () => {
		it("calculates future auto-block date when overDays is under 91", () => {
			const res = calculateBlockDate("2026-08-01", 85);
			expect(res).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			// 85 days means 6 days remaining until day 91
			const target = new Date();
			target.setDate(target.getDate() + 6);
			expect(res).toBe(target.toISOString().split("T")[0]);
		});

		it("returns today or immediate date when overDays is 91 or higher", () => {
			const res = calculateBlockDate("2026-06-01", 95);
			const today = new Date().toISOString().split("T")[0];
			expect(res).toBe(today);
		});
	});

	describe("evaluateOverdueInvoices", () => {
		it("returns empty warning and blocking lists when all invoices are fully adjusted", () => {
			const rows: any[] = [
				{
					ID: 1,
					DocNo: "INV-1001",
					Customer: "ABC Medical",
					DocDate: "2026-07-01",
					Amount: 10000,
					AdjAmt: 10000, // Net 0
					OverDays: 110,
				},
			];

			const result = evaluateOverdueInvoices(rows);
			expect(result.totalPendingAmt).toBe(0);
			expect(result.blockingInvoices).toHaveLength(0);
			expect(result.warningInvoices).toHaveLength(0);
		});

		it("classifies invoices with 80-90 overDays as warningInvoices", () => {
			const rows: any[] = [
				{
					ID: 2,
					DocNo: "INV-1002",
					Customer: "City Chemist",
					DocDate: "2026-08-01",
					Amount: 5000,
					AdjAmt: 0,
					OverDays: 85,
				},
			];

			const result = evaluateOverdueInvoices(rows);
			expect(result.totalPendingAmt).toBe(5000);
			expect(result.oldestDays).toBe(85);
			expect(result.warningInvoices).toHaveLength(1);
			expect(result.blockingInvoices).toHaveLength(0);
			expect(result.warningInvoices[0]?.invoiceNo).toBe("INV-1002");
		});

		it("classifies invoices with >90 overDays as blockingInvoices (direct block)", () => {
			const rows: any[] = [
				{
					ID: 3,
					DocNo: "INV-1003",
					Customer: "Metro Hospital",
					DocDate: "2026-06-01",
					Amount: 15000,
					AdjAmt: 2000, // Net 13000
					OverDays: 92,
				},
				{
					ID: 4,
					DocNo: "INV-1004",
					Customer: "Star Pharma",
					DocDate: "2026-08-01",
					Amount: 8000,
					AdjAmt: 0,
					OverDays: 82,
				},
			];

			const result = evaluateOverdueInvoices(rows);
			expect(result.totalPendingAmt).toBe(21000);
			expect(result.oldestDays).toBe(92);
			expect(result.blockingInvoices).toHaveLength(1);
			expect(result.blockingInvoices[0]?.invoiceNo).toBe("INV-1003");
			expect(result.blockingInvoices[0]?.amount).toBe(13000);
			expect(result.warningInvoices).toHaveLength(1);
			expect(result.warningInvoices[0]?.invoiceNo).toBe("INV-1004");
		});

		it("respects dynamic tenant directBlockDays limit", () => {
			const rows: any[] = [
				{
					ID: 5,
					DocNo: "INV-1005",
					Customer: "Apex Clinic",
					DocDate: "2026-08-01",
					Amount: 6000,
					AdjAmt: 0,
					OverDays: 65,
				},
			];

			// With custom 60-day limit, 65 days is blocking
			const customResult = evaluateOverdueInvoices(rows, { directBlockDays: 60 });
			expect(customResult.blockingInvoices).toHaveLength(1);
			expect(customResult.blockingInvoices[0]?.invoiceNo).toBe("INV-1005");

			// With default 90-day limit, 65 days is neither warning nor blocking
			const defaultResult = evaluateOverdueInvoices(rows, { directBlockDays: 90 });
			expect(defaultResult.blockingInvoices).toHaveLength(0);
			expect(defaultResult.warningInvoices).toHaveLength(0);
		});
	});
});
