import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { NoticeModal } from "@/components/notice-modal";
import { getLicenseStatus } from "@/lib/license";
import { isFeatureEnabledForRole, isUnderMaintenance } from "@/lib/maintenance";
import { getActiveNotice } from "@/server/actions/notices";
import { auth } from "@/server/auth";

export default async function AdminLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		redirect("/login");
	}

	// 1. License Check: If expired/killswitch active, permit DEVELOPER, redirect ADMIN to /license-expired
	const license = await getLicenseStatus();
	if (license.isBlocked && session.user.role !== "DEVELOPER") {
		redirect("/license-expired");
	}

	// 2. Global Maintenance Check: If active for Admins, render maintenance screen
	const maintenance = await isUnderMaintenance(session.user.role);
	if (maintenance.inMaintenance && session.user.role !== "DEVELOPER") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gray-900 p-4 text-white">
				<div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-500/30 bg-gray-950 p-8 text-center shadow-xl">
					<h2 className="font-extrabold text-2xl text-amber-400">Scheduled Maintenance</h2>
					<p className="text-sm text-gray-300">{maintenance.message}</p>
					{maintenance.estimatedEndTime && (
						<p className="font-mono text-xs text-amber-200">Estimated Completion: {maintenance.estimatedEndTime}</p>
					)}
				</div>
			</div>
		);
	}

	// 3. Active Notice Check for Admin / Developer
	const noticesToggle = await isFeatureEnabledForRole("notices", session.user.role);
	const activeNotice = noticesToggle.enabled
		? await getActiveNotice(session.user.role)
		: null;
	const activeNotices = activeNotice
		? [
				{
					id: activeNotice.id,
					title: activeNotice.title,
					content: activeNotice.content,
					variant: activeNotice.variant,
					isActive: activeNotice.isActive,
					expiresAt: activeNotice.expiresAt
						? new Date(activeNotice.expiresAt)
						: null,
					createdAt: new Date(activeNotice.createdAt),
					updatedAt: new Date(activeNotice.updatedAt),
				},
			]
		: [];

	return (
		<div className="relative flex min-h-screen flex-col bg-gray-50 text-gray-900 md:h-screen md:flex-row md:overflow-hidden">
			<div className="pointer-events-none absolute inset-0 z-0 bg-[url('/devfinity.png')] bg-repeat opacity-[0.03] [background-size:120px]"></div>
			<NoticeModal notices={activeNotices as any} />
			<CollapsibleSidebar
				portal="admin"
				userEmail={session.user.email}
				userName={session.user.name}
				userRole={session.user.role}
			/>
			<main className="relative z-10 flex-1 p-4 md:overflow-y-auto md:p-8">
				{children}
			</main>
		</div>
	);
}
