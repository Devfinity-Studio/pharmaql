import fs from "fs/promises";
import os from "os";
import path from "path";
import { getControlPlaneSql, initControlPlaneRelationalSchema } from "./control-plane-db";

/**
 * Determine the root data directory for offline / local fallback.
 * On Vercel / AWS Lambda, the application bundle at process.cwd() is read-only (EROFS).
 * Only /tmp is writable.
 */
export function getServerDataDir(): string {
	if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
		return path.join(os.tmpdir(), "pharmaql-data");
	}
	return path.join(process.cwd(), "data");
}

/**
 * Returns the resolved path for a given filename in the active server data directory.
 */
export function getServerDataFilePath(filename: string): string {
	return path.join(getServerDataDir(), filename);
}

/**
 * Resolves the active tenant UUID:
 * 1. From request headers (`x-tenant-id`) set by middleware.
 * 2. Fallback to first active tenant in Neon Postgres if outside request context.
 */
async function getActiveTenantId(overrideTenantId?: string): Promise<string | null> {
	if (overrideTenantId) return overrideTenantId;
	try {
		const { headers } = await import("next/headers");
		const h = await headers();
		const headerTenantId = h.get("x-tenant-id");
		if (headerTenantId) return headerTenantId;
	} catch {
		// Not in a request context (e.g. background job or build phase)
	}

	const sql = getControlPlaneSql();
	if (!sql) return null;

	try {
		const rows = await sql`
			SELECT id FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 1
		`;
		const first = rows[0];
		if (first?.id) {
			return first.id as string;
		}
	} catch {
		// Ignore lookup failures during boot
	}

	return null;
}

/**
 * Reads a JSON file or relational state record:
 * - If CONTROL_PLANE_DATABASE_URL is set, queries normalized Neon tables (`tenant_notices`, `tenant_features`, `tenant_licenses`, `tenant_runtime_config`).
 * - Otherwise falls back to local disk storage (data/ or /tmp) with dual-location resolution.
 */
