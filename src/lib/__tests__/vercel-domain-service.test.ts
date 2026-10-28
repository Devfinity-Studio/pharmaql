import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	isVercelConfigured,
	addDomainToVercel,
	removeDomainFromVercel,
	getDomainVerification,
} from "../vercel-domain-service";

describe("vercel-domain-service", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.restoreAllMocks();
	});

	it("correctly identifies when Vercel credentials are not configured", () => {
		delete process.env.VERCEL_API_TOKEN;
		delete process.env.VERCEL_PROJECT_ID;
		expect(isVercelConfigured()).toBe(false);
	});

	it("correctly identifies when Vercel credentials are configured", () => {
		process.env.VERCEL_API_TOKEN = "test-token";
		process.env.VERCEL_PROJECT_ID = "prj_123";
		expect(isVercelConfigured()).toBe(true);
	});

	it("returns non-blocking success message when credentials are missing", async () => {
		delete process.env.VERCEL_API_TOKEN;
		delete process.env.VERCEL_PROJECT_ID;

		const result = await addDomainToVercel("portal.client.com");
		expect(result.success).toBe(true);
		expect(result.configured).toBe(false);
		expect(result.domain).toBe("portal.client.com");
		expect(result.message).toContain("Vercel API credentials not configured");
	});

	it("calls Vercel API and returns verified status on successful response", async () => {
		process.env.VERCEL_API_TOKEN = "valid-token";
		process.env.VERCEL_PROJECT_ID = "prj_test";
		process.env.VERCEL_TEAM_ID = "team_abc";

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				name: "portal.client.com",
				verified: true,
			}),
		});
		globalThis.fetch = mockFetch;

		const result = await addDomainToVercel("https://portal.client.com/");
		expect(result.success).toBe(true);
		expect(result.configured).toBe(true);
		expect(result.domain).toBe("portal.client.com");
		expect(result.verified).toBe(true);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("teamId=team_abc"),
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer valid-token",
				}),
				body: JSON.stringify({ name: "portal.client.com" }),
			}),
		);
	});

	it("handles already registered domain on Vercel gracefully", async () => {
		process.env.VERCEL_API_TOKEN = "valid-token";
		process.env.VERCEL_PROJECT_ID = "prj_test";

		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 409,
			json: async () => ({
				error: { code: "domain_already_in_use", message: "Domain is already owned by project" },
			}),
		});
		globalThis.fetch = mockFetch;

		const result = await addDomainToVercel("portal.client.com");
		expect(result.success).toBe(true);
		expect(result.configured).toBe(true);
		expect(result.message).toContain("already configured");
	});

	it("removes domain from Vercel via DELETE request", async () => {
		process.env.VERCEL_API_TOKEN = "valid-token";
		process.env.VERCEL_PROJECT_ID = "prj_test";

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({}),
		});
		globalThis.fetch = mockFetch;

		const result = await removeDomainFromVercel("portal.client.com");
		expect(result.success).toBe(true);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/v9/projects/prj_test/domains/portal.client.com"),
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("checks verification status via POST /verify", async () => {
		process.env.VERCEL_API_TOKEN = "valid-token";
		process.env.VERCEL_PROJECT_ID = "prj_test";

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ verified: true, misconfigured: false }),
		});
		globalThis.fetch = mockFetch;

		const result = await getDomainVerification("portal.client.com");
		expect(result.configured).toBe(true);
		expect(result.verified).toBe(true);
		expect(result.misconfigured).toBe(false);
	});
});
