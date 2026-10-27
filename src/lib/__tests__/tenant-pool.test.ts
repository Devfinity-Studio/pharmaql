import { describe, it, expect, vi } from "vitest";
import { encryptSecret } from "../crypto";
import { getTenantDbPool, getActivePoolsCount, closeAllTenantPools } from "../db/tenant-pool";
import type { TenantRecord } from "../control-plane-db";

describe("tenant-pool manager (Node.js runtime)", () => {
	it("should throw when tenant is not configured for direct postgres", async () => {
		const apiTenant: TenantRecord = {
			id: "11111111-1111-1111-1111-111111111111",
			slug: "asmee",
			is_active: true,
			display_name: "Asmee Pharma",
			db_type: "api_server",
			api_server_url: "https://api.asmeepharma.com",
		};

		await expect(getTenantDbPool(apiTenant)).rejects.toThrow(
			/is configured for 'api_server', not direct 'postgres'/,
		);
	});

	it("should throw when postgres tenant has no encrypted connection string", async () => {
		const unconfiguredTenant: TenantRecord = {
			id: "22222222-2222-2222-2222-222222222222",
			slug: "client-missing-db",
			is_active: true,
			display_name: "Missing DB Client",
			db_type: "postgres",
			db_connection_encrypted: null,
		};

		await expect(getTenantDbPool(unconfiguredTenant)).rejects.toThrow(
			/has no encrypted PostgreSQL connection string configured/,
		);
	});

	it("should instantiate a pool with read-only connection limits", async () => {
		const dummyConnStr =
			"postgresql://user:pass@ep-mock-123.us-east-2.aws.neon.tech/test_db?sslmode=require";
		const encryptedConn = encryptSecret(dummyConnStr);

		const validTenant: TenantRecord = {
			id: "33333333-3333-3333-3333-333333333333",
			slug: "valid-postgres-client",
			is_active: true,
			display_name: "Postgres Client",
			db_type: "postgres",
			db_connection_encrypted: encryptedConn,
		};

		const pool = await getTenantDbPool(validTenant);
		expect(pool).toBeDefined();
		expect(getActivePoolsCount()).toBeGreaterThanOrEqual(1);

		// Clean up pool
		await closeAllTenantPools();
		expect(getActivePoolsCount()).toBe(0);
	});
});
