"use server";

import { headers } from "next/headers";
import { auth } from "@/server/auth";

export async function ingestCSV(_formData: FormData) {
	// Verify Admin / Dev Role
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")) {
		return { success: false, error: "Unauthorized. Admin access required." };
	}

	return {
		success: true,
		message: "Live synchronization active: PharmaQL queries local MySQL ERP directly.",
	};
}
