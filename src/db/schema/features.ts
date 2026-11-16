import { boolean, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tenantFeatures = pgTable("tenant_features", {
	tenantId: uuid("tenant_id")
		.primaryKey()
		.references(() => tenants.id, { onDelete: "cascade" }),
	maintenanceMode: boolean("maintenance_mode").notNull().default(false),
	featureFlags: jsonb("feature_flags")
		.$type<Record<string, any>>()
		.notNull()
		.default({}),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type TenantFeature = typeof tenantFeatures.$inferSelect;
export type NewTenantFeature = typeof tenantFeatures.$inferInsert;

