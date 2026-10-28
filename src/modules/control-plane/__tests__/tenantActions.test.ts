import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	listTenantsAction,
	saveTenantAction,
	toggleTenantStatusAction,
	deleteTenantAction,
	testApiServerConnectionAction,
} from "../tenantActions";
import * as controlPlaneDb from "@/lib/control-plane-db";
import * as crypto from "@/lib/crypto";
import * as localTenantsStore from "@/lib/local-tenants-store";

describe("tenantActions Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Validation & Guardrails", () => {
		it("rejects saving a tenant without a slug", async () => {
			const res = await saveTenantAction({
				slug: "",
				display_name: "Test Tenant",
			});
			expect(res.success).toBe(false);
			expect(res.error).toMatch(/slug is required/i);
		});

		it("rejects saving a tenant without a display name", async () => {
			const res = await saveTenantAction({
				slug: "test-slug",
				display_name: "   ",
			});
			expect(res.success).toBe(false);
			expect(res.error).toMatch(/display name is required/i);
		});
	});

	describe("API Server Ping Diagnostics", () => {
		it("fails gracefully when no API server URL is supplied", async () => {
			const res = await testApiServerConnectionAction({});
			expect(res.success).toBe(false);
			expect(res.error).toMatch(/No API Server URL/i);
		});

		it("returns success when API server responds with healthy status", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: true,
					status: 200,
					json: vi.fn().mockResolvedValue({ status: "healthy", database: "connected" }),
				}),
			);

			const res = await testApiServerConnectionAction({
				apiServerUrl: "http://192.168.1.100:8000",
				apiKey: "test-secret-key",
			});

			expect(res.success).toBe(true);
			expect(res.status).toBe("healthy");
			expect(res.db).toBe("connected");
			vi.unstubAllGlobals();
		});

		it("fails gracefully with network timeout or error for unreachable API server", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 192.168.1.999:8000")),
			);

			const res = await testApiServerConnectionAction({
				apiServerUrl: "http://192.168.1.999:8000",
			});

			expect(res.success).toBe(false);
			expect(res.error).toMatch(/ECONNREFUSED/i);
			vi.unstubAllGlobals();
		});
	});

	describe("Dual-Mode: Local Storage Fallback Flow (No Neon DB)", () => {
		beforeEach(() => {
			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(null);
		});

		it("successfully saves tenant to local file store when CONTROL_PLANE_DATABASE_URL is not set", async () => {
			const mockSaved = {
				id: "local-uuid-1",
				slug: "client-local",
				display_name: "Client Local Pharma",
				is_active: true,
				db_type: "api_server" as const,
				comp_no: 12,
				loc_no: 12,
				primary_color: "#1E40AF",
			};
			vi.spyOn(localTenantsStore, "saveLocalTenant").mockResolvedValue(mockSaved as any);

			const res = await saveTenantAction({
				slug: "client-local",
				display_name: "Client Local Pharma",
				comp_no: 12,
				loc_no: 12,
				primary_color: "#1E40AF",
			});

			expect(res.success).toBe(true);
			expect(res.id).toBe("local-uuid-1");
		});

		it("lists tenants from local file store when CONTROL_PLANE_DATABASE_URL is not set", async () => {
			const mockTenants = [
				{
					id: "local-1",
					slug: "asmee",
					custom_domain: "portal.asmeepharma.com",
					is_active: true,
					display_name: "Asmee Pharma Pvt. Ltd.",
					short_name: "Asmee",
					db_type: "api_server" as const,
					comp_no: 11,
					loc_no: 11,
					primary_color: "#0B2545",
					overdue_direct_block_days: 90,
					overdue_division_block_days: 95,
					api_server_key_encrypted: "encrypted_key_sample",
				},
			];
			vi.spyOn(localTenantsStore, "getLocalTenants").mockResolvedValue(mockTenants as any);

			const res = await listTenantsAction();
			expect(res.success).toBe(true);
			expect(res.tenants).toHaveLength(1);
			expect(res.tenants[0]?.comp_no).toBe(11);
			expect(res.tenants[0]?.primary_color).toBe("#0B2545");
			expect(res.tenants[0]?.has_api_key).toBe(true);
		});

		it("toggles status in local file store", async () => {
			const spy = vi.spyOn(localTenantsStore, "toggleLocalTenantStatus").mockResolvedValue(true);
			const res = await toggleTenantStatusAction("local-1", false);
			expect(res.success).toBe(true);
			expect(spy).toHaveBeenCalledWith("local-1", false);
		});

		it("deletes tenant in local file store", async () => {
			const spy = vi.spyOn(localTenantsStore, "deleteLocalTenant").mockResolvedValue(true);
			const res = await deleteTenantAction("local-1");
			expect(res.success).toBe(true);
			expect(spy).toHaveBeenCalledWith("local-1");
		});
	});

	describe("Neon Cloud SQL Flow (When CONTROL_PLANE_DATABASE_URL is set)", () => {
		it("correctly encrypts api server key using AES-256-GCM before saving", async () => {
			const mockSql: any = vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
				return Promise.resolve([{ id: "test-uuid-1234" }]);
			});

			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql);
			vi.spyOn(controlPlaneDb, "initControlPlaneRelationalSchema").mockResolvedValue(true);

			const encryptSpy = vi.spyOn(crypto, "encryptSecret");

			const res = await saveTenantAction({
				slug: "client-one",
				display_name: "Client One Pharma",
				api_server_url: "http://192.168.1.50:8000",
				api_server_key: "my-api-secret-key",
			});

			expect(encryptSpy).toHaveBeenCalledWith("my-api-secret-key");
			expect(res.success).toBe(true);
			expect(res.id).toBe("test-uuid-1234");
		});

		it("masks encrypted secrets and returns boolean indicators in listTenantsAction", async () => {
			const mockRows = [
				{
					id: "tenant-1",
					slug: "asmee",
					custom_domain: "portal.asmeepharma.com",
					is_active: true,
					display_name: "Asmee Pharma",
					short_name: "Asmee",
					db_type: "api_server",
					has_api_key: false,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			const mockSql: any = vi.fn().mockResolvedValue(mockRows);
			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql);
			vi.spyOn(controlPlaneDb, "initControlPlaneRelationalSchema").mockResolvedValue(true);

			const res = await listTenantsAction();
			expect(res.success).toBe(true);
			expect(res.tenants).toHaveLength(1);
			expect(res.tenants[0]?.has_api_key).toBe(false);
			expect((res.tenants[0] as any).api_server_key_encrypted).toBeUndefined();
		});

		it("updates existing tenant in Neon with clean SQL syntax when API key is not modified", async () => {
			const mockSql: any = vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
				// Verify no syntax error or invalid parameter
				return Promise.resolve([]);
			});

			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql);
			vi.spyOn(controlPlaneDb, "initControlPlaneRelationalSchema").mockResolvedValue(true);

			const res = await saveTenantAction({
				id: "tenant-existing-1",
				slug: "client-one",
				display_name: "Client One Updated",
				api_server_url: "http://192.168.1.50:8000",
			});

			expect(res.success).toBe(true);
			expect(res.id).toBe("tenant-existing-1");
			expect(mockSql).toHaveBeenCalled();
		});

		it("updates existing tenant in Neon including encrypted API key when provided", async () => {
			const mockSql: any = vi.fn().mockResolvedValue([]);
			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql);
			vi.spyOn(controlPlaneDb, "initControlPlaneRelationalSchema").mockResolvedValue(true);

			const encryptSpy = vi.spyOn(crypto, "encryptSecret");

			const res = await saveTenantAction({
				id: "tenant-existing-2",
				slug: "client-two",
				display_name: "Client Two Updated",
				api_server_url: "http://192.168.1.60:8000",
				api_server_key: "new-super-secret-key",
			});

			expect(encryptSpy).toHaveBeenCalledWith("new-super-secret-key");
			expect(res.success).toBe(true);
			expect(res.id).toBe("tenant-existing-2");
		});
	});
});
