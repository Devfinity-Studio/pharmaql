import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET_STRING =
	process.env.BETTER_AUTH_SECRET ||
	"pharmaql-stateless-jwt-secret-key-2026-secure-token-vault";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET_STRING);

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
		.sign(SECRET_KEY);
}

export async function verifySessionToken(
	token: string,
): Promise<SessionUser | null> {
	try {
		const { payload } = await jwtVerify(token, SECRET_KEY);
		return (payload.user as SessionUser) || null;
	} catch {
		return null;
	}
}
