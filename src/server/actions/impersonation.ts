"use server";

import { cookies } from "next/headers";
import { auth } from "@/server/auth";

const IMPERSONATE_COOKIE_NAME = "pharmaql_impersonate";

/**
 * Start simulating / viewing-as an MR.
 * Restricted strictly to active DEVELOPER accounts.
 */
export async function startMrImpersonation(mrId: string) {
	const session = await auth.api.getSession();
	const isDev =
		session?.user?.role === "DEVELOPER" ||
		Boolean((session?.user as any)?.originalDeveloper);

	if (!isDev) {
		return { success: false, error: "Unauthorized: Developer session required." };
	}

	const cookieStore = await cookies();
	cookieStore.set(IMPERSONATE_COOKIE_NAME, mrId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 3600, // 1 hour
	});

	return { success: true };
}

/**
 * Stop MR simulation and return back to developer identity.
 */
export async function stopMrImpersonation() {
	const cookieStore = await cookies();
	cookieStore.delete(IMPERSONATE_COOKIE_NAME);
	return { success: true };
}
