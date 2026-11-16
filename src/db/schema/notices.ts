import {
	boolean,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tenantNotices = pgTable("tenant_notices", {
	id: uuid("id").defaultRandom().primaryKey(),
	tenantId: uuid("tenant_id").references(() => tenants.id, {
		onDelete: "cascade",
	}),
	title: text("title").notNull(),
	content: text("content").notNull(),
	variant: varchar("variant", { length: 32 }).default("info"),
	targetAudience: varchar("target_audience", { length: 32 }).default("MR"),
	isActive: boolean("is_active").notNull().default(true),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type TenantNotice = typeof tenantNotices.$inferSelect;
export type NewTenantNotice = typeof tenantNotices.$inferInsert;

