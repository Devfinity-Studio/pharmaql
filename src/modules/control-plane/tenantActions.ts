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
} from "@/lib/control-plane-db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

export interface TenantListItem {
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
	api_server_url?: string | null;
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
	address?: string | null;
	contact_phone?: string | null;
	contact_email?: string | null;
	gstin?: string | null;
	db_type?: "postgres" | "api_server";
	db_connection?: string | null; // Raw plaintext to be encrypted
	api_server_url?: string | null;
	api_server_key?: string | null; // Raw plaintext to be encrypted
}

export interface DbPingResult {
	success: boolean;
	db?: string;
	version?: string;
	latencyMs?: number;
	error?: string;
}

/**
 * Lists all registered tenants from the Neon Control Plane database.
 * Sensitive database URIs and API keys are not exposed to the client;
 * instead boolean indicators (has_db_connection, has_api_key) are returned.
 */
export async function listTenantsAction(): Promise<{
	success: boolean;
	tenants: TenantListItem[];
	error?: string;
}> {
	try {
		await initControlPlaneRelationalSchema();
		const sql = getControlPlaneSql();
		if (!sql) {
			return {
				success: true,
				tenants: [],
			};
		}

		const rows = await sql`
			SELECT 
				id,
				slug,
				custom_domain,
				is_active,
				display_name,
				short_name,
				logo_url,
				address,
				contact_phone,
				contact_email,
				gstin,
				db_type,
				api_server_url,
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
			address: r.address ? String(r.address) : null,
			contact_phone: r.contact_phone ? String(r.contact_phone) : null,
			contact_email: r.contact_email ? String(r.contact_email) : null,
			gstin: r.gstin ? String(r.gstin) : null,
			db_type: (r.db_type as "postgres" | "api_server") || "postgres",
			api_server_url: r.api_server_url ? String(r.api_server_url) : null,
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
 * Creates or updates a tenant in the Neon Control Plane database.
 * Encrypts sensitive secrets (db_connection, api_server_key) using AES-256-GCM before saving.
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

		await initControlPlaneRelationalSchema();
		const sql = getControlPlaneSql();
		if (!sql) {
			return {
				success: false,
				error: "CONTROL_PLANE_DATABASE_URL is not configured.",
			};
		}

		const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
		const cleanDomain = input.custom_domain?.trim().toLowerCase() || null;
		const displayName = input.display_name.trim();
		const shortName = input.short_name?.trim() || null;
		const logoUrl = input.logo_url?.trim() || null;
		const address = input.address?.trim() || null;
		const phone = input.contact_phone?.trim() || null;
		const email = input.contact_email?.trim() || null;
		const gstin = input.gstin?.trim().toUpperCase() || null;
		const dbType = input.db_type || "postgres";
		const apiServerUrl = input.api_server_url?.trim() || null;
		const isActive = input.is_active ?? true;

		const dbConnEncrypted = input.db_connection?.trim()
			? encryptSecret(input.db_connection.trim())
			: null;

		const apiKeyEncrypted = input.api_server_key?.trim()
			? encryptSecret(input.api_server_key.trim())
			: null;

		if (input.id) {
			// Update existing tenant
			if (dbConnEncrypted && apiKeyEncrypted) {
				await sql`
					UPDATE tenants SET
						slug = ${cleanSlug},
						custom_domain = ${cleanDomain},
						is_active = ${isActive},
						display_name = ${displayName},
						short_name = ${shortName},
						logo_url = ${logoUrl},
						address = ${address},
						contact_phone = ${phone},
						contact_email = ${email},
						gstin = ${gstin},
						db_type = ${dbType},
						db_connection_encrypted = ${dbConnEncrypted},
						api_server_url = ${apiServerUrl},
						api_server_key_encrypted = ${apiKeyEncrypted},
						updated_at = NOW()
					WHERE id = ${input.id};
				`;
			} else if (dbConnEncrypted) {
				await sql`
					UPDATE tenants SET
						slug = ${cleanSlug},
						custom_domain = ${cleanDomain},
						is_active = ${isActive},
						display_name = ${displayName},
						short_name = ${shortName},
						logo_url = ${logoUrl},
						address = ${address},
						contact_phone = ${phone},
						contact_email = ${email},
						gstin = ${gstin},
						db_type = ${dbType},
						db_connection_encrypted = ${dbConnEncrypted},
						api_server_url = ${apiServerUrl},
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
						address = ${address},
						contact_phone = ${phone},
						contact_email = ${email},
						gstin = ${gstin},
						db_type = ${dbType},
						api_server_url = ${apiServerUrl},
						api_server_key_encrypted = ${apiKeyEncrypted},
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
						address = ${address},
						contact_phone = ${phone},
						contact_email = ${email},
						gstin = ${gstin},
						db_type = ${dbType},
						api_server_url = ${apiServerUrl},
						updated_at = NOW()
					WHERE id = ${input.id};
				`;
			}

			safeRevalidatePath("/admin/tenants");
			return { success: true, id: input.id };
		} else {
			// Insert new tenant
			const rows = await sql`
				INSERT INTO tenants (
					slug,
					custom_domain,
					is_active,
					display_name,
					short_name,
					logo_url,
					address,
					contact_phone,
					contact_email,
					gstin,
					db_type,
					db_connection_encrypted,
					api_server_url,
					api_server_key_encrypted
				) VALUES (
					${cleanSlug},
					${cleanDomain},
					${isActive},
					${displayName},
					${shortName},
					${logoUrl},
					${address},
					${phone},
					${email},
					${gstin},
					${dbType},
					${dbConnEncrypted},
					${apiServerUrl},
					${apiKeyEncrypted}
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
		await initControlPlaneRelationalSchema();
		const sql = getControlPlaneSql();
		if (!sql) {
			return { success: false, error: "Database not configured." };
		}

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
 * Permanently deletes a tenant and cascades to child relational state tables.
 */
export async function deleteTenantAction(
	tenantId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await initControlPlaneRelationalSchema();
		const sql = getControlPlaneSql();
		if (!sql) {
			return { success: false, error: "Database not configured." };
		}

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
 * Accepts either an existing tenantId (decrypts stored connection string)
 * or a raw connection URI (from the registration modal pre-save).
 * Runs `SELECT current_database(), version();` and returns latency in ms.
 */
export async function testDbConnectionAction(params: {
	tenantId?: string;
	rawDbConnection?: string;
}): Promise<DbPingResult> {
	let connectionString = params.rawDbConnection?.trim();

	if (!connectionString && params.tenantId) {
		try {
			await initControlPlaneRelationalSchema();
			const sql = getControlPlaneSql();
			if (!sql) {
				return { success: false, error: "Control plane database is not configured." };
			}

			const rows = await sql`
				SELECT db_connection_encrypted FROM tenants WHERE id = ${params.tenantId};
			`;

			const first = rows[0];
			if (first?.db_connection_encrypted) {
				connectionString = decryptSecret(first.db_connection_encrypted);
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
