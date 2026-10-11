import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MrDashboardContent } from "@/components/mr-dashboard-content";
import { auth } from "@/server/auth";
import { getActiveNotice } from "@/server/actions/notices";
import { NoticeModal } from "@/components/notice-modal";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/ui/table-skeleton";

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

	const activeNotice = await getActiveNotice();
	const activeNotices = activeNotice
		? [
				{
					id: activeNotice.id,
					title: activeNotice.title,
					content: activeNotice.content,
					variant: activeNotice.variant,
					isActive: activeNotice.isActive,
					expiresAt: activeNotice.expiresAt ? new Date(activeNotice.expiresAt) : null,
					createdAt: new Date(activeNotice.createdAt),
					updatedAt: new Date(activeNotice.updatedAt),
				},
			]
		: [];

	return (
		<>
			<NoticeModal notices={activeNotices as any} />
			<Suspense
				key={JSON.stringify(cleanParams)}
				fallback={
					<div className="p-4">
						<TableSkeleton rows={10} columns={5} />
					</div>
				}
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
