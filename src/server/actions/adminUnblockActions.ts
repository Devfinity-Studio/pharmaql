"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "mr_overrides.json");

interface UnblockHistoryEntry {
	unblockedAt: string;
	adminEmail: string;
	reason: string;
	exemptionDays?: number;
	exemptionUntil?: string;
}

/**
 * Unblock an MR or grant an exemption, protected strictly by the Admin Password.
 * Validates password against `process.env.ADMIN_PASSWORD`.
 */
export async function secureAdminUnblockMR({
	mrId,
	adminPassword,
	reason,
	exemptionDays = 7,
}: {
	mrId: string;
	adminPassword: string;
	reason: string;
	exemptionDays?: number;
}) {
	// 1. Verify caller session
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) {
		return { success: false, error: "Unauthorized: Admin privileges required." };
	}

	// 2. Validate explicit Admin Password
	const expectedAdminPass = process.env.ADMIN_PASSWORD || "Admin@PharmaQL2026";
	if (!adminPassword || adminPassword.trim() !== expectedAdminPass.trim()) {
		return { success: false, error: "Invalid Admin Password. Access denied." };
	}

	try {
		let allOverrides: Record<string, any> = {};
		try {
			const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
			allOverrides = JSON.parse(raw);
		} catch {
			allOverrides = {};
		}

		const current = allOverrides[mrId] || {};
		const unblockedUntil = new Date(Date.now() + exemptionDays * 24 * 60 * 60 * 1000).toISOString();

		const history: UnblockHistoryEntry[] = current.unblockHistory || [];
		history.unshift({
			unblockedAt: new Date().toISOString(),
			adminEmail: session.user.email,
			reason: reason.trim() || "Administrative override granted",
			exemptionDays,
			exemptionUntil: unblockedUntil,
		});

		allOverrides[mrId] = {
			...current,
			isBlocked: false,
			unblockedUntil,
			exemptionUntil: unblockedUntil,
			unblockHistory: history,
		};

		await fs.mkdir(path.dirname(OVERRIDES_FILE), { recursive: true });
		await fs.writeFile(OVERRIDES_FILE, JSON.stringify(allOverrides, null, 2), "utf-8");

		revalidatePath("/admin/mrs");
		revalidatePath(`/admin/mrs/${mrId}`);
		revalidatePath("/dashboard");

		return {
			success: true,
			message: `MR successfully unblocked with a ${exemptionDays}-day grace exemption until ${unblockedUntil.split("T")[0]}.`,
		};
	} catch (error: any) {
		console.error("[Unblock] Error unblocking MR:", error);
		return { success: false, error: error.message || "Failed to unblock MR." };
	}
}
