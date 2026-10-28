"use server";

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
import { normalizeApiUrl } from "@/lib/utils";

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
	db_type: "api_server";
	api_server_url?: string | null;
	legacy_db_name?: string | null;
	erp_software_type?: string | null;
	comp_no?: number | null;
	loc_no?: number | null;
	overdue_direct_block_days?: number | null;
	overdue_division_block_days?: number | null;
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
	api_server_url?: string | null;
	api_server_key?: string | null; // Raw plaintext to be encrypted
	legacy_db_name?: string | null;
	erp_software_type?: string | null;
	comp_no?: number | null;
	loc_no?: number | null;
	overdue_direct_block_days?: number | null;
	overdue_division_block_days?: number | null;
}

export interface ApiServerPingResult {
	success: boolean;
	status?: string;
	db?: string;
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
				db_type: "api_server",
				api_server_url: r.api_server_url,
				legacy_db_name: r.legacy_db_name || "pdyasvmaster",
				erp_software_type: r.erp_software_type || "Technomax",
				comp_no: r.comp_no ?? 11,
				loc_no: r.loc_no ?? 11,
				overdue_direct_block_days: r.overdue_direct_block_days ?? 90,
				overdue_division_block_days: r.overdue_division_block_days ?? 95,
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
			db_type: "api_server",
			api_server_url: r.api_server_url ? String(r.api_server_url) : null,
			legacy_db_name: r.legacy_db_name ? String(r.legacy_db_name) : "pdyasvmaster",
			erp_software_type: r.erp_software_type ? String(r.erp_software_type) : "Technomax",
			comp_no: r.comp_no !== null && r.comp_no !== undefined ? Number(r.comp_no) : 11,
			loc_no: r.loc_no !== null && r.loc_no !== undefined ? Number(r.loc_no) : 11,
			overdue_direct_block_days: Number(r.overdue_direct_block_days) || 90,
			overdue_division_block_days: Number(r.overdue_division_block_days) || 95,
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
 * Encrypts API server secret keys before saving.
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
		const dbType = "api_server";
		const apiServerUrl = input.api_server_url ? normalizeApiUrl(input.api_server_url) : null;
		const legacyDbName = input.legacy_db_name?.trim() || "pdyasvmaster";
		const erpSoftwareType = input.erp_software_type?.trim() || "Technomax";
		const compNo = input.comp_no !== undefined && input.comp_no !== null ? Number(input.comp_no) : 11;
		const locNo = input.loc_no !== undefined && input.loc_no !== null ? Number(input.loc_no) : 11;
		const directBlockDays = Number(input.overdue_direct_block_days) || 90;
		const divisionBlockDays = Number(input.overdue_division_block_days) || 95;
		const isActive = input.is_active ?? true;

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
				db_connection_encrypted: null,
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
			if (apiKeyEncrypted) {
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
						api_server_key_encrypted = ${apiKeyEncrypted},
						legacy_db_name = ${legacyDbName},
						erp_software_type = ${erpSoftwareType},
						comp_no = ${compNo},
						loc_no = ${locNo},
						overdue_direct_block_days = ${directBlockDays},
						overdue_division_block_days = ${divisionBlockDays},
						updated_at = NOW()
					WHERE id = ${input.id};
				`;
			} else {
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
						updated_at = NOW()
					WHERE id = ${input.id};
				`;
			}

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
 * Diagnoses and benchmarks connectivity to a client On-Premises API Server.
 * Sends a GET request to ${apiServerUrl}/health with authentication header.
 * Measures roundtrip latency (ms) and reports server health.
 */
export async function testApiServerConnectionAction(params: {
	tenantId?: string;
	rawApiServerUrl?: string;
	rawApiKey?: string;
	apiServerUrl?: string;
	apiKey?: string;
}): Promise<ApiServerPingResult> {
	let targetUrl = (params.rawApiServerUrl || params.apiServerUrl)?.trim();
	let apiKey = (params.rawApiKey || params.apiKey)?.trim();

	if ((!targetUrl || !apiKey) && params.tenantId) {
		try {
			const sql = getControlPlaneSql();
			if (!sql) {
				const localTenants = await getLocalTenants();
				const target = localTenants.find((t) => t.id === params.tenantId);
				if (target) {
					targetUrl = targetUrl || target.api_server_url || undefined;
					if (!apiKey && target.api_server_key_encrypted) {
						apiKey = decryptSecret(target.api_server_key_encrypted);
					}
				}
			} else {
				await initControlPlaneRelationalSchema();
				const rows = await sql`
					SELECT api_server_url, api_server_key_encrypted FROM tenants WHERE id = ${params.tenantId};
				`;
				const first = rows[0];
				if (first) {
					targetUrl = targetUrl || first.api_server_url || undefined;
					if (!apiKey && first.api_server_key_encrypted) {
						apiKey = decryptSecret(first.api_server_key_encrypted);
					}
				}
			}
		} catch (err: any) {
			return {
				success: false,
				error: `Failed to resolve tenant API credentials: ${err.message}`,
			};
		}
	}

	if (!targetUrl) {
		return {
			success: false,
			error: "No API Server URL configured for this tenant.",
		};
	}

	const normalizedBase = normalizeApiUrl(targetUrl);
	if (!normalizedBase) {
		return {
			success: false,
			error: "Invalid API Server URL.",
		};
	}

	if (!apiKey) {
		return {
			success: false,
			error: "API secret key is required to verify server authentication.",
		};
	}

	const startTime = Date.now();

	try {
		// 1. Health & Database Connectivity Check
		const healthResponse = await fetch(`${normalizedBase}/health`, {
			method: "GET",
			signal: AbortSignal.timeout(5000),
		});

		if (!healthResponse.ok) {
			return {
				success: false,
				latencyMs: Date.now() - startTime,
				error: `API Server unreachable: HTTP ${healthResponse.status} ${healthResponse.statusText}`,
			};
		}

		const healthData = (await healthResponse.json().catch(() => ({}))) as any;
		if (healthData.status === "unhealthy") {
			return {
				success: false,
				latencyMs: Date.now() - startTime,
				error: `API Server reachable but database is offline: ${healthData.dbError || "Database error"}`,
			};
		}

		// 2. Authentication Check with provided API Key
		const authResponse = await fetch(`${normalizedBase}/api/master/companies`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(5000),
		});

		const latencyMs = Date.now() - startTime;

		if (authResponse.status === 401) {
			return {
				success: false,
				latencyMs,
				error: "Authentication failed: Invalid API secret key (HTTP 401 Unauthorized)",
			};
		}

		if (!authResponse.ok) {
			const errText = await authResponse.text().catch(() => "");
			return {
				success: false,
				latencyMs,
				error: `Authentication check failed: HTTP ${authResponse.status} ${errText || authResponse.statusText}`,
			};
		}

		return {
			success: true,
			status: "healthy",
			db: healthData.db || "connected",
			latencyMs,
		};
	} catch (err: any) {
		return {
			success: false,
			error:
				err.name === "TimeoutError"
					? "Connection timed out after 5000ms"
					: err.message || "Failed to reach API server",
		};
	}
}

// Backward-compatible alias
export const testDbConnectionAction = testApiServerConnectionAction;
