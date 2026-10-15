import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { AdminAuditTable } from "@/components/admin-audit-table";
import { getRecentAuditLogs } from "@/lib/audit-logger";
import { auth } from "@/server/auth";

export const metadata = {
	title: "Security & Audit Logs | Admin Panel | Asmee Pharma",
};

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "DEVELOPER") {
		redirect("/admin/dashboard");
	}

	const initialLogs = await getRecentAuditLogs({ limit: 500 });

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-1 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0071BC]/10 text-[#0071BC]">
							<Shield className="h-5 w-5" />
						</div>
						<h1 className="font-black text-2xl text-gray-900 tracking-tight">
							Security & Audit Trail
						</h1>
					</div>
					<p className="mt-1 font-medium text-gray-500 text-sm">
						Immutable audit log of authentication cycles, unblock exemptions, export activities, and rate limiting barriers.
					</p>
				</div>
			</div>

			{/* Interactive Table */}
			<AdminAuditTable initialLogs={initialLogs} />
		</div>
	);
}
