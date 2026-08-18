import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const getBaseUrl = () => {
	if (typeof window !== "undefined") return window.location.origin;
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
	plugins: [emailOTPClient()],
});

export const { signIn, signUp, useSession, signOut, emailOtp } = authClient;
