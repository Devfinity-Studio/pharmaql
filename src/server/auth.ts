import { cookies } from "next/headers";
import { type SessionUser, verifySessionToken } from "@/lib/jwt";

export const AUTH_COOKIE_NAME = "pharmaql_session";

export interface Session {
	user: SessionUser;
	session: {
		id: string;
		userId: string;
		expiresAt: Date;
	};
}

/**
 * Compatible replacement for Better Auth session getter.
 * Verifies stateless signed JWT cookie without database lookup.
 */
export async function getSession(options?: {
	headers?: Headers;
}): Promise<Session | null> {
	let token: string | undefined;

	if (options?.headers) {
		const cookieHeader = options.headers.get("cookie");
		if (cookieHeader) {
			const match = cookieHeader.match(
				new RegExp(`(?:^|; )${AUTH_COOKIE_NAME}=([^;]*)`),
			);
			if (match?.[1]) token = decodeURIComponent(match[1]);
		}
	}

	if (!token) {
		try {
			const cookieStore = await cookies();
			token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
		} catch {
			// cookies() may not be available in certain environments
		}
	}

	if (!token) return null;

	const user = await verifySessionToken(token);
	if (!user) return null;

	// For MR users, verify they are not blocked by overdue or admin
	if (user.role === "MR") {
		const { evaluateMROverdueStatus } = await import("./actions/overdueEngine");
		const status = await evaluateMROverdueStatus(user.id);
		if (status.isBlocked) {
			return null; // Session immediately invalid
		}
	}

	return {
		user,
		session: {
			id: user.id,
			userId: user.id,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		},
	};
}

export const auth = {
	api: {
		getSession,
	},
};