export async function readServerJson<T>(
	filename: string,
	fallback: T,
	overrideTenantId?: string,
): Promise<T> {
	const sql = getControlPlaneSql();

	if (sql) {
		try {
			await initControlPlaneRelationalSchema();
			const isAllTenants = overrideTenantId === "ALL";
			const tenantId = isAllTenants ? null : await getActiveTenantId(overrideTenantId);

			// 1. Relational Mapping for Notices
			if (filename === "notices.json") {
				let rows;
				if (isAllTenants) {
					rows = await sql`
						SELECT id, tenant_id AS "tenantId", title, content, COALESCE(variant, 'info') AS variant, COALESCE(target_audience, 'MR') AS "targetAudience", is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt", COALESCE(updated_at, created_at) AS "updatedAt"
						FROM tenant_notices
						ORDER BY created_at DESC
					`;
				} else if (tenantId) {
					rows = await sql`
						SELECT id, tenant_id AS "tenantId", title, content, COALESCE(variant, 'info') AS variant, COALESCE(target_audience, 'MR') AS "targetAudience", is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt", COALESCE(updated_at, created_at) AS "updatedAt"
						FROM tenant_notices
						WHERE tenant_id IS NULL OR tenant_id = ${tenantId}
						ORDER BY created_at DESC
					`;
				} else {
					rows = await sql`
						SELECT id, tenant_id AS "tenantId", title, content, COALESCE(variant, 'info') AS variant, COALESCE(target_audience, 'MR') AS "targetAudience", is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt", COALESCE(updated_at, created_at) AS "updatedAt"
						FROM tenant_notices
						WHERE tenant_id IS NULL
						ORDER BY created_at DESC
					`;
				}
				if (rows && rows.length > 0) {
					return rows as unknown as T;
				}
			}

			if (tenantId) {

				// 2. Relational Mapping for Feature Toggles
				if (filename === "feature_toggles.json") {
					const rows = await sql`
						SELECT feature_flags
						FROM tenant_features
						WHERE tenant_id = ${tenantId}
					`;
					const first = rows[0];
					if (first?.feature_flags) {
						const flags = first.feature_flags;
						return (flags.toggles || flags) as unknown as T;
					}
				}

				// 3. Relational Mapping for Global Maintenance Config
				if (filename === "maintenance.json") {
					const rows = await sql`
						SELECT maintenance_mode, feature_flags
						FROM tenant_features
						WHERE tenant_id = ${tenantId}
					`;
					const first = rows[0];
					if (first) {
						const flags = first.feature_flags || {};
						const config = flags.maintenanceConfig || {};
						return {
							...fallback,
							...config,
							mode: first.maintenance_mode ? "ALL_USERS" : (config.mode || "DISABLED"),
						} as unknown as T;
					}
				}

				// 4. Relational Mapping for License / Subscription
				if (filename === "license.json") {
					const rows = await sql`
						SELECT status, expires_at, plan_type
						FROM tenant_licenses
						WHERE tenant_id = ${tenantId}
					`;
					const first = rows[0];
					if (first) {
						return {
							...(fallback as any),
							status: first.status,
							expiresAt: first.expires_at ? new Date(first.expires_at).toISOString() : (fallback as any).expiresAt,
							planType: first.plan_type,
						} as unknown as T;
					}
				}

				// 5. Relational Mapping for Runtime Config
				if (filename === "runtime-config.json" || filename === "overdue_policy.json") {
					const rows = await sql`
						SELECT settings
						FROM tenant_runtime_config
						WHERE tenant_id = ${tenantId}
					`;
					const first = rows[0];
					if (first?.settings) {
						if (filename === "overdue_policy.json") {
							return (first.settings.overduePolicy || first.settings) as unknown as T;
						}
						return first.settings as unknown as T;
					}
				}
			}
		} catch (err: any) {
			console.warn(`[ServerStorage] Neon relational read error for ${filename}:`, err.message);
		}
	}

	// Local filesystem fallback (Offline development or no Neon configured)
	const primaryPath = getServerDataFilePath(filename);
	const bundledPath = path.join(process.cwd(), "data", filename);

	// 1. Try reading from primary path
	try {
		const raw = await fs.readFile(primaryPath, "utf-8");
		return JSON.parse(raw) as T;
	} catch {
		// Not found in primary path
	}

	// 2. If primary path is not bundled path, try reading from bundled path
	if (primaryPath !== bundledPath) {
		try {
			const raw = await fs.readFile(bundledPath, "utf-8");
			const parsed = JSON.parse(raw) as T;
			writeServerJson(filename, parsed).catch(() => {});
			return parsed;
		} catch {
			// Not found in bundled path either
		}
	}

	// 3. Fallback
	try {
		await writeServerJson(filename, fallback);
	} catch {
		// Ignore write errors
	}

	return fallback;
}

/**
 * Writes data safely:
 * - If CONTROL_PLANE_DATABASE_URL is set, writes into normalized relational tables.
 * - Otherwise writes atomically to local disk storage.
 */
