"use server";

import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import path from "path";
import { getMRInfo } from "@/server/actions/mrInfo";
import { auth } from "@/server/auth";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "mr_overrides.json");

export type MRRank = 1 | 2 | 3;

export interface MROverride {
	isBlocked?: boolean;
	rank?: MRRank;
	lastLogin?: string;
	permissions?: {
		canViewFreeScheme: boolean;
		canViewStock: boolean;
		canViewSales: boolean;
		canViewPartyWise: boolean;
		canViewProductWise: boolean;
	};
	assignedManufacturers?: {
		id: string;
		manufacturer: string;
		division: string | null;
	}[];
}

/**
 * Derives strict report permissions according to MR Rank:
 * - Rank 1: Only Stock reports
 * - Rank 2: Stock and Claim Quantity (Free Scheme) reports
 * - Rank 3: All reports (Stock, Free Scheme, Sales, Party Wise, Product Wise)
 */
export function getPermissionsForRank(rank: MRRank) {
	if (rank === 1) {
		return {
			canViewStock: true,
			canViewFreeScheme: false,
			canViewSales: false,
			canViewPartyWise: false,
			canViewProductWise: false,
		};
	}
	if (rank === 2) {
		return {
			canViewStock: true,
			canViewFreeScheme: true,
			canViewSales: false,
			canViewPartyWise: false,
			canViewProductWise: false,
		};
	}
	// Rank 3 (or any higher)
	return {
		canViewStock: true,
		canViewFreeScheme: true,
		canViewSales: true,
		canViewPartyWise: true,
		canViewProductWise: true,
	};
}

export async function getMROverrides(): Promise<Record<string, MROverride>> {
	try {
		const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function saveMROverrides(data: Record<string, MROverride>) {
	await fs.mkdir(path.dirname(OVERRIDES_FILE), { recursive: true });
	await fs.writeFile(OVERRIDES_FILE, JSON.stringify(data, null, 2), "utf-8");
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
 * Updates an MR's rank in local overrides and automatically syncs their strict permissions.
 */
export async function updateMRRank(mrId: string, rank: MRRank) {
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
		const perms = getPermissionsForRank(rank);
		allOverrides[mrId] = {
			...allOverrides[mrId],
			rank,
			permissions: perms,
		};
		await saveMROverrides(allOverrides);
		revalidatePath("/admin/mrs");
		revalidatePath(`/admin/mrs/${mrId}`);
		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to update MR rank" };
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

