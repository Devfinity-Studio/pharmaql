import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	listTenantsAction,
	saveTenantAction,
	toggleTenantStatusAction,
	deleteTenantAction,
	testDbConnectionAction,
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

	describe("Database Ping Diagnostics", () => {
		it("fails gracefully when no connection URI is supplied", async () => {
			const res = await testDbConnectionAction({});
			expect(res.success).toBe(false);
			expect(res.error).toMatch(/No database connection URI/i);
		});

		it("fails gracefully with connection error for unreachable database URI", async () => {
			const res = await testDbConnectionAction({
				rawDbConnection: "postgresql://fakeuser:fakepass@127.0.0.1:59999/fakedb",
			});
			expect(res.success).toBe(false);
			expect(res.error).toBeDefined();
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
				db_type: "postgres" as const,
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
				},
			];
			vi.spyOn(localTenantsStore, "getLocalTenants").mockResolvedValue(mockTenants as any);

			const res = await listTenantsAction();
			expect(res.success).toBe(true);
			expect(res.tenants).toHaveLength(1);
			expect(res.tenants[0]?.comp_no).toBe(11);
			expect(res.tenants[0]?.primary_color).toBe("#0B2545");
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
		it("correctly encrypts database connection string using AES-256-GCM before saving", async () => {
			const mockSql: any = vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
				return Promise.resolve([{ id: "test-uuid-1234" }]);
			});

			vi.spyOn(controlPlaneDb, "getControlPlaneSql").mockReturnValue(mockSql);
			vi.spyOn(controlPlaneDb, "initControlPlaneRelationalSchema").mockResolvedValue(true);

			const encryptSpy = vi.spyOn(crypto, "encryptSecret");

			const res = await saveTenantAction({
				slug: "client-one",
				display_name: "Client One Pharma",
				db_connection: "postgresql://usr:secret@db.client.com:5432/pharma",
				api_server_key: "my-api-secret-key",
			});

			expect(encryptSpy).toHaveBeenCalledWith("postgresql://usr:secret@db.client.com:5432/pharma");
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
					db_type: "postgres",
					has_db_connection: true,
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
			expect(res.tenants[0]?.has_db_connection).toBe(true);
			expect(res.tenants[0]?.has_api_key).toBe(false);
			expect((res.tenants[0] as any).db_connection_encrypted).toBeUndefined();
			expect((res.tenants[0] as any).api_server_key_encrypted).toBeUndefined();
		});
	});
});
