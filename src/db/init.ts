import { neon } from "@neondatabase/serverless";

let schemaInitialized = false;

/**
 * Initializes and verifies the relational schema in Neon PostgreSQL.
 * Safe, idempotent, non-blocking, and handles edge/serverless gracefully.
 */
export async function initControlPlaneSchema(): Promise<boolean> {
	if (schemaInitialized) return true;

	const dbUrl = (
		process.env.CONTROL_PLANE_DATABASE_URL ||
		process.env.NEON_DATABASE_URL ||
		process.env.DATABASE_URL
	)?.trim();

	if (!dbUrl) {
		return false;
	}

	try {
		const sql = neon(dbUrl);

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
				overdue_blocking_disabled BOOLEAN DEFAULT false,
				max_data_days INTEGER DEFAULT NULL,
				license_status VARCHAR(32) DEFAULT 'ACTIVE',
				license_expires_at TIMESTAMPTZ DEFAULT '2027-03-31T23:59:59.000Z',
				license_grace_days INTEGER DEFAULT 7,
				is_license_blocked BOOLEAN DEFAULT false,
				admin_email VARCHAR(128),
				admin_password_encrypted TEXT,
				smtp_host VARCHAR(128),
				smtp_port INTEGER DEFAULT 465,
				smtp_secure BOOLEAN DEFAULT true,
				smtp_user VARCHAR(128),
				smtp_password_encrypted TEXT,
				smtp_from_name VARCHAR(128),
				smtp_from_email VARCHAR(128),
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// Idempotent column additions for backward compatibility
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
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS overdue_blocking_disabled BOOLEAN DEFAULT false;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_data_days INTEGER;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_status VARCHAR(32) DEFAULT 'ACTIVE';`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ DEFAULT '2027-03-31T23:59:59.000Z';`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_grace_days INTEGER DEFAULT 7;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_license_blocked BOOLEAN DEFAULT false;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_password_encrypted TEXT;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 465;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_password_encrypted TEXT;`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_from_name VARCHAR(128);`;
		await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_from_email VARCHAR(128);`;

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

		// 3. Tenant Features
		await sql`
			CREATE TABLE IF NOT EXISTS tenant_features (
				tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
				maintenance_mode BOOLEAN NOT NULL DEFAULT false,
				feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// 4. Tenant Licenses
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

		// 6. On-Premise API Releases Catalog
		await sql`
			CREATE TABLE IF NOT EXISTS api_server_releases (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				version VARCHAR(32) UNIQUE NOT NULL,
				platform VARCHAR(32) NOT NULL DEFAULT 'win-x64',
				sha256 VARCHAR(64) NOT NULL,
				download_url TEXT NOT NULL,
				mandatory BOOLEAN NOT NULL DEFAULT false,
				release_notes TEXT,
				is_active BOOLEAN NOT NULL DEFAULT true,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		// 7. On-Premise API Fleet Instances Telemetry
		await sql`
			CREATE TABLE IF NOT EXISTS api_server_instances (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				instance_id VARCHAR(128) UNIQUE NOT NULL,
				version VARCHAR(32) NOT NULL,
				platform VARCHAR(32) DEFAULT 'win-x64',
				machine_fingerprint VARCHAR(128),
				is_vault_protected BOOLEAN DEFAULT false,
				status VARCHAR(32) DEFAULT 'ONLINE',
				last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				metadata JSONB DEFAULT '{}'::jsonb,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`;

		schemaInitialized = true;
		return true;
	} catch (err: any) {
		console.warn(
			"[Drizzle/ControlPlaneDB] Schema initialization warning:",
			err.message,
		);
		return false;
	}
}

