import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isOfflineError } from "../api-client";

let mockHeadersMap = new Map<string, string>();

vi.mock("next/headers", () => ({
	headers: vi.fn().mockImplementation(() => Promise.resolve(mockHeadersMap)),
}));

describe("api-client parameter injection & offline detection", () => {
	beforeEach(() => {
		mockHeadersMap = new Map();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("detects offline errors accurately", () => {
		expect(isOfflineError(new Error("connect ECONNREFUSED 127.0.0.1:9443"))).toBe(true);
		expect(isOfflineError(new Error("The operation timed out - ETIMEDOUT"))).toBe(true);
		expect(isOfflineError(new Error("Failed to fetch"))).toBe(true);
		expect(isOfflineError(new Error("API Server unreachable"))).toBe(true);
		expect(isOfflineError(new Error("Invalid JSON token"))).toBe(false);
	});

	it("injects tenant parameters into GET URL query parameters", async () => {
		mockHeadersMap.set("x-tenant-api-url", "https://api.tenant-test.com");
		mockHeadersMap.set("x-tenant-comp-no", "42");
		mockHeadersMap.set("x-tenant-loc-no", "7");
		mockHeadersMap.set("x-tenant-legacy-db", "PHARMA_DB_2026");

		let requestedUrl = "";
		const originalFetch = global.fetch;
		global.fetch = vi.fn().mockImplementation((url: string) => {
			requestedUrl = url;
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true, data: { status: "ok" } }),
			});
		}) as any;

		const { apiGet } = await import("../api-client");
		const res = await apiGet("/api/v1/stock", { search: "Paracetamol" });

		expect(res.success).toBe(true);
		expect(requestedUrl).toContain("https://api.tenant-test.com/api/v1/stock");
		expect(requestedUrl).toContain("compNo=42");
		expect(requestedUrl).toContain("locNo=7");
		expect(requestedUrl).toContain("dbName=PHARMA_DB_2026");
		expect(requestedUrl).toContain("search=Paracetamol");

		global.fetch = originalFetch;
	});

	it("injects tenant parameters into POST body payload", async () => {
		mockHeadersMap.set("x-tenant-api-url", "https://api.tenant-post.com");
		mockHeadersMap.set("x-tenant-comp-no", "99");
		mockHeadersMap.set("x-tenant-loc-no", "3");
		mockHeadersMap.set("x-tenant-legacy-db", "POST_ERP_DB");

		let requestBody: any = null;
		const originalFetch = global.fetch;
		global.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
			requestBody = JSON.parse(opts.body);
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true, data: { orderId: 101 } }),
			});
		}) as any;

		const { apiPost } = await import("../api-client");
		const res = await apiPost("/api/v1/orders", { customerId: 456 });

		expect(res.success).toBe(true);
		expect(requestBody).toEqual({
			compNo: 99,
			locNo: 3,
			dbName: "POST_ERP_DB",
			customerId: 456,
		});

		global.fetch = originalFetch;
	});
});
