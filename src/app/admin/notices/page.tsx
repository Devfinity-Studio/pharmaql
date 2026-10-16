import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getNotices } from "@/server/actions/notices";
import { auth } from "@/server/auth";
import NoticeListClient from "./NoticeListClient";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		redirect("/login");
	}

	const allNoticesRaw = await getNotices();
	const allNotices = allNoticesRaw.map((n) => ({
		id: n.id,
		title: n.title,
		content: n.content,
		variant: n.variant,
		targetAudience: n.targetAudience || "MR",
		isActive: n.isActive,
		expiresAt: n.expiresAt ? new Date(n.expiresAt) : null,
		createdAt: new Date(n.createdAt),
		updatedAt: new Date(n.updatedAt),
	}));

	return (
		<div className="mt-4 space-y-8">
			<div>
				<h1 className="font-extrabold text-3xl text-gray-900">
					Notice Board &amp; Circulars
				</h1>
				<p className="mt-2 text-gray-600">
					Broadcast announcements and official circulars across the platform. You can target specific audiences (MRs only, Admins only, MRs &amp; Admins, or Everyone) and toggle scheduling.
				</p>
			</div>

			<NoticeListClient initialNotices={allNotices as any} userRole={session.user.role} />
		</div>
	);
}
