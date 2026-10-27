import { neon } from "@neondatabase/serverless";

export interface TenantRecord {
	id: string;
	slug: string;
	custom_domain?: string | null;
	is_active: boolean;
	display_name: string;
	short_name?: string | null;
	logo_url?: string | null;
	address?: string | null;
	contact_phone?: string | null;
	contact_email?: string | null;
	gstin?: string | null;
	db_type: "postgres" | "api_server";
	db_connection_encrypted?: string | null;
	api_server_url?: string | null;
	api_server_key_encrypted?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface TenantNoticeRecord {
	id: string;
	tenant_id: string;
	title: string;
	content: string;
	is_active: boolean;
	created_at?: string;
}

export interface TenantFeaturesRecord {
	tenant_id: string;
	maintenance_mode: boolean;
	feature_flags: Record<string, any>;
	updated_at?: string;
}

export interface TenantLicenseRecord {
	tenant_id: string;
	status: string;
	expires_at?: string | null;
	plan_type: string;
	updated_at?: string;
}

export interface TenantRuntimeConfigRecord {
	tenant_id: string;
	settings: Record<string, any>;
	updated_at?: string;
}

/**
 * Returns an HTTP-based Neon SQL query client.
 * 100% Edge-safe because @neondatabase/serverless uses native fetch() over HTTP.
 */
export function getControlPlaneSql() {
	const dbUrl = process.env.CONTROL_PLANE_DATABASE_URL?.trim();
	if (!dbUrl) {
		return null;
	}
	return neon(dbUrl);
}

let schemaInitialized = false;

/**
 * Ensures normalized relational tables exist in Neon Postgres.
 * Safe, idempotent, and non-blocking.
 */
export async function initControlPlaneRelationalSchema(): Promise<boolean> {
	if (schemaInitialized) return true;
	const sql = getControlPlaneSql();
	if (!sql) return false;

	try {
		await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;

		// 1. Tenants Registry
		await sql`
			CREATE TABLE IF NOT EXISTS tenants (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				slug VARCHAR(64) UNIQUE NOT NULL,
				custom_domain VARCHAR(255) UNIQUE,
				is_active BOOLEAN NOT NULL DEFAULT true,
				display_name VARCHAR(255) NOT NULL,
				short_name VARCHAR(64),
				logo_url TEXT,
				address TEXT,
				contact_phone VARCHAR(64),
				contact_email VARCHAR(128),
				gstin VARCHAR(64),
				db_type VARCHAR(32) NOT NULL DEFAULT 'postgres',
				db_connection_encrypted TEXT,
				api_server_url TEXT,
				api_server_key_encrypted TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// 2. Tenant Notices
		await sql`
			CREATE TABLE IF NOT EXISTS tenant_notices (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
				title TEXT NOT NULL,
				content TEXT NOT NULL,
				is_active BOOLEAN NOT NULL DEFAULT true,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// 3. Tenant Feature Toggles & Maintenance
		await sql`
			CREATE TABLE IF NOT EXISTS tenant_features (
				tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
				maintenance_mode BOOLEAN NOT NULL DEFAULT false,
				feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// 4. Tenant Licenses / Subscriptions
		await sql`
			CREATE TABLE IF NOT EXISTS tenant_licenses (
				tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
				status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
				expires_at TIMESTAMPTZ,
				plan_type VARCHAR(64) NOT NULL DEFAULT 'ENTERPRISE',
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// 5. Tenant Runtime Config
		await sql`
			CREATE TABLE IF NOT EXISTS tenant_runtime_config (
				tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
				settings JSONB NOT NULL DEFAULT '{}'::jsonb,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		schemaInitialized = true;
		return true;
	} catch (err: any) {
		console.warn("[ControlPlaneDB] Schema initialization warning:", err.message);
		return false;
	}
}
