import {
	boolean,
	jsonb,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const apiServerInstances = pgTable("api_server_instances", {
	id: uuid("id").defaultRandom().primaryKey(),
	instanceId: varchar("instance_id", { length: 128 }).notNull().unique(),
	version: varchar("version", { length: 32 }).notNull(),
	platform: varchar("platform", { length: 32 }).default("win-x64"),
	machineFingerprint: varchar("machine_fingerprint", { length: 128 }),
	isVaultProtected: boolean("is_vault_protected").default(false),
	status: varchar("status", { length: 32 }).default("ONLINE"),
	lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true })
		.notNull()
		.defaultNow(),
	metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type ApiServerInstance = typeof apiServerInstances.$inferSelect;
export type NewApiServerInstance = typeof apiServerInstances.$inferInsert;
