import {
	boolean,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const apiServerReleases = pgTable("api_server_releases", {
	id: uuid("id").defaultRandom().primaryKey(),
	version: varchar("version", { length: 32 }).notNull().unique(),
	platform: varchar("platform", { length: 32 }).notNull().default("win-x64"),
	sha256: varchar("sha256", { length: 64 }).notNull(),
	downloadUrl: text("download_url").notNull(),
	mandatory: boolean("mandatory").notNull().default(false),
	releaseNotes: text("release_notes"),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type ApiServerRelease = typeof apiServerReleases.$inferSelect;
export type NewApiServerRelease = typeof apiServerReleases.$inferInsert;

