import { createAuthClient } from "better-auth/react";

const getBaseUrl = () => {
	let url =
		process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
		process.env.NEXT_PUBLIC_VERCEL_URL ||
		"http://localhost:3000";
	if (url && !url.startsWith("http")) {
		url = `https://${url}`;
	}
	return url;
};

export const authClient = createAuthClient({
	baseURL: getBaseUrl(),
});

export const { signIn, signUp, useSession, signOut } = authClient;
