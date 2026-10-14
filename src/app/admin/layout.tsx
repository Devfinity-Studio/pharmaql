import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
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
		<div className="relative flex min-h-screen flex-col bg-gray-50 text-gray-900 md:h-screen md:flex-row md:overflow-hidden">
			<div className="pointer-events-none absolute inset-0 z-0 bg-[url('/devfinity.png')] bg-repeat opacity-[0.03] [background-size:120px]"></div>
			<CollapsibleSidebar
				portal="admin"
				userEmail={session.user.email}
				userName={session.user.name}
			/>
			<main className="relative z-10 flex-1 p-4 md:overflow-y-auto md:p-8">
				{children}
			</main>
		</div>
	);
}
