import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { MrDashboardContent } from "@/components/mr-dashboard-content";
import { NoticeModal } from "@/components/notice-modal";
import { getActiveNotices } from "@/server/actions/notices";
import { isFeatureEnabledForRole } from "@/lib/maintenance";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function MRDashboardPage({
	searchParams,
}: {
	searchParams: Promise<{
		division?: string;
		from?: string;
		to?: string;
		tab?: string;
		product?: string;
		party?: string;
		q?: string;
		debug?: string;
	}>;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "MR") {
		redirect("/login");
	}

	const awaitedParams = await searchParams;
	const cleanParams: Record<string, string> = {};
	for (const [key, value] of Object.entries(awaitedParams)) {
		if (value !== undefined && value !== null && value !== "undefined") {
			cleanParams[key] = value as string;
		}
	}

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
		<>
			<NoticeModal notices={activeNotices as any} />
			<Suspense
				fallback={<DashboardSkeleton />}
				key={JSON.stringify(cleanParams)}
			>
				<MrDashboardContent
					isAdminView={false}
					mrId={session.user.id}
					searchParams={cleanParams}
				/>
			</Suspense>
		</>
	);
}
