"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { readServerJson, writeServerJson } from "@/lib/server-storage";
import { getControlPlaneSql } from "@/lib/control-plane-db";

export interface OverduePolicyConfig {
	disabled: boolean;
	directBlockDays: number;
	divisionBlockDays: number;
	maxDataDays: number | null;
	updatedBy?: string;
	updatedAt?: string;
}

const DEFAULT_POLICY: OverduePolicyConfig = {
	disabled: false,
	directBlockDays: 90,
	divisionBlockDays: 120,
	maxDataDays: null,
};

// In-memory cache to eliminate repetitive queries during tight render/auth loops
let inMemoryPolicyCache: {
	data: OverduePolicyConfig;
	tenantId?: string;
	cachedAt: number;
} | null = null;

const CACHE_TTL_MS = 10 * 1000; // 10 seconds

/**
 * Fast synchronous/async check: Is MR overdue blocking disabled?
 * Checks headers (x-tenant-overdue-blocking), in-memory cache, and persistent storage.
 */
export async function isOverdueBlockingDisabled(overrideTenantId?: string): Promise<boolean> {
	// 1. Check request header set by middleware
	try {
		const h = await headers();
		const headerVal = h.get("x-tenant-overdue-blocking");
		if (headerVal === "disabled") return true;
		if (headerVal === "enabled") return false;
	} catch {
		// Outside active request context (e.g. background job)
	}

	// 2. Fallback to persisted policy config
	const policy = await getOverdueBlockingStatus(overrideTenantId);
	return Boolean(policy.disabled);
}

/**
 * Retrieves the full overdue policy configuration for the active or specified tenant.
 */
export async function getOverdueBlockingStatus(overrideTenantId?: string): Promise<OverduePolicyConfig> {
	let tenantId = overrideTenantId;
	let headerDirect: number | undefined;
	let headerDiv: number | undefined;
	let headerMaxData: number | null | undefined;

	try {
		const h = await headers();
		if (!tenantId) {
			tenantId = h.get("x-tenant-id") || undefined;
		}
		const directH = Number(h.get("x-tenant-overdue-direct"));
		if (!isNaN(directH) && directH > 0) headerDirect = directH;
		const divH = Number(h.get("x-tenant-overdue-division"));
		if (!isNaN(divH) && divH > 0) headerDiv = divH;
		const maxDataH = h.get("x-tenant-max-data-days");
		if (maxDataH !== null && maxDataH !== undefined && maxDataH !== "") {
			const parsed = Number(maxDataH);
			headerMaxData = !isNaN(parsed) && parsed > 0 ? parsed : null;
		}
	} catch {}

	const now = Date.now();
	if (
		inMemoryPolicyCache &&
		inMemoryPolicyCache.tenantId === tenantId &&
		now - inMemoryPolicyCache.cachedAt < CACHE_TTL_MS
	) {
		return inMemoryPolicyCache.data;
	}

	try {
		const policy = await readServerJson<OverduePolicyConfig>(
			"overdue_policy.json",
			{
				...DEFAULT_POLICY,
				...(headerDirect ? { directBlockDays: headerDirect } : {}),
				...(headerDiv ? { divisionBlockDays: headerDiv } : {}),
				...(headerMaxData !== undefined ? { maxDataDays: headerMaxData } : {}),
			},
			tenantId,
		);

		// Ensure defaults if reading an older policy file missing newer fields
		const normalizedPolicy: OverduePolicyConfig = {
			disabled: Boolean(policy.disabled),
			directBlockDays: Number(policy.directBlockDays) || headerDirect || 90,
			divisionBlockDays: Number(policy.divisionBlockDays) || headerDiv || 120,
			maxDataDays:
				policy.maxDataDays !== undefined
					? policy.maxDataDays
					: headerMaxData !== undefined
						? headerMaxData
						: null,
			updatedBy: policy.updatedBy,
			updatedAt: policy.updatedAt,
		};

		inMemoryPolicyCache = {
			data: normalizedPolicy,
			tenantId,
			cachedAt: now,
		};

		return normalizedPolicy;
	} catch (err) {
		console.warn("[OverduePolicy] Failed to load overdue policy:", err);
		return {
			...DEFAULT_POLICY,
			...(headerDirect ? { directBlockDays: headerDirect } : {}),
			...(headerDiv ? { divisionBlockDays: headerDiv } : {}),
			...(headerMaxData !== undefined ? { maxDataDays: headerMaxData } : {}),
		};
	}
}

