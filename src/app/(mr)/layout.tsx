import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function MRLayout({ children }: { children: ReactNode }) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "MR") {
		redirect("/login");
	}

	if ((session.user as any).isBlocked) {
		// If they get blocked mid-session, force logout essentially by redirecting
		// or just show a blocked screen right here
		return (
			<div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
				<div className="w-full max-w-md space-y-4 rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
						<svg
							className="h-8 w-8"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
							/>
						</svg>
					</div>
					<h2 className="font-bold text-2xl text-gray-900">Access Denied</h2>
					<p className="font-medium text-gray-600">
						you have been blocked please contact the admin to get unblocked
					</p>
					<div className="pt-4">
						<Link
							className="font-bold text-blue-600 hover:underline"
							href="/login"
						>
							Return to Login
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
			<aside className="z-10 flex w-full flex-col border-gray-100 border-r bg-white p-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] md:w-72">
				<div className="mb-10">
					<div className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text font-extrabold text-3xl text-transparent tracking-tight">
						PharmaQL
					</div>
					<div className="mt-1 font-bold text-gray-400 text-xs uppercase tracking-widest">
						MR Portal
					</div>
				</div>

				<nav className="flex flex-col space-y-3">
					<Link
						className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-600 transition hover:bg-blue-50 hover:text-blue-700"
						href="/dashboard"
					>
						<span className="h-2 w-2 rounded-full bg-blue-500"></span>
						Reports Overview
					</Link>
				</nav>

				<div className="mt-auto flex flex-col gap-4 border-gray-100 border-t pt-6">
					<div>
						<div className="font-bold text-gray-900 text-sm">
							{session.user.name}
						</div>
						<div className="text-gray-500 text-xs">{session.user.email}</div>
					</div>
					<LogoutButton className="w-full rounded-xl bg-red-50 px-4 py-2.5 text-center font-bold text-red-600 transition hover:bg-red-100" />
				</div>
			</aside>
			<main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-10">
				{children}
			</main>
		</div>
	);
}
