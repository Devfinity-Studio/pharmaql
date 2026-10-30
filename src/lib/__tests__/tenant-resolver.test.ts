import { describe, it, expect, vi } from "vitest";
import {
	normalizeHost,
	isDevPortalHost,
	resolveTenantByHost,
	invalidateTenantCache,
} from "../tenant-resolver";
import { normalizeApiUrl } from "../utils";

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
		expect(isDevPortalHost("pharmaql.asmeepharma.com")).toBe(true);
		// Vercel preview URLs are treated as Dev Portal instances
		expect(isDevPortalHost("pharmaql-git-localdb-devfinity.vercel.app")).toBe(true);
		expect(isDevPortalHost("my-preview-123.vercel.app:443")).toBe(true);
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
		expect(result.tenant?.display_name?.toLowerCase()).toContain("asmee");
	});

	it("should support developer tenant simulation via query parameters", async () => {
		const searchParams = new URLSearchParams("tenant=asmee");
		const result = await resolveTenantByHost("localhost:3000", { searchParams });
		expect(result.isDevPortal).toBe(false);
		expect(result.tenant?.slug).toBe("asmee");
	});

	it("should invalidate tenant cache cleanly", () => {
		expect(() => invalidateTenantCache()).not.toThrow();
		expect(() => invalidateTenantCache("asmee")).not.toThrow();
	});

	it("should normalize API server URLs properly", () => {
		expect(normalizeApiUrl("api.asmeepharma.com")).toBe("https://api.asmeepharma.com");
		expect(normalizeApiUrl("https://api.asmeepharma.com/")).toBe("https://api.asmeepharma.com");
		expect(normalizeApiUrl("http://api.asmeepharma.com")).toBe("http://api.asmeepharma.com");
		expect(normalizeApiUrl("192.168.1.100:8000")).toBe("http://192.168.1.100:8000");
		expect(normalizeApiUrl("localhost:8000")).toBe("http://localhost:8000");
		expect(normalizeApiUrl("127.0.0.1:9000")).toBe("http://127.0.0.1:9000");
		expect(normalizeApiUrl("")).toBe("");
		expect(normalizeApiUrl(null)).toBe("");
		expect(normalizeApiUrl(undefined)).toBe("");
	});

	describe("when Cloud Database (Neon) is active", () => {
		it("should resolve tenant directly from Neon and not use static fallback", async () => {
			const mockTenantRecord = {
				id: "neon-123",
				slug: "neonpharma",
				display_name: "Neon Pharma Ltd",
				is_active: true,
			};
			const mockSql = vi.fn().mockResolvedValue([mockTenantRecord]);
			// Dynamically mock getControlPlaneSql
			const controlPlaneDb = await import("../control-plane-db");
			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql as any);

			invalidateTenantCache("neonpharma");
			const result = await resolveTenantByHost("neonpharma.localhost:3000");

			expect(result.tenant).not.toBeNull();
			expect(result.tenant?.slug).toBe("neonpharma");
			expect(result.tenant?.id).toBe("neon-123");
			vi.restoreAllMocks();
		});

		it("should return null and NEVER fall back to static tenants when Neon returns empty rows (deleted tenant)", async () => {
			// Even though "asmee" exists in data/tenants.json, if Neon says it's not there, it must stay deleted (null)!
			const mockSql = vi.fn().mockResolvedValue([]);
			const controlPlaneDb = await import("../control-plane-db");
			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql as any);

			invalidateTenantCache("asmee");
			const result = await resolveTenantByHost("asmee.localhost:3000");

			expect(result.tenant).toBeNull();
			expect(result.isDevPortal).toBe(false);
			vi.restoreAllMocks();
		});

		it("should return null when Neon query throws an error", async () => {
			const mockSql = vi.fn().mockRejectedValue(new Error("Connection timeout"));
			const controlPlaneDb = await import("../control-plane-db");
			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql as any);

			invalidateTenantCache("asmee");
			const result = await resolveTenantByHost("asmee.localhost:3000");

			expect(result.tenant).toBeNull();
			vi.restoreAllMocks();
		});
	});
});
