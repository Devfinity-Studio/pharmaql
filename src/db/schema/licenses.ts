import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tenantLicenses = pgTable("tenant_licenses", {
	tenantId: uuid("tenant_id")
		.primaryKey()
		.references(() => tenants.id, { onDelete: "cascade" }),
	status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	planType: varchar("plan_type", { length: 64 })
		.notNull()
		.default("ENTERPRISE"),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type TenantLicense = typeof tenantLicenses.$inferSelect;
export type NewTenantLicense = typeof tenantLicenses.$inferInsert;

