import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tenantRuntimeConfig = pgTable("tenant_runtime_config", {
	tenantId: uuid("tenant_id")
		.primaryKey()
		.references(() => tenants.id, { onDelete: "cascade" }),
	settings: jsonb("settings")
		.$type<Record<string, any>>()
		.notNull()
		.default({}),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type TenantRuntimeConfig = typeof tenantRuntimeConfig.$inferSelect;
export type NewTenantRuntimeConfig = typeof tenantRuntimeConfig.$inferInsert;

