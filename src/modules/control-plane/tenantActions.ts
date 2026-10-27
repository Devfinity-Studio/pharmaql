"use server";

import { Client } from "pg";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string) {
	try {
		revalidatePath(path);
	} catch {
		// Suppress invariant error in non-request environments (e.g. Vitest tests)
	}
}

import {
	getControlPlaneSql,
	initControlPlaneRelationalSchema,
	type TenantRecord,
} from "@/lib/control-plane-db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import {
	getLocalTenants,
	saveLocalTenant,
	toggleLocalTenantStatus,
	deleteLocalTenant,
} from "@/lib/local-tenants-store";

export interface TenantListItem {
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
	api_server_url?: string | null;
	legacy_db_name?: string | null;
	erp_software_type?: string | null;
	comp_no?: number | null;
	loc_no?: number | null;
	overdue_direct_block_days?: number | null;
	overdue_division_block_days?: number | null;
	has_db_connection: boolean;
	has_api_key: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface SaveTenantInput {
	id?: string;
	slug: string;
	custom_domain?: string | null;
	is_active?: boolean;
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
	db_type?: "postgres" | "api_server";
	db_connection?: string | null; // Raw plaintext to be encrypted
	api_server_url?: string | null;
	api_server_key?: string | null; // Raw plaintext to be encrypted
	legacy_db_name?: string | null;
	erp_software_type?: string | null;
	comp_no?: number | null;
	loc_no?: number | null;
	overdue_direct_block_days?: number | null;
	overdue_division_block_days?: number | null;
}

export interface DbPingResult {
	success: boolean;
	db?: string;
	version?: string;
	latencyMs?: number;
	error?: string;
}

/**
 * Lists all registered tenants.
 * Dual-mode: Reads from Neon database if CONTROL_PLANE_DATABASE_URL is set,
 * otherwise falls back cleanly to local data/tenants.json.
 */
export async function listTenantsAction(): Promise<{
	success: boolean;
	tenants: TenantListItem[];
	error?: string;
}> {
	try {
		const sql = getControlPlaneSql();

		if (!sql) {
			// Local file fallback
			const localRecords = await getLocalTenants();
			const tenants: TenantListItem[] = localRecords.map((r) => ({
				id: r.id,
				slug: r.slug,
				custom_domain: r.custom_domain,
				is_active: r.is_active,
				display_name: r.display_name,
				short_name: r.short_name,
				logo_url: r.logo_url,
				primary_color: r.primary_color || "#0B2545",
				accent_color: r.accent_color || "#134074",
				address: r.address,
				contact_phone: r.contact_phone,
				contact_email: r.contact_email,
				support_email: r.support_email,
				user_email_domain: r.user_email_domain,
				gstin: r.gstin,
				db_type: r.db_type,
				api_server_url: r.api_server_url,
				legacy_db_name: r.legacy_db_name || "pdyasvmaster",
				erp_software_type: r.erp_software_type || "Technomax",
				comp_no: r.comp_no ?? 11,
				loc_no: r.loc_no ?? 11,
				overdue_direct_block_days: r.overdue_direct_block_days ?? 90,
				overdue_division_block_days: r.overdue_division_block_days ?? 95,
				has_db_connection: Boolean(r.db_connection_encrypted),
				has_api_key: Boolean(r.api_server_key_encrypted),
				created_at: r.created_at,
				updated_at: r.updated_at,
			}));
			return { success: true, tenants };
		}

		await initControlPlaneRelationalSchema();
		const rows = await sql`
			SELECT 
				id,
				slug,
				custom_domain,
				is_active,
				display_name,
				short_name,
				logo_url,
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
				legacy_db_name,
				erp_software_type,
				comp_no,
				loc_no,
				overdue_direct_block_days,
				overdue_division_block_days,
				(db_connection_encrypted IS NOT NULL AND db_connection_encrypted != '') AS has_db_connection,
				(api_server_key_encrypted IS NOT NULL AND api_server_key_encrypted != '') AS has_api_key,
				created_at,
				updated_at
			FROM tenants
			ORDER BY created_at DESC;
		`;

		const tenants: TenantListItem[] = rows.map((r: any) => ({
			id: String(r.id),
			slug: String(r.slug),
			custom_domain: r.custom_domain ? String(r.custom_domain) : null,
			is_active: Boolean(r.is_active),
			display_name: String(r.display_name),
			short_name: r.short_name ? String(r.short_name) : null,
			logo_url: r.logo_url ? String(r.logo_url) : null,
			primary_color: r.primary_color ? String(r.primary_color) : "#0B2545",
			accent_color: r.accent_color ? String(r.accent_color) : "#134074",
			address: r.address ? String(r.address) : null,
			contact_phone: r.contact_phone ? String(r.contact_phone) : null,
			contact_email: r.contact_email ? String(r.contact_email) : null,
			support_email: r.support_email ? String(r.support_email) : null,
			user_email_domain: r.user_email_domain ? String(r.user_email_domain) : null,
			gstin: r.gstin ? String(r.gstin) : null,
			db_type: (r.db_type as "postgres" | "api_server") || "postgres",
			api_server_url: r.api_server_url ? String(r.api_server_url) : null,
			legacy_db_name: r.legacy_db_name ? String(r.legacy_db_name) : "pdyasvmaster",
			erp_software_type: r.erp_software_type ? String(r.erp_software_type) : "Technomax",
			comp_no: r.comp_no !== null && r.comp_no !== undefined ? Number(r.comp_no) : 11,
			loc_no: r.loc_no !== null && r.loc_no !== undefined ? Number(r.loc_no) : 11,
			overdue_direct_block_days: Number(r.overdue_direct_block_days) || 90,
			overdue_division_block_days: Number(r.overdue_division_block_days) || 95,
			has_db_connection: Boolean(r.has_db_connection),
			has_api_key: Boolean(r.has_api_key),
			created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
			updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
		}));

		return { success: true, tenants };
	} catch (err: any) {
		console.error("[TenantActions] listTenantsAction error:", err);
		return { success: false, tenants: [], error: err.message };
	}
}

/**
 * Creates or updates a tenant.
 * Encrypts sensitive secrets (db_connection, api_server_key) before saving.
 * Works seamlessly both with Neon Postgres and local data/tenants.json.
 */
export async function saveTenantAction(
	input: SaveTenantInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
	try {
		if (!input.slug || !input.slug.trim()) {
			return { success: false, error: "Tenant slug is required." };
		}
		if (!input.display_name || !input.display_name.trim()) {
			return { success: false, error: "Display name is required." };
		}

		const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
		const cleanDomain = input.custom_domain?.trim().toLowerCase() || null;
		const displayName = input.display_name.trim();
		const shortName = input.short_name?.trim() || null;
		const logoUrl = input.logo_url?.trim() || null;
		const primaryColor = input.primary_color?.trim() || "#0B2545";
		const accentColor = input.accent_color?.trim() || "#134074";
		const address = input.address?.trim() || null;
		const phone = input.contact_phone?.trim() || null;
		const email = input.contact_email?.trim() || null;
		const supportEmail = input.support_email?.trim() || null;
		const userEmailDomain = input.user_email_domain?.trim() || null;
		const gstin = input.gstin?.trim().toUpperCase() || null;
		const dbType = input.db_type || "postgres";
		const apiServerUrl = input.api_server_url?.trim() || null;
		const legacyDbName = input.legacy_db_name?.trim() || "pdyasvmaster";
		const erpSoftwareType = input.erp_software_type?.trim() || "Technomax";
		const compNo = input.comp_no !== undefined && input.comp_no !== null ? Number(input.comp_no) : 11;
		const locNo = input.loc_no !== undefined && input.loc_no !== null ? Number(input.loc_no) : 11;
		const directBlockDays = Number(input.overdue_direct_block_days) || 90;
		const divisionBlockDays = Number(input.overdue_division_block_days) || 95;
		const isActive = input.is_active ?? true;

		const dbConnEncrypted = input.db_connection?.trim()
			? encryptSecret(input.db_connection.trim())
			: null;

		const apiKeyEncrypted = input.api_server_key?.trim()
			? encryptSecret(input.api_server_key.trim())
			: null;

		const sql = getControlPlaneSql();

		if (!sql) {
			// Save to local data/tenants.json
			const record: TenantRecord = {
				id: input.id || crypto.randomUUID(),
				slug: cleanSlug,
				custom_domain: cleanDomain,
				is_active: isActive,
				display_name: displayName,
				short_name: shortName,
				logo_url: logoUrl,
				primary_color: primaryColor,
				accent_color: accentColor,
				address,
				contact_phone: phone,
				contact_email: email,
				support_email: supportEmail,
				user_email_domain: userEmailDomain,
				gstin,
				db_type: dbType,
				db_connection_encrypted: dbConnEncrypted,
				api_server_url: apiServerUrl,
				api_server_key_encrypted: apiKeyEncrypted,
				legacy_db_name: legacyDbName,
				erp_software_type: erpSoftwareType,
				comp_no: compNo,
				loc_no: locNo,
				overdue_direct_block_days: directBlockDays,
				overdue_division_block_days: divisionBlockDays,
			};

			const saved = await saveLocalTenant(record);
			safeRevalidatePath("/admin/tenants");
			return { success: true, id: saved.id };
		}

		await initControlPlaneRelationalSchema();

		if (input.id) {
			// Update existing tenant in Neon
			await sql`
				UPDATE tenants SET
					slug = ${cleanSlug},
					custom_domain = ${cleanDomain},
					is_active = ${isActive},
					display_name = ${displayName},
					short_name = ${shortName},
					logo_url = ${logoUrl},
					primary_color = ${primaryColor},
					accent_color = ${accentColor},
					address = ${address},
					contact_phone = ${phone},
					contact_email = ${email},
					support_email = ${supportEmail},
					user_email_domain = ${userEmailDomain},
					gstin = ${gstin},
					db_type = ${dbType},
					api_server_url = ${apiServerUrl},
					legacy_db_name = ${legacyDbName},
					erp_software_type = ${erpSoftwareType},
					comp_no = ${compNo},
					loc_no = ${locNo},
					overdue_direct_block_days = ${directBlockDays},
					overdue_division_block_days = ${divisionBlockDays},
					${dbConnEncrypted ? sql`db_connection_encrypted = ${dbConnEncrypted},` : sql``}
					${apiKeyEncrypted ? sql`api_server_key_encrypted = ${apiKeyEncrypted},` : sql``}
					updated_at = NOW()
				WHERE id = ${input.id};
			`;

			safeRevalidatePath("/admin/tenants");
			return { success: true, id: input.id };
		} else {
			// Insert new tenant into Neon
			const rows = await sql`
				INSERT INTO tenants (
					slug,
					custom_domain,
					is_active,
					display_name,
					short_name,
					logo_url,
					primary_color,
					accent_color,
					address,
					contact_phone,
					contact_email,
					support_email,
					user_email_domain,
					gstin,
					db_type,
					db_connection_encrypted,
					api_server_url,
					api_server_key_encrypted,
					legacy_db_name,
					erp_software_type,
					comp_no,
					loc_no,
					overdue_direct_block_days,
					overdue_division_block_days
				) VALUES (
					${cleanSlug},
					${cleanDomain},
					${isActive},
					${displayName},
					${shortName},
					${logoUrl},
					${primaryColor},
					${accentColor},
					${address},
					${phone},
					${email},
					${supportEmail},
					${userEmailDomain},
					${gstin},
					${dbType},
					${dbConnEncrypted},
					${apiServerUrl},
					${apiKeyEncrypted},
					${legacyDbName},
					${erpSoftwareType},
					${compNo},
					${locNo},
					${directBlockDays},
					${divisionBlockDays}
				)
				RETURNING id;
			`;

			const first = rows[0];
			const newId = first?.id ? String(first.id) : undefined;
			safeRevalidatePath("/admin/tenants");
			return { success: true, id: newId };
		}
	} catch (err: any) {
		console.error("[TenantActions] saveTenantAction error:", err);
		return { success: false, error: err.message };
	}
}

/**
 * Toggles a tenant's active status.
 */
export async function toggleTenantStatusAction(
	tenantId: string,
	isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
	try {
		const sql = getControlPlaneSql();
		if (!sql) {
			await toggleLocalTenantStatus(tenantId, isActive);
			safeRevalidatePath("/admin/tenants");
			return { success: true };
		}

		await initControlPlaneRelationalSchema();
		await sql`
			UPDATE tenants 
			SET is_active = ${isActive}, updated_at = NOW() 
			WHERE id = ${tenantId};
		`;

		safeRevalidatePath("/admin/tenants");
		return { success: true };
	} catch (err: any) {
		console.error("[TenantActions] toggleTenantStatusAction error:", err);
		return { success: false, error: err.message };
	}
}

/**
 * Permanently deletes a tenant.
 */
export async function deleteTenantAction(
	tenantId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const sql = getControlPlaneSql();
		if (!sql) {
			await deleteLocalTenant(tenantId);
			safeRevalidatePath("/admin/tenants");
			return { success: true };
		}

		await initControlPlaneRelationalSchema();
		await sql`DELETE FROM tenants WHERE id = ${tenantId};`;

		safeRevalidatePath("/admin/tenants");
		return { success: true };
	} catch (err: any) {
		console.error("[TenantActions] deleteTenantAction error:", err);
		return { success: false, error: err.message };
	}
}

