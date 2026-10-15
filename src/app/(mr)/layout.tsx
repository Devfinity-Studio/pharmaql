import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { MrMobileNav } from "@/components/mr-mobile-nav";
import { getLicenseStatus } from "@/lib/license";
import { isUnderMaintenance } from "@/lib/maintenance";
import { auth } from "@/server/auth";

export default async function MRLayout({ children }: { children: ReactNode }) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "MR") {
		redirect("/login");
	}

	// 1. License Check: If expired/killswitch active, redirect to /license-expired
	const license = await getLicenseStatus();
	if (license.isBlocked && !(session.user as any).originalDeveloper) {
		redirect("/license-expired");
	}

	// 2. Global Maintenance Check: If active for MRs, render maintenance screen
	const maintenance = await isUnderMaintenance(session.user.role);
	if (maintenance.inMaintenance && !(session.user as any).originalDeveloper) {
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

	const isImpersonating = Boolean((session.user as any).isImpersonating);

	return (
		<div className="relative flex flex-col h-screen overflow-hidden bg-[#F8FAFC] text-[#0B2545]">
			<OfflineIndicator mrId={session.user.id} mrName={session.user.name} />
			<PwaInstallPrompt />
			{isImpersonating && (
				<ImpersonationBanner
					mrId={session.user.id}
					mrName={session.user.name}
					rank={session.user.rank}
				/>
			)}
			<div className="relative flex flex-1 overflow-y-auto md:overflow-hidden flex-col md:flex-row pb-16 md:pb-0">
				<div className="pointer-events-none absolute inset-0 z-0 bg-[url('/devfinity.png')] bg-repeat opacity-[0.03] [background-size:120px]"></div>
				<CollapsibleSidebar
					portal="mr"
					userEmail={session.user.email}
					userName={session.user.name}
					userRole={session.user.role}
				/>

				{/* Independent Scrolling Content Workspace */}
				<main className="relative z-10 flex-1 overflow-y-auto bg-[#F8FAFC] p-4 md:p-10">
					{children}
				</main>
			</div>
			<MrMobileNav mrId={session.user.id} mrName={session.user.name} />
		</div>
	);
}
