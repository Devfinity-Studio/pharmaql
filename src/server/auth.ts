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

	// Check if Developer is impersonating an MR
	if (user.role === "DEVELOPER") {
		let impersonateMrId: string | undefined;
		if (options?.headers) {
			const cookieHeader = options.headers.get("cookie");
			if (cookieHeader) {
				const match = cookieHeader.match(/(?:^|; )pharmaql_impersonate=([^;]*)/);
				if (match?.[1]) impersonateMrId = decodeURIComponent(match[1]);
			}
		}

		if (!impersonateMrId) {
			try {
				const cookieStore = await cookies();
				impersonateMrId = cookieStore.get("pharmaql_impersonate")?.value;
			} catch {
				// cookies not available
			}
		}

		if (impersonateMrId) {
			try {
				const { getMRInfo } = await import("./actions/mrInfo");
				const { getPermissionsForRank } = await import("@/lib/permissions");
				const mrDetails = await getMRInfo(impersonateMrId);

				if (mrDetails) {
					const rank = mrDetails.rank || 3;
					const perms = getPermissionsForRank(rank);
					const impersonatedUser: any = {
						id: mrDetails.id,
						name: mrDetails.name || "Simulated MR",
						email: mrDetails.email || "mr@asmee.com",
						role: "MR",
						locNo: mrDetails.locNo || "11",
						division: mrDetails.division || undefined,
						company: mrDetails.company || undefined,
						companyCode: mrDetails.companyCode || undefined,
						isBlocked: false,
						rank,
						canViewStock: perms.canViewStock,
						canViewSales: perms.canViewSales,
						canViewFreeScheme: perms.canViewFreeScheme,
						canViewPartyWise: perms.canViewPartyWise,
						canViewProductWise: perms.canViewProductWise,
						isImpersonating: true,
						originalDeveloper: user,
					};

					return {
						user: impersonatedUser,
						session: {
							id: mrDetails.id,
							userId: mrDetails.id,
							expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
						},
					};
				}
			} catch (err) {
				console.error("[Auth] Error resolving impersonated MR:", err);
			}
		}
	}

	// Check if session has been remotely revoked by Developer/Admin
	const { checkIsSessionRevoked } = await import("@/lib/presence-store");
	const isRevoked = await checkIsSessionRevoked(user.id);
	if (isRevoked) {
		return null; // Session immediately revoked!
	}

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
