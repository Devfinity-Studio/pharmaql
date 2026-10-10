"use server";

import { db } from "@/server/db";
import { notices } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function saveNotice(
	id: string | null,
	title: string,
	content: string,
	variant: string
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		throw new Error("Unauthorized");
	}

	if (id) {
		await db
			.update(notices)
			.set({
				title,
				content,
				variant,
				updatedAt: new Date(),
			})
			.where(eq(notices.id, id));
	} else {
		await db.insert(notices).values({
			id: crypto.randomUUID(),
			title,
			content,
			isActive: false, // Default to false, they activate it later
			variant,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}

	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}

export async function activateNotice(id: string, expiresAt: Date | null) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		throw new Error("Unauthorized");
	}

	// Deactivate all others
	await db.update(notices).set({ isActive: false }).where(ne(notices.id, id));

	// Activate this one
	await db.update(notices).set({ isActive: true, expiresAt, updatedAt: new Date() }).where(eq(notices.id, id));

	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}

export async function deactivateNotice(id: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		throw new Error("Unauthorized");
	}

	await db.update(notices).set({ isActive: false, updatedAt: new Date() }).where(eq(notices.id, id));

	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}

export async function deleteNotice(id: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		throw new Error("Unauthorized");
	}

	await db.delete(notices).where(eq(notices.id, id));

	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}