export async function writeServerJson<T>(
	filename: string,
	data: T,
	overrideTenantId?: string,
): Promise<void> {
	const sql = getControlPlaneSql();

	if (sql) {
		try {
			await initControlPlaneRelationalSchema();
			const tenantId = await getActiveTenantId(overrideTenantId);

			// 1. Relational Notices Sync (supports global notices where tenant_id is null or specific tenant)
			if (filename === "notices.json" && Array.isArray(data)) {
				for (const notice of data as any[]) {
					const noticeId = notice.id || crypto.randomUUID();
					const nTenantId = notice.tenantId !== undefined ? notice.tenantId : (overrideTenantId || tenantId || null);
					await sql`
						INSERT INTO tenant_notices (id, tenant_id, title, content, variant, target_audience, is_active, expires_at, created_at, updated_at)
						VALUES (${noticeId}, ${nTenantId}, ${notice.title || "Notice"}, ${notice.content || ""}, ${notice.variant || "info"}, ${notice.targetAudience || "MR"}, ${notice.isActive ?? true}, ${notice.expiresAt ? new Date(notice.expiresAt) : null}, NOW(), NOW())
						ON CONFLICT (id) DO UPDATE SET
							tenant_id = EXCLUDED.tenant_id,
							title = EXCLUDED.title,
							content = EXCLUDED.content,
							variant = EXCLUDED.variant,
							target_audience = EXCLUDED.target_audience,
							is_active = EXCLUDED.is_active,
							expires_at = EXCLUDED.expires_at,
							updated_at = NOW();
					`;
				}
				return;
			}

			if (tenantId) {

				// 2. Relational Feature Toggles Sync
				if (filename === "feature_toggles.json") {
					await sql`
						INSERT INTO tenant_features (tenant_id, maintenance_mode, feature_flags, updated_at)
						VALUES (${tenantId}, false, ${JSON.stringify({ toggles: data })}, NOW())
						ON CONFLICT (tenant_id) DO UPDATE SET
							feature_flags = jsonb_set(COALESCE(tenant_features.feature_flags, '{}'::jsonb), '{toggles}', ${JSON.stringify(data)}::jsonb),
							updated_at = NOW();
					`;
					return;
				}

				// 3. Relational Maintenance Config Sync
				if (filename === "maintenance.json") {
					const mData = data as any;
					const isMaintenance = mData.mode === "ALL_USERS";
					await sql`
						INSERT INTO tenant_features (tenant_id, maintenance_mode, feature_flags, updated_at)
						VALUES (${tenantId}, ${isMaintenance}, ${JSON.stringify({ maintenanceConfig: data })}, NOW())
						ON CONFLICT (tenant_id) DO UPDATE SET
							maintenance_mode = ${isMaintenance},
							feature_flags = jsonb_set(COALESCE(tenant_features.feature_flags, '{}'::jsonb), '{maintenanceConfig}', ${JSON.stringify(data)}::jsonb),
							updated_at = NOW();
					`;
					return;
				}

				// 4. Relational License Sync
				if (filename === "license.json") {
					const lData = data as any;
					const expiresAt = lData.expiresAt ? new Date(lData.expiresAt) : null;
					await sql`
						INSERT INTO tenant_licenses (tenant_id, status, expires_at, plan_type, updated_at)
						VALUES (${tenantId}, ${lData.status || "ACTIVE"}, ${expiresAt}, ${lData.planType || "ENTERPRISE"}, NOW())
						ON CONFLICT (tenant_id) DO UPDATE SET
							status = EXCLUDED.status,
							expires_at = EXCLUDED.expires_at,
							plan_type = EXCLUDED.plan_type,
							updated_at = NOW();
					`;
					return;
				}

				// 5. Relational Runtime Config Sync
				if (filename === "runtime-config.json" || filename === "overdue_policy.json") {
					if (filename === "overdue_policy.json") {
						await sql`
							INSERT INTO tenant_runtime_config (tenant_id, settings, updated_at)
							VALUES (${tenantId}, ${JSON.stringify({ overduePolicy: data })}, NOW())
							ON CONFLICT (tenant_id) DO UPDATE SET
								settings = jsonb_set(COALESCE(tenant_runtime_config.settings, '{}'::jsonb), '{overduePolicy}', ${JSON.stringify(data)}::jsonb),
								updated_at = NOW();
						`;
					} else {
						await sql`
							INSERT INTO tenant_runtime_config (tenant_id, settings, updated_at)
							VALUES (${tenantId}, ${JSON.stringify(data)}, NOW())
							ON CONFLICT (tenant_id) DO UPDATE SET
								settings = EXCLUDED.settings,
								updated_at = NOW();
						`;
					}
					return;
				}
			}
		} catch (err: any) {
			const isFkError = err?.code === "23503" || err?.message?.includes("foreign key constraint");
			if (!isFkError) {
				console.warn(`[ServerStorage] Neon relational write error for ${filename}:`, err.message);
			}
		}
	}

	// Local filesystem write
	const targetPath = getServerDataFilePath(filename);
	const targetDir = path.dirname(targetPath);

	try {
		await fs.mkdir(targetDir, { recursive: true });
		await fs.writeFile(targetPath, JSON.stringify(data, null, 2), "utf-8");
	} catch (err: any) {
		if (err?.code === "EROFS") {
			try {
				const tmpPath = path.join(os.tmpdir(), "pharmaql-data", filename);
				await fs.mkdir(path.dirname(tmpPath), { recursive: true });
				await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
			} catch (tmpErr) {
				console.warn(`[ServerStorage] Write fallback error for ${filename}:`, tmpErr);
			}
			return;
		}
		console.warn(`[ServerStorage] Write error for ${filename}:`, err?.message || err);
	}
}

/**
 * Delete a notice from Neon database if available.
 */
export async function deleteServerNotice(id: string): Promise<void> {
	const sql = getControlPlaneSql();
	if (sql) {
		try {
			await sql`DELETE FROM tenant_notices WHERE id = ${id}`;
		} catch (err: any) {
			console.warn("[ServerStorage] Failed to delete notice from database:", err.message);
		}
	}
}
