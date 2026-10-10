import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MrDashboardContent } from "@/components/mr-dashboard-content";
import { auth } from "@/server/auth";

import { db } from "@/server/db";
import { notices } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { NoticeModal } from "@/components/notice-modal";

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

	const activeNotices = await db
		.select()
		.from(notices)
		.where(eq(notices.isActive, true));

	return (
		<>
			<NoticeModal notices={activeNotices} />
			<MrDashboardContent
				isAdminView={false}
				mrId={session.user.id}
				searchParams={cleanParams}
			/>
		</>
	);
}
