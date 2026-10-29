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
	getLocalTenantById,
	getLocalTenantBySlug,
	saveLocalTenant,
	toggleLocalTenantStatus,
	deleteLocalTenant,
} from "@/lib/local-tenants-store";
import { normalizeApiUrl } from "@/lib/utils";
import { invalidateTenantCache } from "@/lib/tenant-resolver";
import dns from "node:dns/promises";
import {
	addDomainToVercel,
	removeDomainFromVercel,
	getDomainVerification,
	isVercelConfigured,
} from "@/lib/vercel-domain-service";

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
	admin_email?: string | null;
	has_admin_password?: boolean;
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
	admin_email?: string | null;
	admin_password?: string | null; // Raw plaintext to be encrypted
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
				admin_email: r.admin_email,
				has_admin_password: Boolean(r.admin_password_encrypted),
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
				admin_email,
				(admin_password_encrypted IS NOT NULL AND admin_password_encrypted != '') AS has_admin_password,
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
			admin_email: r.admin_email ? String(r.admin_email) : null,
			has_admin_password: Boolean(r.has_admin_password),
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
): Promise<{ success: boolean; id?: string; error?: string; vercelMessage?: string }> {
	try {
		if (!input.slug || !input.slug.trim()) {
			return { success: false, error: "Tenant slug is required." };
		}
		if (!input.display_name || !input.display_name.trim()) {
			return { success: false, error: "Display name is required." };
		}

		const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
		const cleanDomain = input.custom_domain
			?.trim()
			.toLowerCase()
			.replace(/^https?:\/\//i, "")
			.replace(/\/+$/, "") || null;
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

		const adminEmail = input.admin_email?.trim() || null;
		const adminPasswordEncrypted = input.admin_password?.trim()
			? encryptSecret(input.admin_password.trim())
			: null;

		const sql = getControlPlaneSql();

		if (!sql) {
			// Save to local data/tenants.json
			const existingLocal = input.id ? await getLocalTenantById(input.id) : null;
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
				api_server_key_encrypted: apiKeyEncrypted ?? existingLocal?.api_server_key_encrypted ?? null,
				legacy_db_name: legacyDbName,
				erp_software_type: erpSoftwareType,
				comp_no: compNo,
				loc_no: locNo,
				overdue_direct_block_days: directBlockDays,
				overdue_division_block_days: divisionBlockDays,
				admin_email: adminEmail ?? existingLocal?.admin_email ?? null,
				admin_password_encrypted: adminPasswordEncrypted ?? existingLocal?.admin_password_encrypted ?? null,
			};

			const saved = await saveLocalTenant(record);
			invalidateTenantCache(cleanSlug);
			if (cleanDomain) invalidateTenantCache(cleanDomain);
			safeRevalidatePath("/admin/tenants");
			return { success: true, id: saved.id };
		}

		await initControlPlaneRelationalSchema();

		if (input.id) {
			// Update existing tenant in Neon
			if (apiKeyEncrypted && adminPasswordEncrypted) {
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
						admin_email = ${adminEmail},
						admin_password_encrypted = ${adminPasswordEncrypted},
						updated_at = NOW()
					WHERE id = ${input.id};
				`;
			} else if (apiKeyEncrypted) {
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
						admin_email = ${adminEmail},
						updated_at = NOW()
					WHERE id = ${input.id};
				`;
			} else if (adminPasswordEncrypted) {
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
						admin_email = ${adminEmail},
						admin_password_encrypted = ${adminPasswordEncrypted},
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
						admin_email = ${adminEmail},
						updated_at = NOW()
					WHERE id = ${input.id};
				`;
			}

			// Mirror to local store for offline and dev synchronization
			try {
				const existingLocal = await getLocalTenantById(input.id);
				await saveLocalTenant({
					id: input.id,
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
					api_server_key_encrypted: apiKeyEncrypted ?? existingLocal?.api_server_key_encrypted ?? null,
					legacy_db_name: legacyDbName,
					erp_software_type: erpSoftwareType,
					comp_no: compNo,
					loc_no: locNo,
					overdue_direct_block_days: directBlockDays,
					overdue_division_block_days: divisionBlockDays,
					admin_email: adminEmail ?? existingLocal?.admin_email ?? null,
					admin_password_encrypted: adminPasswordEncrypted ?? existingLocal?.admin_password_encrypted ?? null,
				});
			} catch {}

			let vercelMessage: string | undefined;
			if (cleanDomain) {
				try {
					const vRes = await addDomainToVercel(cleanDomain);
					if (vRes.message) vercelMessage = vRes.message;
				} catch {}
			}

			invalidateTenantCache(cleanSlug);
			if (cleanDomain) invalidateTenantCache(cleanDomain);
			safeRevalidatePath("/admin/tenants");
			return { success: true, id: input.id, vercelMessage };
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
					overdue_division_block_days,
					admin_email,
					admin_password_encrypted
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
					${divisionBlockDays},
					${adminEmail},
					${adminPasswordEncrypted}
				)
				RETURNING id;
			`;

			const first = rows[0];
			const newId = first?.id ? String(first.id) : undefined;

			// Mirror to local store for offline and dev synchronization
			if (newId) {
				try {
					await saveLocalTenant({
						id: newId,
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
						admin_email: adminEmail,
						admin_password_encrypted: adminPasswordEncrypted,
					});
				} catch {}
			}

			let vercelMessage: string | undefined;
			if (cleanDomain) {
				try {
					const vRes = await addDomainToVercel(cleanDomain);
					if (vRes.message) vercelMessage = vRes.message;
				} catch {}
			}

			invalidateTenantCache(cleanSlug);
			if (cleanDomain) invalidateTenantCache(cleanDomain);
			safeRevalidatePath("/admin/tenants");
			return { success: true, id: newId, vercelMessage };
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

		invalidateTenantCache();
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
			invalidateTenantCache();
			safeRevalidatePath("/admin/tenants");
			return { success: true };
		}

		await initControlPlaneRelationalSchema();
		const rows = await sql`SELECT custom_domain FROM tenants WHERE id = ${tenantId} LIMIT 1;`;
		const domainToDelete = rows[0]?.custom_domain;

		await sql`DELETE FROM tenants WHERE id = ${tenantId};`;

		if (domainToDelete) {
			try {
				await removeDomainFromVercel(domainToDelete);
			} catch {}
		}

		invalidateTenantCache();
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

export interface DomainStatusResult {
	success: boolean;
	domain: string;
	dnsOk: boolean;
	cnameTargets: string[];
	ipv4Addresses: string[];
	sslOk: boolean;
	vercelConfigured: boolean;
	vercelVerified: boolean;
	recommendations: string[];
	error?: string;
}

/**
 * Live diagnostic check for a custom domain: DNS (CNAME & A), Vercel verification, and SSL handshake.
 */
export async function checkDomainStatusAction(input: {
	tenantId?: string;
	customDomain?: string;
}): Promise<DomainStatusResult> {
	let targetDomain = input.customDomain?.trim() || "";

	if (!targetDomain && input.tenantId) {
		const sql = getControlPlaneSql();
		if (sql) {
			const rows = await sql`SELECT custom_domain FROM tenants WHERE id = ${input.tenantId} LIMIT 1`;
			targetDomain = rows[0]?.custom_domain || "";
		} else {
			const local = (await getLocalTenants()).find((t) => t.id === input.tenantId);
			targetDomain = local?.custom_domain || "";
		}
	}

	const cleanDomain = targetDomain.toLowerCase().replace(/^https?:\/\//i, "").replace(/\/+$/, "").trim();

	if (!cleanDomain) {
		return {
			success: false,
			domain: "",
			dnsOk: false,
			cnameTargets: [],
			ipv4Addresses: [],
			sslOk: false,
			vercelConfigured: isVercelConfigured(),
			vercelVerified: false,
			recommendations: ["Tenant has no custom domain configured."],
			error: "No custom domain provided or configured for this tenant.",
		};
	}

	let cnameTargets: string[] = [];
	let ipv4Addresses: string[] = [];
	let isCnameToVercel = false;
	let isAtoVercel = false;

	// 1. DNS Resolution (CNAME & A records)
	try {
		const cnames = await dns.resolveCname(cleanDomain).catch(() => []);
		cnameTargets = Array.isArray(cnames) ? cnames : [];
		isCnameToVercel = cnameTargets.some(
			(target) =>
				target.toLowerCase().includes("vercel-dns.com") ||
				target.toLowerCase().includes("vercel.app") ||
				target.toLowerCase().endsWith("vercel.com"),
		);
	} catch {}

	try {
		const ips = await dns.resolve4(cleanDomain).catch(() => []);
		ipv4Addresses = Array.isArray(ips) ? ips : [];
		isAtoVercel = ipv4Addresses.some((ip) => ip === "76.76.21.21");
	} catch {}

	let dnsOk = isCnameToVercel || isAtoVercel;

	// 2. Vercel Authoritative Verification
	let vercelVerified = false;
	const vercelConfigured = isVercelConfigured();
	if (vercelConfigured) {
		const vercelCheck = await getDomainVerification(cleanDomain).catch(() => null);
		if (vercelCheck?.verified) {
			vercelVerified = true;
			dnsOk = true;
		}
	}

	// 3. SSL / HTTPS Handshake Probe
	let sslOk = false;
	try {
		const probe = await fetch(`https://${cleanDomain}`, {
			method: "HEAD",
			signal: AbortSignal.timeout(5000),
			redirect: "manual",
		});
		if (probe.status >= 200 && probe.status < 500) {
			sslOk = true;
		}
	} catch (sslErr: any) {
		if (vercelVerified) {
			sslOk = true;
		}
	}

	// 4. Actionable Recommendations Generation
	const recommendations: string[] = [];
	if (!dnsOk) {
		recommendations.push(
			`For subdomains (e.g. portal.domain.com): Add a DNS CNAME record pointing to 'cname.vercel-dns.com'.`,
			`For apex domains (e.g. domain.com): Add a DNS A record pointing to '76.76.21.21'.`,
			`If using Cloudflare: Set Proxy Status to 'DNS Only' (Gray Cloud icon) during initial verification.`,
		);
	} else if (!sslOk) {
		recommendations.push(
			`DNS is pointing correctly! Vercel Let's Encrypt SSL certificate generation is typically completed within 1 to 5 minutes.`,
		);
	} else {
		recommendations.push(
			`Domain is fully configured and secured with an active SSL certificate.`,
		);
	}

	if (!vercelConfigured) {
		recommendations.push(
			`Tip: Configure VERCEL_API_TOKEN and VERCEL_PROJECT_ID in .env to enable instant automatic domain provisioning.`,
		);
	}

	return {
		success: true,
		domain: cleanDomain,
		dnsOk,
		cnameTargets,
		ipv4Addresses,
		sslOk,
		vercelConfigured,
		vercelVerified,
		recommendations,
	};
}

/**
 * Fetches a single tenant by UUID or slug with decrypted secrets for the editor.
 */
export async function getTenantAction(
	id: string,
): Promise<{ success: boolean; tenant?: any; error?: string }> {
	try {
		const sql = getControlPlaneSql();
		let raw: any = null;

		if (!sql) {
			const local = await getLocalTenantById(id);
			if (local) raw = local;
			else {
				const bySlug = await getLocalTenantBySlug(id);
				if (bySlug) raw = bySlug;
			}
		} else {
			await initControlPlaneRelationalSchema();
			const rows = await sql`
				SELECT * FROM tenants WHERE id::text = ${id} OR slug = ${id} LIMIT 1;
			`;
			if (rows.length > 0) raw = rows[0];
		}

		if (!raw) {
			return { success: false, error: "Tenant not found." };
		}

		let decryptedApiKey = "";
		if (raw.api_server_key_encrypted) {
			try {
				decryptedApiKey = decryptSecret(raw.api_server_key_encrypted);
			} catch {}
		}

		let decryptedAdminPassword = "";
		if (raw.admin_password_encrypted) {
			try {
				decryptedAdminPassword = decryptSecret(raw.admin_password_encrypted);
			} catch {}
		}

		const tenant = {
			id: String(raw.id),
			slug: String(raw.slug),
			custom_domain: raw.custom_domain ? String(raw.custom_domain) : null,
			is_active: Boolean(raw.is_active),
			display_name: String(raw.display_name),
			short_name: raw.short_name ? String(raw.short_name) : null,
			logo_url: raw.logo_url ? String(raw.logo_url) : null,
			primary_color: raw.primary_color ? String(raw.primary_color) : "#0B2545",
			accent_color: raw.accent_color ? String(raw.accent_color) : "#134074",
			address: raw.address ? String(raw.address) : null,
			contact_phone: raw.contact_phone ? String(raw.contact_phone) : null,
			contact_email: raw.contact_email ? String(raw.contact_email) : null,
			support_email: raw.support_email ? String(raw.support_email) : null,
			user_email_domain: raw.user_email_domain ? String(raw.user_email_domain) : null,
			gstin: raw.gstin ? String(raw.gstin) : null,
			db_type: "api_server",
			api_server_url: raw.api_server_url ? String(raw.api_server_url) : null,
			api_server_key: decryptedApiKey,
			has_api_key: Boolean(raw.api_server_key_encrypted),
			legacy_db_name: raw.legacy_db_name ? String(raw.legacy_db_name) : "pdyasvmaster",
			erp_software_type: raw.erp_software_type ? String(raw.erp_software_type) : "Technomax",
			comp_no: raw.comp_no !== null && raw.comp_no !== undefined ? Number(raw.comp_no) : 11,
			loc_no: raw.loc_no !== null && raw.loc_no !== undefined ? Number(raw.loc_no) : 11,
			overdue_direct_block_days: Number(raw.overdue_direct_block_days) || 90,
			overdue_division_block_days: Number(raw.overdue_division_block_days) || 95,
			admin_email: raw.admin_email ? String(raw.admin_email) : null,
			admin_password: decryptedAdminPassword,
			has_admin_password: Boolean(raw.admin_password_encrypted),
			created_at: raw.created_at ? new Date(raw.created_at).toISOString() : undefined,
			updated_at: raw.updated_at ? new Date(raw.updated_at).toISOString() : undefined,
		};

		return { success: true, tenant };
	} catch (err: any) {
		console.error("[TenantActions] getTenantAction error:", err);
		return { success: false, error: err.message };
	}
}


