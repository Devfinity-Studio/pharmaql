import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function AdminLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	return (
		<div className="relative flex h-screen flex-col overflow-hidden bg-gray-50 text-gray-900 md:flex-row">
			<div className="pointer-events-none absolute inset-0 z-0 bg-[url('/devfinity.png')] bg-repeat opacity-[0.03] [background-size:120px]"></div>
			<aside className="relative z-10 flex w-full flex-col border-gray-800 border-r bg-gray-900 p-4 text-white md:w-64">
				<div className="mb-8 font-bold text-2xl text-white">PharmaQL Admin</div>
				<nav className="flex flex-col space-y-2">
					<Link
						className="rounded p-2 font-medium hover:bg-gray-800"
						href="/admin/dashboard"
					>
						Global Dashboard
					</Link>
					<Link
						className="rounded p-2 font-medium hover:bg-gray-800"
						href="/admin/mrs"
					>
						MR Access Management
					</Link>
				</nav>
				<div className="mt-auto flex flex-col gap-3 border-gray-800 border-t pt-4">
					<div className="text-gray-400 text-sm">
						Logged in as Admin ({session.user.name})
					</div>
					<LogoutButton className="w-full rounded bg-red-600 px-4 py-2 text-center font-bold text-white transition hover:bg-red-700" />
					<div className="mt-2 text-center text-[10px] text-gray-400">
						<p>© {new Date().getFullYear()} PharmaQL. All rights reserved.</p>
						<p className="mt-1 flex items-center justify-center gap-1">
							Made with{" "}
							<span className="cursor-pointer text-red-500 transition-transform duration-200 hover:scale-125">
								❤️
							</span>{" "}
							by{" "}
							<a
								className="inline-block font-bold text-blue-400 transition-all hover:scale-105 hover:text-blue-300"
								href="https://devfinity.net"
								rel="noopener noreferrer"
								target="_blank"
							>
								Devfinity
							</a>
						</p>
					</div>
				</div>
			</aside>
			<main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-8">
				{children}
			</main>
		</div>
	);
}
