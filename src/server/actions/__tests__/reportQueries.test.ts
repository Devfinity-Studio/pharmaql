import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "@/lib/api-client";
import {
	fetchClaimData,
	fetchExpiryStock,
	fetchOverdueOutstanding,
	fetchPartyWiseSales,
	fetchProductWiseSales,
	fetchReportQuery,
	fetchStockAndSales,
	fetchStockValuation,
	getClaimData,
	getCompanyCustomerItemwiseSales,
	getExpiryStockStatement,
	getItemCustomerSale,
	getMRwisePeriodicalOutstanding,
	getStockAndSales,
	getStockMovement,
} from "../reportQueries";

vi.mock("@/lib/api-client", () => ({
	apiPost: vi.fn(),
}));

describe("Unified Report Queries Service (reportQueries.ts)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("executes fetchPartyWiseSales and aliases with proper endpoint and parameters", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValueOnce({
			success: true,
			data: [{ CustID: 101, Customer: "Apollo Pharmacy", Amt: 12500 }],
			debugSql: "CALL rptPartyWiseSaleStatement()",
		} as any);

		const res = await fetchPartyWiseSales({
			fromDate: "2026-04-01",
			toDate: "2026-09-30",
			compCode: "ASMEE",
		});

		expect(res.success).toBe(true);
		expect(res.data).toHaveLength(1);
		expect(apiClient.apiPost).toHaveBeenCalledWith(
			"/api/reports/party-item-sale",
			expect.objectContaining({ compCode: "ASMEE" }),
			expect.any(Object),
		);
		expect(getCompanyCustomerItemwiseSales).toBe(fetchPartyWiseSales);
	});

	it("executes fetchProductWiseSales and aliases", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValueOnce({
			success: true,
			data: [{ ItemID: 55, ItemName: "Amoxicillin 500mg", Qty: 200 }],
		} as any);

		const res = await fetchProductWiseSales({
			fromDate: "2026-04-01",
			toDate: "2026-09-30",
		});

		expect(res.success).toBe(true);
		if (!res.success || !res.data) throw new Error("Expected data");
		expect(res.data[0]?.ItemName).toBe("Amoxicillin 500mg");
		expect(getItemCustomerSale).toBe(fetchProductWiseSales);
	});

	it("executes fetchStockValuation and aliases", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValueOnce({
			success: true,
			data: [{ ItemId: 1, ItemName: "Paracetamol 650", Qty: 500 }],
		} as any);

		const res = await fetchStockValuation("ASMEE", "2026-04-01", "2026-09-30");

		expect(res.success).toBe(true);
		expect(res.data).toHaveLength(1);
		expect(getStockMovement).toBe(fetchStockValuation);
	});

	it("executes fetchStockAndSales and aliases", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValueOnce({
			success: true,
			data: [{ ItemName: "Azithromycin 500", BalQty: 120 }],
		} as any);

		const res = await fetchStockAndSales({
			fromDate: "2026-04-01",
			toDate: "2026-09-30",
		});

		expect(res.success).toBe(true);
		if (!res.success || !res.data) throw new Error("Expected data");
		expect(res.data[0]?.BalQty).toBe(120);
		expect(getStockAndSales).toBe(fetchStockAndSales);
	});

	it("executes fetchOverdueOutstanding and aliases", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValueOnce({
			success: true,
			data: [{ CustCode: "CUST1", DocNo: "INV-001", Amount: 5000 }],
		} as any);

		const res = await fetchOverdueOutstanding({
			fromDate: "2026-04-01",
			toDate: "2026-09-30",
		});

		expect(res.success).toBe(true);
		expect(res.data).toHaveLength(1);
		expect(getMRwisePeriodicalOutstanding).toBe(fetchOverdueOutstanding);
	});

	it("executes fetchExpiryStock and aliases", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValueOnce({
			success: true,
			data: [{ ItemCode: "EXP01", BatchNo: "B2026A", Qty: 50 }],
		} as any);

		const res = await fetchExpiryStock({
			asOnDate: "2026-10-31",
		});

		expect(res.success).toBe(true);
		if (!res.success || !res.data) throw new Error("Expected data");
		expect(res.data[0]?.BatchNo).toBe("B2026A");
		expect(getExpiryStockStatement).toBe(fetchExpiryStock);
	});

	it("executes fetchClaimData and aliases", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValueOnce({
			success: true,
			data: [{ Customer: "City Med", Qty: 10, Free: 1 }],
		} as any);

		const res = await fetchClaimData({
			fromDate: "2026-04-01",
			toDate: "2026-09-30",
		});

		expect(res.success).toBe(true);
		expect(getClaimData).toBe(fetchClaimData);
	});

	it("dispatches dynamically via fetchReportQuery", async () => {
		vi.mocked(apiClient.apiPost).mockResolvedValue({
			success: true,
			data: [{ sample: "data" }],
		} as any);

		const partyRes = await fetchReportQuery({ reportType: "party" });
		expect(partyRes.success).toBe(true);

		const stockRes = await fetchReportQuery({ reportType: "stock" });
		expect(stockRes.success).toBe(true);

		const overdueRes = await fetchReportQuery({ reportType: "overdue" });
		expect(overdueRes.success).toBe(true);

		const expiryRes = await fetchReportQuery({ reportType: "expiry" });
		expect(expiryRes.success).toBe(true);

		const unsupportedRes = await fetchReportQuery({ reportType: "invalid" as any });
		expect(unsupportedRes.success).toBe(false);
		expect(unsupportedRes.error).toContain("Unsupported report type");
	});
});
