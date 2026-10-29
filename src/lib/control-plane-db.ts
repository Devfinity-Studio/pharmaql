import { neon } from "@neondatabase/serverless";
import staticTenants from "../../data/tenants.json";

export interface TenantRecord {
	id: string;
	slug: string;
	custom_domain?: string | null;
	is_active: boolean;
	display_name: string;
	short_name?: string | null;
	logo_url?: string | null;
	primary_color?: string | null;
	accent_color?: string | null;
	address?: string | null;
	contact_phone?: string | null;
	contact_email?: string | null;
	support_email?: string | null;
	user_email_domain?: string | null;
	gstin?: string | null;
	db_type: "postgres" | "api_server";
	db_connection_encrypted?: string | null;
	api_server_url?: string | null;
	api_server_key_encrypted?: string | null;
	legacy_db_name?: string | null;
	erp_software_type?: string | null;
	comp_no?: number | null;
	loc_no?: number | null;
	overdue_direct_block_days?: number | null;
	overdue_division_block_days?: number | null;
	admin_email?: string | null;
	admin_password_encrypted?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface TenantNoticeRecord {
	id: string;
	tenant_id?: string | null;
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
				primary_color VARCHAR(32),
				accent_color VARCHAR(32),
				address TEXT,
				contact_phone VARCHAR(64),
				contact_email VARCHAR(128),
				support_email VARCHAR(128),
				user_email_domain VARCHAR(128),
				gstin VARCHAR(64),
				db_type VARCHAR(32) NOT NULL DEFAULT 'postgres',
				db_connection_encrypted TEXT,
				api_server_url TEXT,
				api_server_key_encrypted TEXT,
				legacy_db_name VARCHAR(128),
				erp_software_type VARCHAR(64),
				comp_no INTEGER,
				loc_no INTEGER,
				overdue_direct_block_days INTEGER DEFAULT 90,
				overdue_division_block_days INTEGER DEFAULT 95,
				admin_email VARCHAR(128),
				admin_password_encrypted TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// Ensure columns exist if table was previously created
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_color VARCHAR(32);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accent_color VARCHAR(32);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_email VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_email_domain VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legacy_db_name VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS erp_software_type VARCHAR(64);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS comp_no INTEGER;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS loc_no INTEGER;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS overdue_direct_block_days INTEGER DEFAULT 90;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS overdue_division_block_days INTEGER DEFAULT 95;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_password_encrypted TEXT;`;

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
		await sql`ALTER TABLE tenant_notices ALTER COLUMN tenant_id DROP NOT NULL;`;
		await sql`ALTER TABLE tenant_notices ADD COLUMN IF NOT EXISTS variant VARCHAR(32) DEFAULT 'info';`;
		await sql`ALTER TABLE tenant_notices ADD COLUMN IF NOT EXISTS target_audience VARCHAR(32) DEFAULT 'MR';`;
		await sql`ALTER TABLE tenant_notices ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;`;
		await sql`ALTER TABLE tenant_notices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

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

		// 6. Ensure baseline tenants exist from static configuration
		if (Array.isArray(staticTenants) && staticTenants.length > 0) {
			for (const t of staticTenants as any[]) {
				await sql`
					INSERT INTO tenants (
						id,
						slug,
						custom_domain,
						is_active,
						display_name,
						short_name,
						primary_color,
						accent_color,
						address,
						contact_phone,
						contact_email,
						support_email,
						user_email_domain,
						gstin,
						db_type,
						api_server_url,
						api_server_key_encrypted,
						legacy_db_name,
						erp_software_type,
						comp_no,
						loc_no,
						overdue_direct_block_days,
						overdue_division_block_days
					) VALUES (
						${t.id},
						${t.slug},
						${t.custom_domain || null},
						${t.is_active ?? true},
						${t.display_name},
						${t.short_name || null},
						${t.primary_color || "#0B2545"},
						${t.accent_color || "#134074"},
						${t.address || null},
						${t.contact_phone || null},
						${t.contact_email || null},
						${t.support_email || null},
						${t.user_email_domain || null},
						${t.gstin || null},
						${t.db_type || "api_server"},
						${t.api_server_url || null},
						${t.api_server_key_encrypted || null},
						${t.legacy_db_name || "pdyasvmaster"},
						${t.erp_software_type || "Technomax"},
						${t.comp_no ?? 11},
						${t.loc_no ?? 11},
						${t.overdue_direct_block_days ?? 90},
						${t.overdue_division_block_days ?? 95}
					)
					ON CONFLICT (id) DO UPDATE SET
						api_server_key_encrypted = COALESCE(EXCLUDED.api_server_key_encrypted, tenants.api_server_key_encrypted),
						custom_domain = COALESCE(EXCLUDED.custom_domain, tenants.custom_domain);
				`;
			}
		}

		schemaInitialized = true;
		return true;
	} catch (err: any) {
		console.warn("[ControlPlaneDB] Schema initialization warning:", err.message);
		return false;
	}
}
