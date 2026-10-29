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
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session || session.user.role !== "DEVELOPER") {
		redirect("/admin/dashboard");
	}

	const isDevPortal = reqHeaders.get("x-is-dev-portal") === "true";
	const activeTenantId = reqHeaders.get("x-tenant-id");

	let tenants: { id: string; name: string; slug: string }[] = [];
	if (isDevPortal) {
		const { listTenantsAction } = await import("@/modules/control-plane/tenantActions");
		const res = await listTenantsAction();
		if (res.success && res.tenants) {
			tenants = res.tenants.map((t) => ({ id: t.id, name: t.display_name, slug: t.slug }));
		}
	}

	const initialLogs = await getRecentAuditLogs({
		limit: 500,
		tenantId: isDevPortal ? undefined : (activeTenantId || undefined),
	});

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
							Security &amp; Audit Trail
						</h1>
					</div>
					<p className="mt-1 font-medium text-gray-500 text-sm">
						Immutable audit log of authentication cycles, unblock exemptions, export activities, and rate limiting barriers.
					</p>
				</div>
			</div>

			{/* Interactive Table */}
			<AdminAuditTable
				initialLogs={initialLogs}
				isDevPortal={isDevPortal}
				tenants={tenants}
			/>
		</div>
	);
}