/**
 * Admin server action: Toggle the MR overdue account blocking switch.
 * Can be executed by ADMIN or DEVELOPER role.
 */
export async function setOverdueBlockingStatusAction(
	disabled: boolean,
): Promise<{ success: boolean; disabled: boolean; error?: string }> {
	const res = await updateTenantPolicyAction({ disabled });
	return {
		success: res.success,
		disabled: res.policy ? res.policy.disabled : disabled,
		error: res.error,
	};
}

/**
 * Admin server action: Update complete tenant overdue and historical data policy settings:
 * - Overdue Account Blocking (Enabled vs. Disabled)
 * - Direct Block Limit (Days, default 90)
 * - Division Cascading Block Limit (Days, default 120)
 * - Max Historical Data Window for MRs (Days, e.g. 60 days, null/0 for unlimited)
 */
export async function updateTenantPolicyAction(input: {
	disabled?: boolean;
	directBlockDays?: number;
	divisionBlockDays?: number;
	maxDataDays?: number | null;
}): Promise<{ success: boolean; policy?: OverduePolicyConfig; error?: string }> {
	let h: Headers;
	try {
		h = await headers();
	} catch {
		h = new Headers();
	}

	const session = await auth.api.getSession({ headers: h });

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		return { success: false, error: "Unauthorized access" };
	}

	const tenantId = h.get("x-tenant-id") || undefined;
	const userEmail = session.user.email || session.user.name || "Admin";

	const current = await getOverdueBlockingStatus(tenantId);

	const newPolicy: OverduePolicyConfig = {
		disabled: input.disabled !== undefined ? Boolean(input.disabled) : current.disabled,
		directBlockDays:
			input.directBlockDays !== undefined
				? Math.max(1, Number(input.directBlockDays) || 90)
				: current.directBlockDays,
		divisionBlockDays:
			input.divisionBlockDays !== undefined
				? Math.max(1, Number(input.divisionBlockDays) || 120)
				: current.divisionBlockDays,
		maxDataDays:
			input.maxDataDays !== undefined
				? input.maxDataDays && Number(input.maxDataDays) > 0
					? Number(input.maxDataDays)
					: null
				: current.maxDataDays,
		updatedBy: userEmail,
		updatedAt: new Date().toISOString(),
	};

	try {
		// 1. Write to server storage (Neon tenant_runtime_config or local file fallback)
		await writeServerJson("overdue_policy.json", newPolicy, tenantId);

		// 2. Also update tenants table directly if Neon is connected and tenantId is known
		const sql = getControlPlaneSql();
		if (sql && tenantId) {
			try {
				await sql`
					UPDATE tenants 
					SET overdue_blocking_disabled = ${newPolicy.disabled},
					    overdue_direct_block_days = ${newPolicy.directBlockDays},
					    overdue_division_block_days = ${newPolicy.divisionBlockDays},
					    max_data_days = ${newPolicy.maxDataDays},
					    updated_at = NOW()
					WHERE id = ${tenantId}::uuid
				`;
			} catch (dbErr) {
				console.warn("[OverduePolicy] Could not update tenants table columns:", dbErr);
			}
		}

		// 3. If local tenants store exists, update local tenant record
		try {
			const { getLocalTenantById, saveLocalTenant } = await import("@/lib/local-tenants-store");
			if (tenantId) {
				const local = await getLocalTenantById(tenantId);
				if (local) {
					await saveLocalTenant({
						...local,
						overdue_blocking_disabled: newPolicy.disabled,
						overdue_direct_block_days: newPolicy.directBlockDays,
						overdue_division_block_days: newPolicy.divisionBlockDays,
						max_data_days: newPolicy.maxDataDays,
					});
				}
			}
		} catch {}

		// 4. Invalidate local in-memory cache
		inMemoryPolicyCache = {
			data: newPolicy,
			tenantId,
			cachedAt: Date.now(),
		};

		// 5. Invalidate Admin and MR paths so UI updates instantly
		try {
			revalidatePath("/admin/dashboard");
			revalidatePath("/admin/mrs");
			revalidatePath("/dashboard");
		} catch {}

		return { success: true, policy: newPolicy };
	} catch (err: any) {
		console.error("[OverduePolicy] Failed to update policy:", err);
		return {
			success: false,
			policy: current,
			error: err.message || "Failed to persist policy change",
		};
	}
}
