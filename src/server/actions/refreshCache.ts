"use server";

import { apiPost, invalidateApiClientCache } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function refreshAllCaches(): Promise<{
	success: boolean;
	message: string;
}> {
	try {
		// 1. Invalidate Next.js in-memory client cache
		invalidateApiClientCache();

		// 2. Request on-premise bridge to flush its statement cache
		await apiPost("/api/cache/flush", {}).catch(() => {});

		// 3. Revalidate dashboard paths
		revalidatePath("/dashboard");
		revalidatePath("/admin");

		return { success: true, message: "Cache refreshed successfully" };
	} catch (err: any) {
		return {
			success: false,
			message: err?.message || "Failed to refresh cache",
		};
	}
}
