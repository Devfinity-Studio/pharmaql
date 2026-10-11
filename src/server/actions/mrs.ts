"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getMRInfo } from "@/server/actions/mrInfo";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "mr_overrides.json");

export interface MROverride {
	isBlocked?: boolean;
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

	if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) {
		return { success: false, error: "Unauthorized" };
	}

	try {
		const allOverrides = await getMROverrides();
		const current = allOverrides[mrId] || {};
		const assigned = current.assignedManufacturers || [];

		if (!assigned.some((m) => m.manufacturer === manufacturer && m.division === (division || null))) {
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

	if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) {
		return { success: false, error: "Unauthorized" };
	}

	try {
		const allOverrides = await getMROverrides();
		for (const mrId of Object.keys(allOverrides)) {
			const current = allOverrides[mrId];
			if (current?.assignedManufacturers) {
				current.assignedManufacturers = current.assignedManufacturers.filter((m) => m.id !== id);
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

	if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) {
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

	if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) {
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

export async function createMR(
	name: string,
	email: string,
	permissions: {
		canViewFreeScheme: boolean;
		canViewStock: boolean;
		canViewSales: boolean;
		canViewPartyWise: boolean;
		canViewProductWise: boolean;
	},
	manufacturers: { manufacturer: string; division: string | null }[],
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) {
		throw new Error("Unauthorized");
	}

	try {
		const existingMR = await getMRInfo(email);
		if (existingMR) {
			return {
				success: false,
				error: "An MR with this email already exists in legacy ERP.",
			};
		}

		// Store custom MR registration in overrides
		const newMrId = `custom_${Date.now()}`;
		const allOverrides = await getMROverrides();
		allOverrides[newMrId] = {
			isBlocked: false,
			permissions,
			assignedManufacturers: manufacturers.map((m) => ({
				id: crypto.randomUUID(),
				manufacturer: m.manufacturer,
				division: m.division,
			})),
		};
		await saveMROverrides(allOverrides);

		revalidatePath("/admin/mrs");
		return { success: true };
	} catch (error) {
		console.error("Failed to create MR", error);
		return {
			success: false,
			error: "An unexpected error occurred while creating the MR.",
		};
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
