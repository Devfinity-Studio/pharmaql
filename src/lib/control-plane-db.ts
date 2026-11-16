import { neon } from "@neondatabase/serverless";
import { getDrizzleDb, schema } from "../db";
import { initControlPlaneSchema } from "../db/init";

export { getDrizzleDb, schema };

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
	overdue_blocking_disabled?: boolean | null;
	max_data_days?: number | null;
	license_status?: "ACTIVE" | "EXPIRED" | "SUSPENDED" | null;
	license_expires_at?: string | null;
	license_grace_days?: number | null;
	is_license_blocked?: boolean | null;
	admin_email?: string | null;
	admin_password_encrypted?: string | null;
	smtp_host?: string | null;
	smtp_port?: number | null;
	smtp_secure?: boolean | null;
	smtp_user?: string | null;
	smtp_password_encrypted?: string | null;
	smtp_from_name?: string | null;
	smtp_from_email?: string | null;
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

/**
 * Ensures normalized relational tables exist in Neon Postgres.
 * Safe, idempotent, and non-blocking via Drizzle/Neon schema initializers.
 */
export async function initControlPlaneRelationalSchema(): Promise<boolean> {
	return initControlPlaneSchema();
}
