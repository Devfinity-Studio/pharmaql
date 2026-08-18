"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { mrManufacturers, user } from "@/server/db/schema";

export async function assignManufacturer(
	mrId: string,
	manufacturer: string,
	division?: string | null,
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		return { success: false, error: "Unauthorized" };
	}

	try {
		const conditions = [
			eq(mrManufacturers.mrId, mrId),
			eq(mrManufacturers.manufacturer, manufacturer),
		];
		if (division) {
			conditions.push(eq(mrManufacturers.division, division));
		}

		const existing = await db
			.select()
			.from(mrManufacturers)
			.where(and(...conditions))
			.limit(1);

		if (existing.length === 0) {
			await db.insert(mrManufacturers).values({
				id: crypto.randomUUID(),
				mrId,
				manufacturer,
				division: division || null,
			});
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

	if (!session || session.user.role !== "ADMIN") {
		return { success: false, error: "Unauthorized" };
	}

	try {
		await db.delete(mrManufacturers).where(eq(mrManufacturers.id, id));
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

	if (!session || session.user.role !== "ADMIN") {
		return { success: false, error: "Unauthorized" };
	}

	try {
		await db.update(user).set({ isBlocked }).where(eq(user.id, mrId));
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

	if (!session || session.user.role !== "ADMIN") {
		return { success: false, error: "Unauthorized" };
	}

	try {
		await db.update(user).set(permissions).where(eq(user.id, mrId));
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

	if (!session || session.user.role !== "ADMIN") {
		throw new Error("Unauthorized");
	}

	try {
		// Explicitly check if the email already exists
		const existingUser = await db.query.user.findFirst({
			where: eq(user.email, email.toLowerCase()),
		});

		if (existingUser) {
			return {
				success: false,
				error: "An account with this email already exists.",
			};
		}

		const newMrId = crypto.randomUUID();

		await db.insert(user).values({
			id: newMrId,
			name,
			email: email.toLowerCase(),
			role: "MR",
			...permissions,
		});

		if (manufacturers.length > 0) {
			await db.insert(mrManufacturers).values(
				manufacturers.map((m) => ({
					id: crypto.randomUUID(),
					mrId: newMrId,
					manufacturer: m.manufacturer,
					division: m.division,
				})),
			);
		}

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
	try {
		const targetUser = await db.query.user.findFirst({
			where: eq(user.email, email.toLowerCase()),
		});

		if (!targetUser || targetUser.role !== "MR") {
			return { success: true, hasActiveSessions: false };
		}

		// Find any sessions for this user that are not expired
		const now = new Date();
		const activeSessions = await db.query.session.findMany({
			where: and(
				eq(schema.session.userId, targetUser.id),
				sql`${schema.session.expiresAt} > ${now}`,
			),
		});

		return { success: true, hasActiveSessions: activeSessions.length > 0 };
	} catch (error) {
		console.error("Failed to check active sessions", error);
		return { success: false, hasActiveSessions: false };
	}
}

export async function clearOtherSessions() {
	try {
		const currentSession = await auth.api.getSession({
			headers: await headers(),
		});

		if (!currentSession) {
			return { success: false, error: "No active session to keep" };
		}

		// Delete all sessions for this user EXCEPT the current one
		await db
			.delete(schema.session)
			.where(
				and(
					eq(schema.session.userId, currentSession.user.id),
					sql`${schema.session.id} != ${currentSession.session.id}`,
				),
			);

		return { success: true };
	} catch (error) {
		console.error("Failed to clear other sessions", error);
		return { success: false, error: "Failed to clear other sessions" };
	}
}

export async function checkMRExists(email: string) {
	try {
		const result = await db.query.user.findFirst({
			where: (users, { eq, and }) =>
				and(eq(users.email, email.toLowerCase()), eq(users.role, "MR")),
		});
		return !!result;
	} catch (error) {
		console.error("Failed to check if MR exists", error);
		return false;
	}
}
