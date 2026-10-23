import { jwtVerify, SignJWT } from "jose";

function getJwtSecret(): Uint8Array {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		if (process.env.NODE_ENV === "production") {
			throw new Error(
				"SECURITY ERROR: BETTER_AUTH_SECRET must be defined in production environment.",
			);
		}
		return new TextEncoder().encode(
			"pharmaql-local-dev-secret-do-not-use-in-production",
		);
	}
	return new TextEncoder().encode(secret);
}

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: "ADMIN" | "DEVELOPER" | "MR";
	locNo?: string;
	division?: string;
	company?: string;
	companyCode?: string;
	isBlocked?: boolean;
	rank?: 1 | 2 | 3;
	allIds?: string[];
	canViewStock?: boolean;
	canViewSales?: boolean;
	canViewFreeScheme?: boolean;
	canViewPartyWise?: boolean;
	canViewProductWise?: boolean;
}

export async function signSessionToken(
	user: SessionUser,
	expiresIn = "7d",
): Promise<string> {
	return await new SignJWT({ user })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(getJwtSecret());
}

export async function verifySessionToken(
	token: string,
): Promise<SessionUser | null> {
	try {
		const { payload } = await jwtVerify(token, getJwtSecret());
		return (payload.user as SessionUser) || null;
	} catch {
		return null;
	}
}
