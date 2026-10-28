import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkDomainStatusAction } from "../tenantActions";
import dns from "node:dns/promises";
import * as vercelService from "@/lib/vercel-domain-service";

describe("checkDomainStatusAction", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns error when no domain is provided", async () => {
		const result = await checkDomainStatusAction({ customDomain: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("No custom domain provided");
	});

	it("detects valid CNAME pointing to Vercel and valid SSL handshake", async () => {
		vi.spyOn(dns, "resolveCname").mockResolvedValue(["cname.vercel-dns.com."]);
		vi.spyOn(dns, "resolve4").mockResolvedValue([]);
		vi.spyOn(vercelService, "isVercelConfigured").mockReturnValue(false);

		globalThis.fetch = vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
		}) as any;

		const result = await checkDomainStatusAction({ customDomain: "portal.asmeepharma.com" });
		expect(result.success).toBe(true);
		expect(result.dnsOk).toBe(true);
		expect(result.sslOk).toBe(true);
		expect(result.cnameTargets).toContain("cname.vercel-dns.com.");
		expect(result.recommendations[0]).toContain("fully configured and secured");
	});

	it("detects valid A record pointing to Vercel IP (76.76.21.21)", async () => {
		vi.spyOn(dns, "resolveCname").mockRejectedValue(new Error("ENODATA"));
		vi.spyOn(dns, "resolve4").mockResolvedValue(["76.76.21.21"]);
		vi.spyOn(vercelService, "isVercelConfigured").mockReturnValue(false);

		globalThis.fetch = vi.fn().mockResolvedValue({
			status: 200,
			ok: true,
		}) as any;

		const result = await checkDomainStatusAction({ customDomain: "asmeepharma.com" });
		expect(result.success).toBe(true);
		expect(result.dnsOk).toBe(true);
		expect(result.ipv4Addresses).toContain("76.76.21.21");
	});

	it("provides actionable DNS recommendations when domain is unconfigured", async () => {
		vi.spyOn(dns, "resolveCname").mockRejectedValue(new Error("ENOTFOUND"));
		vi.spyOn(dns, "resolve4").mockRejectedValue(new Error("ENOTFOUND"));
		vi.spyOn(vercelService, "isVercelConfigured").mockReturnValue(false);

		globalThis.fetch = vi.fn().mockRejectedValue(new Error("Fetch failed")) as any;

		const result = await checkDomainStatusAction({ customDomain: "unmapped.company.com" });
		expect(result.success).toBe(true);
		expect(result.dnsOk).toBe(false);
		expect(result.sslOk).toBe(false);
		expect(result.recommendations.some((r) => r.includes("cname.vercel-dns.com"))).toBe(true);
	});
});
