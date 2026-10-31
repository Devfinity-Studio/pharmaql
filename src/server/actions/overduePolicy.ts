"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { readServerJson, writeServerJson } from "@/lib/server-storage";
import { getControlPlaneSql } from "@/lib/control-plane-db";

export interface OverduePolicyConfig {
	disabled: boolean;
	updatedBy?: string;
	updatedAt?: string;
}

const DEFAULT_POLICY: OverduePolicyConfig = {
	disabled: false,
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
	if (!tenantId) {
		try {
			const h = await headers();
			tenantId = h.get("x-tenant-id") || undefined;
		} catch {}
	}

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
			DEFAULT_POLICY,
			tenantId,
		);

		inMemoryPolicyCache = {
			data: policy,
			tenantId,
			cachedAt: now,
		};

		return policy;
	} catch (err) {
		console.warn("[OverduePolicy] Failed to load overdue policy:", err);
		return DEFAULT_POLICY;
	}
}

/**
 * Admin server action: Toggle the MR overdue account blocking switch.
 * Can be executed by ADMIN or DEVELOPER role.
 */
export async function setOverdueBlockingStatusAction(
	disabled: boolean,
): Promise<{ success: boolean; disabled: boolean; error?: string }> {
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
		return { success: false, disabled: !disabled, error: "Unauthorized access" };
	}

	const tenantId = h.get("x-tenant-id") || undefined;
	const userEmail = session.user.email || session.user.name || "Admin";

	const newPolicy: OverduePolicyConfig = {
		disabled: Boolean(disabled),
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
					SET overdue_blocking_disabled = ${Boolean(disabled)},
					    updated_at = NOW()
					WHERE id = ${tenantId}::uuid
				`;
			} catch (dbErr) {
				console.warn("[OverduePolicy] Could not update tenants table column:", dbErr);
			}
		}

		// 3. Invalidate local in-memory cache
		inMemoryPolicyCache = {
			data: newPolicy,
			tenantId,
			cachedAt: Date.now(),
		};

		// 4. Invalidate Admin paths so UI updates instantly
		try {
			revalidatePath("/admin/dashboard");
			revalidatePath("/admin/mrs");
			revalidatePath("/dashboard");
		} catch {}

		return { success: true, disabled: Boolean(disabled) };
	} catch (err: any) {
		console.error("[OverduePolicy] Failed to update overdue policy:", err);
		return {
			success: false,
			disabled: !disabled,
			error: err.message || "Failed to persist policy change",
		};
	}
}

