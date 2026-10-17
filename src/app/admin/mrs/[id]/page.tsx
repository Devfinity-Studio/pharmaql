import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { MrDashboardContent } from "@/components/mr-dashboard-content";
import { getMRInfo } from "@/server/actions/mrInfo";
import { auth } from "@/server/auth";

export default async function AdminMRViewPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
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

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		redirect("/login");
	}

	const { id } = await params;
	const decodedId = decodeURIComponent(id);
	const awaitedParams = await searchParams;
	const cleanParams: Record<string, string> = {};
	for (const [key, value] of Object.entries(awaitedParams)) {
		if (value !== undefined && value !== null && value !== "undefined") {
			cleanParams[key] = value as string;
		}
	}

	const mrInfo = await getMRInfo(decodedId);
	if (!mrInfo) {
		notFound();
	}

	return (
		<Suspense
			fallback={<DashboardSkeleton />}
			key={JSON.stringify(cleanParams)}
		>
			<MrDashboardContent
				isAdminView={true}
				mrId={decodedId}
				searchParams={cleanParams}
			/>
		</Suspense>
	);
}
