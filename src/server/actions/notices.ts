"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { deleteServerNotice, readServerJson, writeServerJson } from "@/lib/server-storage";
import { auth } from "@/server/auth";

export type NoticeTargetAudience =
	| "MR"
	| "ADMIN"
	| "MR_AND_ADMIN"
	| "DEVELOPER"
	| "ALL";

export interface NoticeItem {
	id: string;
	title: string;
	content: string;
	variant: string;
	targetAudience?: NoticeTargetAudience;
	isActive: boolean;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
	tenantId?: string | null;
}

async function ensureNoticesFile(overrideTenantId?: string): Promise<NoticeItem[]> {
	const data = await readServerJson<NoticeItem[]>("notices.json", [], overrideTenantId);
	return Array.isArray(data) ? data : [];
}

async function writeNoticesFile(notices: NoticeItem[]) {
	await writeServerJson("notices.json", notices);
}

export async function getNotices(options?: { overrideTenantId?: string }): Promise<NoticeItem[]> {
	let overrideTenantId = options?.overrideTenantId;
	if (!overrideTenantId) {
		try {
			const reqHeaders = await headers();
			if (reqHeaders.get("x-is-dev-portal") === "true") {
				overrideTenantId = "ALL";
			}
		} catch {}
	}
	return await ensureNoticesFile(overrideTenantId);
}

export async function getActiveNotices(role?: string): Promise<NoticeItem[]> {
	const list = await ensureNoticesFile();
	const now = new Date();
	const activeList = list.filter((n) => {
		if (!n.isActive) return false;
		if (n.expiresAt) {
			const exp = new Date(n.expiresAt);
			if (exp < now) return false;
		}
		if (role) {
			const target: NoticeTargetAudience = n.targetAudience || "MR";
			if (role === "MR") {
				return target === "MR" || target === "MR_AND_ADMIN" || target === "ALL";
			}
			if (role === "ADMIN") {
				return (
					target === "ADMIN" || target === "MR_AND_ADMIN" || target === "ALL"
				);
			}
			if (role === "DEVELOPER") {
				return (
					target === "DEVELOPER" ||
					target === "ALL" ||
					target === "ADMIN" ||
					target === "MR_AND_ADMIN"
				);
			}
		}
		return true;
	});

	// Sort notices: Developer-targeted notices are placed BEFORE admin notices
	activeList.sort((a, b) => {
		const aIsDev = a.targetAudience === "DEVELOPER" ? 1 : 0;
		const bIsDev = b.targetAudience === "DEVELOPER" ? 1 : 0;
		if (aIsDev !== bIsDev) {
			return bIsDev - aIsDev; // Dev notices first
		}
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});

	return activeList;
}

export async function getActiveNotice(role?: string): Promise<NoticeItem | null> {
	const active = await getActiveNotices(role);
	return active[0] || null;
}

export async function saveNotice(
	id: string | null,
	title: string,
	content: string,
	variant: string,
	targetAudience: NoticeTargetAudience = "MR",
	targetTenantId?: string | null,
) {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		throw new Error("Unauthorized");
	}

	// Admins cannot send notices to developers
	if (session.user.role === "ADMIN" && (targetAudience === "DEVELOPER" || targetAudience === "ALL")) {
		throw new Error("Admins are not permitted to send notices to developers.");
	}

	// Determine tenant scope
	let assignedTenantId: string | null = null;
	if (session.user.role === "DEVELOPER") {
		assignedTenantId = targetTenantId ? targetTenantId : null;
	} else {
		// Client admin is locked to their client tenant
		assignedTenantId = (session.user as any).tenantId || reqHeaders.get("x-tenant-id") || null;
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
				targetAudience,
				tenantId: assignedTenantId,
				updatedAt: nowStr,
			};
		}
	} else {
		list.unshift({
			id: crypto.randomUUID(),
			title,
			content,
			variant,
			targetAudience,
			tenantId: assignedTenantId,
			isActive: false,
			expiresAt: null,
			createdAt: nowStr,
			updatedAt: nowStr,
		});
	}

	await writeNoticesFile(list);
	revalidatePath("/admin/notices");
	revalidatePath("/admin/dashboard");
	revalidatePath("/admin/dev");
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
	const targetNotice = list.find((n) => n.id === id);
	if (!targetNotice) {
		throw new Error("Notice not found");
	}

	// Admins cannot activate notices targeted to developers
	if (session.user.role === "ADMIN" && (targetNotice.targetAudience === "DEVELOPER" || targetNotice.targetAudience === "ALL")) {
		throw new Error("Admins are not permitted to send notices to developers.");
	}

	const nowStr = new Date().toISOString();
	const expStr = expiresAt ? expiresAt.toISOString() : null;
	const isDevNotice = targetNotice.targetAudience === "DEVELOPER";

	let activatedNotice: NoticeItem | undefined;
	list.forEach((n) => {
		if (n.id === id) {
			n.isActive = true;
			n.expiresAt = expStr;
			n.updatedAt = nowStr;
			activatedNotice = n;
		} else {
			const nIsDev = n.targetAudience === "DEVELOPER";
			// Notices for DEVS do NOT deactivate active admin notices!
			// Admin notices do NOT deactivate active dev notices!
			if (isDevNotice === nIsDev) {
				n.isActive = false;
			}
		}
	});

	await writeNoticesFile(list);

	// Automatically dispatch real-time Web Push notification to targeted roles
	if (activatedNotice) {
		try {
			const { sendPushToRole } = await import("@/lib/push-notifications");
			const cleanContent = activatedNotice.content.replace(/<[^>]*>/g, "").trim();
			const payload = {
				title: `📢 New Circular: ${activatedNotice.title}`,
				body: cleanContent.slice(0, 120) || "Official announcement published. Tap to read.",
				url: "/dashboard",
				category: "NOTICE" as const,
				urgency: "HIGH" as const,
			};

			const target = activatedNotice.targetAudience || "MR";
			const isSenderAdmin = session.user.role === "ADMIN";

			if (target === "MR" || target === "MR_AND_ADMIN" || target === "ALL") {
				await sendPushToRole("MR", payload);
			}
			if (target === "ADMIN" || target === "MR_AND_ADMIN" || target === "ALL") {
				await sendPushToRole("ADMIN", { ...payload, url: "/admin/dashboard" });
			}
			// Admins cannot push notices to developers
			if (!isSenderAdmin && (target === "DEVELOPER" || target === "ALL")) {
				await sendPushToRole("DEVELOPER", { ...payload, url: "/admin/dev" });
			}
		} catch (err) {
			console.warn("[NoticePush] Push notification dispatch partial error:", err);
		}
	}

	revalidatePath("/admin/notices");
	revalidatePath("/admin/dashboard");
	revalidatePath("/admin/dev");
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

	await deleteServerNotice(id);
	const list = await ensureNoticesFile();
	const filtered = list.filter((n) => n.id !== id);

	await writeNoticesFile(filtered);
	revalidatePath("/admin/notices");
	revalidatePath("/dashboard");
	return { success: true };
}
