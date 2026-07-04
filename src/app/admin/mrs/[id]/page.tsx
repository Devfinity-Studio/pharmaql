import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MrDashboardContent } from "@/components/mr-dashboard-content";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

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

	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	const { id } = await params;
	const decodedId = decodeURIComponent(id);
	console.log("[DEBUG] Admin MR View page: id = ", id, "decodedId = ", decodedId);
	const awaitedParams = await searchParams;
	const cleanParams: Record<string, string> = {};
	for (const [key, value] of Object.entries(awaitedParams)) {
		if (value !== undefined && value !== null && value !== "undefined") {
			cleanParams[key] = value as string;
		}
	}

	const mrArr = await db.select().from(user).where(eq(user.id, decodedId)).limit(1);
	console.log("[DEBUG] Query result for decodedId = ", decodedId, ":", mrArr);
	if (mrArr.length === 0) {
		notFound();
	}

	return (
		<MrDashboardContent
			isAdminView={true}
			mrId={decodedId}
			searchParams={cleanParams}
		/>
	);
}
