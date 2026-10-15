"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { readServerJson, writeServerJson } from "@/lib/server-storage";

export interface NoticeItem {
	id: string;
	title: string;
	content: string;
	variant: string;
	isActive: boolean;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

async function ensureNoticesFile(): Promise<NoticeItem[]> {
	const data = await readServerJson<NoticeItem[]>("notices.json", []);
	return Array.isArray(data) ? data : [];
}

async function writeNoticesFile(notices: NoticeItem[]) {
	await writeServerJson("notices.json", notices);
}

export async function getNotices(): Promise<NoticeItem[]> {
	return await ensureNoticesFile();
}

export async function getActiveNotice(): Promise<NoticeItem | null> {
	const list = await ensureNoticesFile();
	const now = new Date();
	const active = list.find((n) => {
		if (!n.isActive) return false;
		if (n.expiresAt) {
			const exp = new Date(n.expiresAt);
			if (exp < now) return false;
		}
		return true;
	});
	return active || null;
}

export async function saveNotice(
	id: string | null,
	title: string,
	content: string,
	variant: string,
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		throw new Error("Unauthorized");
	}

	const list = await ensureNoticesFile();
	const nowStr = new Date().toISOString();

	if (id) {
		const idx = list.findIndex((n) => n.id === id);
		const existing = idx !== -1 ? list[idx] : undefined;
		if (existing) {
			list[idx] = {
				...existing,
				title,
				content,
				variant,
				updatedAt: nowStr,
			};
		}
	} else {
		list.unshift({
			id: crypto.randomUUID(),
			title,
			content,
			variant,
			isActive: false,
			expiresAt: null,
			createdAt: nowStr,
			updatedAt: nowStr,
		});
	}

	await writeNoticesFile(list);
	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}

export async function activateNotice(id: string, expiresAt: Date | null) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		throw new Error("Unauthorized");
	}

	const list = await ensureNoticesFile();
	const nowStr = new Date().toISOString();
	const expStr = expiresAt ? expiresAt.toISOString() : null;

	let activatedNotice: NoticeItem | undefined;
	list.forEach((n) => {
		if (n.id === id) {
			n.isActive = true;
			n.expiresAt = expStr;
			n.updatedAt = nowStr;
			activatedNotice = n;
		} else {
			n.isActive = false;
		}
	});

	await writeNoticesFile(list);

	// Automatically dispatch real-time Web Push notification to all MRs
	if (activatedNotice) {
		try {
			const { sendPushToRole } = await import("@/lib/push-notifications");
			const cleanContent = activatedNotice.content.replace(/<[^>]*>/g, "").trim();
			await sendPushToRole("MR", {
				title: `📢 New Circular: ${activatedNotice.title}`,
				body: cleanContent.slice(0, 120) || "Official announcement published. Tap to read.",
				url: "/dashboard",
				category: "NOTICE",
				urgency: "HIGH",
			});
		} catch (err) {
			console.warn("[NoticePush] Push notification dispatch partial error:", err);
		}
	}

	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}

export async function deactivateNotice(id: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		throw new Error("Unauthorized");
	}

	const list = await ensureNoticesFile();
	const nowStr = new Date().toISOString();

	list.forEach((n) => {
		if (n.id === id) {
			n.isActive = false;
			n.updatedAt = nowStr;
		}
	});

	await writeNoticesFile(list);
	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}

export async function deleteNotice(id: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		throw new Error("Unauthorized");
	}

	const list = await ensureNoticesFile();
	const filtered = list.filter((n) => n.id !== id);

	await writeNoticesFile(filtered);
	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}