/**
 * Diagnoses and benchmarks connectivity to a client PostgreSQL database.
 */
export async function testDbConnectionAction(params: {
	tenantId?: string;
	rawDbConnection?: string;
}): Promise<DbPingResult> {
	let connectionString = params.rawDbConnection?.trim();

	if (!connectionString && params.tenantId) {
		try {
			const sql = getControlPlaneSql();
			if (!sql) {
				const localTenants = await getLocalTenants();
				const target = localTenants.find((t) => t.id === params.tenantId);
				if (target?.db_connection_encrypted) {
					connectionString = decryptSecret(target.db_connection_encrypted);
				}
			} else {
				await initControlPlaneRelationalSchema();
				const rows = await sql`
					SELECT db_connection_encrypted FROM tenants WHERE id = ${params.tenantId};
				`;
				const first = rows[0];
				if (first?.db_connection_encrypted) {
					connectionString = decryptSecret(first.db_connection_encrypted);
				}
			}
		} catch (err: any) {
			return {
				success: false,
				error: `Failed to decrypt tenant connection secret: ${err.message}`,
			};
		}
	}

	if (!connectionString) {
		return {
			success: false,
			error: "No database connection URI provided.",
		};
	}

	const startTime = Date.now();
	const client = new Client({
		connectionString,
		connectionTimeoutMillis: 5000,
		statement_timeout: 5000,
	});

	try {
		await client.connect();
		const res = await client.query<{ db: string; version: string }>(
			"SELECT current_database() as db, version() as version;",
		);
		const latencyMs = Date.now() - startTime;
		const row = res.rows[0];

		return {
			success: true,
			db: row?.db || "postgres",
			version: row?.version?.split(" ")[0] || "PostgreSQL",
			latencyMs,
		};
	} catch (err: any) {
		return {
			success: false,
			error: err.message || "Failed to establish database connection.",
		};
	} finally {
		await client.end().catch(() => {});
	}
}
