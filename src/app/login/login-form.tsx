"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signOut } from "@/lib/auth-client";

export function LoginForm() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const res = await signIn.email({
			email,
			password,
		});

		if (res.error) {
			setError(
				res.error.message || "Failed to sign in. Check your credentials.",
			);
			setLoading(false);
		} else if ((res.data?.user as any)?.isBlocked) {
			// User is blocked, immediately sign them out
			await signOut();
			setError(
				"you have been blocked please contact the admin to get unblocked",
			);
			setLoading(false);
		} else {
			router.push("/");
			router.refresh();
		}
	}

	return (
		<div className="border border-gray-200 bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
			<form className="space-y-6" onSubmit={handleSubmit}>
				<div>
					<label className="block font-medium text-gray-700 text-sm">
						Email address
					</label>
					<div className="mt-1">
						<input
							className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
							onChange={(e) => setEmail(e.target.value)}
							required
							type="email"
							value={email}
						/>
					</div>
				</div>

				<div>
					<label className="block font-medium text-gray-700 text-sm">
						Password
					</label>
					<div className="mt-1">
						<input
							className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
							onChange={(e) => setPassword(e.target.value)}
							required
							type="password"
							value={password}
						/>
					</div>
				</div>

				{error && (
					<div className="relative rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700 text-sm shadow-sm">
						<strong className="font-bold">Error: </strong>
						<span className="block sm:inline">{error}</span>
					</div>
				)}

				<div>
					<button
						className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
						disabled={loading}
						type="submit"
					>
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</div>
			</form>
		</div>
	);
}
