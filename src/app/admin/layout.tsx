import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { NoticeModal } from "@/components/notice-modal";
import { getLicenseStatus } from "@/lib/license";
import { isFeatureEnabledForRole, isUnderMaintenance } from "@/lib/maintenance";
import { getActiveNotices } from "@/server/actions/notices";
import { auth } from "@/server/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { FloatingFeedbackButton } from "@/components/floating-feedback-button";

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
	const activeNoticesList = noticesToggle.enabled
		? await getActiveNotices(session.user.role)
		: [];
	const activeNotices = activeNoticesList.map((notice) => ({
		id: notice.id,
		title: notice.title,
		content: notice.content,
		variant: notice.variant,
		targetAudience: notice.targetAudience,
		isActive: notice.isActive,
		expiresAt: notice.expiresAt
			? new Date(notice.expiresAt)
			: null,
		createdAt: new Date(notice.createdAt),
		updatedAt: new Date(notice.updatedAt),
	}));

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
				<ErrorBoundary>
					{children}
				</ErrorBoundary>
			</main>
			<FloatingFeedbackButton />
		</div>
	);
}
