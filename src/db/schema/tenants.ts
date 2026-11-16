import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
	id: uuid("id").defaultRandom().primaryKey(),
	slug: varchar("slug", { length: 64 }).notNull().unique(),
	customDomain: varchar("custom_domain", { length: 255 }).unique(),
	isActive: boolean("is_active").notNull().default(true),
	displayName: varchar("display_name", { length: 255 }).notNull(),
	shortName: varchar("short_name", { length: 64 }),
	logoUrl: text("logo_url"),
	primaryColor: varchar("primary_color", { length: 32 }),
	accentColor: varchar("accent_color", { length: 32 }),
	address: text("address"),
	contactPhone: varchar("contact_phone", { length: 64 }),
	contactEmail: varchar("contact_email", { length: 128 }),
	supportEmail: varchar("support_email", { length: 128 }),
	userEmailDomain: varchar("user_email_domain", { length: 128 }),
	gstin: varchar("gstin", { length: 64 }),
	dbType: varchar("db_type", { length: 32 }).notNull().default("postgres"),
	dbConnectionEncrypted: text("db_connection_encrypted"),
	apiServerUrl: text("api_server_url"),
	apiServerKeyEncrypted: text("api_server_key_encrypted"),
	legacyDbName: varchar("legacy_db_name", { length: 128 }),
	erpSoftwareType: varchar("erp_software_type", { length: 64 }),
	compNo: integer("comp_no"),
	locNo: integer("loc_no"),
	overdueDirectBlockDays: integer("overdue_direct_block_days").default(90),
	overdueDivisionBlockDays: integer("overdue_division_block_days").default(95),
	overdueBlockingDisabled: boolean("overdue_blocking_disabled").default(false),
	maxDataDays: integer("max_data_days"),
	licenseStatus: varchar("license_status", { length: 32 }).default("ACTIVE"),
	licenseExpiresAt: timestamp("license_expires_at", { withTimezone: true }),
	licenseGraceDays: integer("license_grace_days").default(7),
	isLicenseBlocked: boolean("is_license_blocked").default(false),
	adminEmail: varchar("admin_email", { length: 128 }),
	adminPasswordEncrypted: text("admin_password_encrypted"),
	smtpHost: varchar("smtp_host", { length: 128 }),
	smtpPort: integer("smtp_port").default(465),
	smtpSecure: boolean("smtp_secure").default(true),
	smtpUser: varchar("smtp_user", { length: 128 }),
	smtpPasswordEncrypted: text("smtp_password_encrypted"),
	smtpFromName: varchar("smtp_from_name", { length: 128 }),
	smtpFromEmail: varchar("smtp_from_email", { length: 128 }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

