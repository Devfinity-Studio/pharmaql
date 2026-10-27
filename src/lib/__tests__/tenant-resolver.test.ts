import { describe, it, expect } from "vitest";
import {
	normalizeHost,
	isDevPortalHost,
	resolveTenantByHost,
	invalidateTenantCache,
} from "../tenant-resolver";

describe("tenant-resolver (Edge compatible)", () => {
	it("should normalize hostnames properly", () => {
		expect(normalizeHost("portal.asmeepharma.com:3000")).toBe("portal.asmeepharma.com");
		expect(normalizeHost("Portal.AsmeePharma.COM")).toBe("portal.asmeepharma.com");
		expect(normalizeHost("localhost:8080")).toBe("localhost");
		expect(normalizeHost("asmee.localhost:3000")).toBe("asmee.localhost");
	});

	it("should recognize dev portal hosts vs client subdomains", () => {
		expect(isDevPortalHost("localhost:3000")).toBe(true);
		expect(isDevPortalHost("127.0.0.1:3000")).toBe(true);
		expect(isDevPortalHost("devfinity.net")).toBe(true);
		expect(isDevPortalHost("pharmaql.devfinity.net:443")).toBe(true);
		// Subdomains of localhost are Client Portals
		expect(isDevPortalHost("asmee.localhost:3000")).toBe(false);
		expect(isDevPortalHost("clientb.localhost:3000")).toBe(false);
		expect(isDevPortalHost("portal.asmeepharma.com")).toBe(false);
	});

	it("should resolve localhost:3000 as Dev Portal without client tenant", async () => {
		const result = await resolveTenantByHost("localhost:3000");
		expect(result.isDevPortal).toBe(true);
		expect(result.tenant).toBeNull();
	});

	it("should resolve asmee.localhost:3000 as Client Portal with tenant slug asmee", async () => {
		const result = await resolveTenantByHost("asmee.localhost:3000");
		expect(result.isDevPortal).toBe(false);
		expect(result.tenant).not.toBeNull();
		expect(result.tenant?.slug).toBe("asmee");
		expect(result.tenant?.display_name).toContain("Asmee Pharma");
	});

	it("should support developer tenant simulation via query parameters", async () => {
		const searchParams = new URLSearchParams("tenant=client-beta");
		const result = await resolveTenantByHost("localhost:3000", { searchParams });
		expect(result.isDevPortal).toBe(true);
		expect(result.tenant?.slug).toBe("client-beta");
	});

	it("should invalidate tenant cache cleanly", () => {
		expect(() => invalidateTenantCache()).not.toThrow();
		expect(() => invalidateTenantCache("asmee")).not.toThrow();
	});
});
