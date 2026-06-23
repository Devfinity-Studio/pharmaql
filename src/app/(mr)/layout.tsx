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
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 text-[#0B2545]">
				<div className="w-full max-w-md space-y-4 rounded-xl border-2 border-gray-200 bg-white p-8 text-center shadow-sm">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
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
								strokeWidth={2.5}
							/>
						</svg>
					</div>
					<h2 className="font-extrabold text-2xl text-[#0B2545]">
						Access Denied
					</h2>
					<p className="font-semibold text-gray-500">
						You have been blocked. Please contact the admin to get unblocked.
					</p>
					<div className="pt-4">
						<Link
							className="font-bold text-[#0071BC] underline underline-offset-4 transition-colors hover:text-[#134074]"
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
		<div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0B2545] md:flex-row">
			{/* Still/Fixed Sidebar Navigation Layer */}
			<aside className="flex w-full flex-col border-gray-200 border-r bg-white p-6 md:sticky md:top-0 md:h-screen md:w-72">
				<div className="mb-10">
					<div className="flex items-center gap-2 font-black text-2xl">
						<Link className="flex gap-2" href="/">
							<span className="text-[#0B2545]">Pharma</span>
							<span className="text-[#0071BC]">QL</span>
						</Link>
					</div>
					<div className="mt-1.5 font-bold text-gray-400 text-xs uppercase tracking-widest">
						MR Portal
					</div>
				</div>

				<nav className="flex flex-col space-y-2">
					<Link
						className="flex items-center gap-3 rounded-lg border-[#0071BC] border-l-4 bg-[#F1F5F9] px-4 py-3 font-bold text-[#0071BC] transition-colors"
						href="/dashboard"
					>
						Reports Overview
					</Link>
				</nav>

				{/* Profile Info and Footer */}
				<div className="mt-auto flex flex-col gap-4 border-gray-200 border-t pt-6">
					<div>
						<div className="font-bold text-[#0B2545] text-sm">
							{session.user.name}
						</div>
						<div className="font-semibold text-gray-400 text-xs">
							{session.user.email}
						</div>
					</div>
					<LogoutButton className="w-full rounded-lg border-2 border-red-200 bg-white px-4 py-2.5 text-center font-bold text-red-600 transition-colors hover:bg-red-50" />
				</div>
			</aside>

			{/* Independent Scrolling Content Workspace */}
			<main className="flex-1 bg-[#F8FAFC] p-4 md:p-10">{children}</main>
		</div>
	);
}
