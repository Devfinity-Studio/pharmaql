import { beforeEach, describe, expect, it } from "vitest";
import { getDrizzleDb, schema } from "../index";
import { initControlPlaneSchema } from "../init";

describe("Drizzle ORM Layer & Neon Integration", () => {
	beforeEach(() => {
		delete process.env.CONTROL_PLANE_DATABASE_URL;
		delete process.env.NEON_DATABASE_URL;
		delete process.env.DATABASE_URL;
	});

	it("returns null when no connection string is provided (fallback mode)", () => {
		const db = getDrizzleDb();
		expect(db).toBeNull();
	});

	it("initializes a valid Drizzle Neon HTTP client when connection string exists", () => {
		process.env.NEON_DATABASE_URL =
			"postgresql://user:pass@ep-test-123.us-east-2.aws.neon.tech/test_db?sslmode=require";
		const db = getDrizzleDb();
		expect(db).not.toBeNull();
		expect(typeof db?.select).toBe("function");
		expect(typeof db?.insert).toBe("function");
		expect(typeof db?.update).toBe("function");
		expect(typeof db?.delete).toBe("function");
	});

	it("compiles typed SQL queries without runtime error", () => {
		process.env.NEON_DATABASE_URL =
			"postgresql://user:pass@ep-test-123.us-east-2.aws.neon.tech/test_db?sslmode=require";
		const db = getDrizzleDb();
		expect(db).not.toBeNull();

		const query = db!.select().from(schema.tenants);
		const sql = query.toSQL();
		expect(sql.sql).toContain('from "tenants"');
	});

	it("defines all core control plane tables with typed columns", () => {
		expect(schema.tenants).toBeDefined();
		expect(schema.tenantNotices).toBeDefined();
		expect(schema.tenantFeatures).toBeDefined();
		expect(schema.tenantLicenses).toBeDefined();
		expect(schema.tenantRuntimeConfig).toBeDefined();
		expect(schema.apiServerReleases).toBeDefined();
		expect(schema.apiServerInstances).toBeDefined();
	});

	it("handles offline schema initialization gracefully without crashing", async () => {
		// When no connection string is configured
		const result = await initControlPlaneSchema();
		expect(result).toBe(false);
	});
});

