import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { notices } from "@/server/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import NoticeListClient from "./NoticeListClient";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	const allNotices = await db.select().from(notices).orderBy(desc(notices.createdAt));

	return (
		<div className="mt-4 space-y-8">
			<div>
				<h1 className="font-extrabold text-3xl text-gray-900">
					Notice Board Management
				</h1>
				<p className="mt-2 text-gray-600">
					Manage notices that appear on MR dashboards. You can set up multiple notices and toggle them on or off.
				</p>
			</div>

			<NoticeListClient initialNotices={allNotices} />
		</div>
	);
}
