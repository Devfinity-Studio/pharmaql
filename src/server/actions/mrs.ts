"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { type MROverride } from "@/lib/permissions";
import { getMRInfo } from "@/server/actions/mrInfo";
import { auth } from "@/server/auth";
import { readServerJson, writeServerJson } from "@/lib/server-storage";

export async function getMROverrides(): Promise<Record<string, MROverride>> {
	const data = await readServerJson<Record<string, MROverride>>("mr_overrides.json", {});
	return data && typeof data === "object" ? data : {};
}

async function saveMROverrides(data: Record<string, MROverride>) {
	await writeServerJson("mr_overrides.json", data);
}

export async function assignManufacturer(
	mrId: string,
	manufacturer: string,
	division?: string | null,
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		return { success: false, error: "Unauthorized" };
	}

	try {
		const allOverrides = await getMROverrides();
		const current = allOverrides[mrId] || {};
		const assigned = current.assignedManufacturers || [];

		if (
			!assigned.some(
				(m) =>
					m.manufacturer === manufacturer && m.division === (division || null),
			)
		) {
			assigned.push({
				id: crypto.randomUUID(),
				manufacturer,
				division: division || null,
			});
			allOverrides[mrId] = { ...current, assignedManufacturers: assigned };
			await saveMROverrides(allOverrides);
		}

		revalidatePath("/admin/mrs");
		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to assign manufacturer" };
	}
}

export async function unassignManufacturer(id: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		return { success: false, error: "Unauthorized" };
	}

	try {
		const allOverrides = await getMROverrides();
		for (const mrId of Object.keys(allOverrides)) {
			const current = allOverrides[mrId];
			if (current?.assignedManufacturers) {
				current.assignedManufacturers = current.assignedManufacturers.filter(
					(m) => m.id !== id,
				);
			}
		}
		await saveMROverrides(allOverrides);
		revalidatePath("/admin/mrs");
		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to unassign manufacturer" };
	}
}

export async function toggleMRBlockStatus(mrId: string, isBlocked: boolean) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		return { success: false, error: "Unauthorized" };
	}

	try {
		const allOverrides = await getMROverrides();
		allOverrides[mrId] = {
			...allOverrides[mrId],
			isBlocked,
		};
		await saveMROverrides(allOverrides);
		revalidatePath("/admin/mrs");
		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to update block status" };
	}
}

export async function updateMRPermissions(
	mrId: string,
	permissions: {
		canViewFreeScheme: boolean;
		canViewStock: boolean;
		canViewSales: boolean;
		canViewPartyWise: boolean;
		canViewProductWise: boolean;
	},
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		return { success: false, error: "Unauthorized" };
	}

	try {
		const allOverrides = await getMROverrides();
		allOverrides[mrId] = {
			...allOverrides[mrId],
			permissions,
		};
		await saveMROverrides(allOverrides);
		revalidatePath("/admin/mrs");
		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to update permissions" };
	}
}

export async function checkActiveSessions(email: string) {
	return { success: true, hasActiveSessions: false };
}

export async function clearOtherSessions() {
	return { success: true };
}

export async function checkMRExists(email: string) {
	try {
		const mr = await getMRInfo(email);
		return !!mr;
	} catch (error) {
		console.error("Failed to check if MR exists", error);
		return false;
	}
}


/**
 * Records the timestamp of when an MR logs in successfully.
 */
export async function recordMRLastLogin(mrId: string) {
	try {
		const allOverrides = await getMROverrides();
		allOverrides[mrId] = {
			...allOverrides[mrId],
			lastLogin: new Date().toISOString(),
		};
		await saveMROverrides(allOverrides);
		return { success: true };
	} catch (error) {
		console.error("Failed to record MR last login:", error);
		return { success: false };
	}
}

