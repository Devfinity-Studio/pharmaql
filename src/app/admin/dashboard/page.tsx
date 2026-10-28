import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { auth } from "@/server/auth";
import { DevPlatformDashboard } from "@/components/dev-platform-dashboard";
import { listTenantsAction } from "@/modules/control-plane/tenantActions";
import { getControlPlaneSql } from "@/lib/control-plane-db";
import { getNotices } from "@/server/actions/notices";

export default async function AdminDashboardPage() {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		redirect("/login");
	}

	const isDevPortal = reqHeaders.get("x-is-dev-portal") === "true";

	if (isDevPortal) {
		const tenantsRes = await listTenantsAction();
		const tenants = tenantsRes.success ? tenantsRes.tenants : [];

		let neonConnected = false;
		let neonLatency = 0;
		const sql = getControlPlaneSql();
		if (sql) {
			const start = Date.now();
			try {
				await sql`SELECT 1;`;
				neonConnected = true;
				neonLatency = Date.now() - start;
			} catch {}
		}

		const notices = await getNotices().catch(() => []);

		const host = reqHeaders.get("host") || "localhost:3000";
		const proto = reqHeaders.get("x-forwarded-proto") || "http";
		const clientOrigin = `${proto}://${host}`;

		return (
			<div className="mt-4">
				<DevPlatformDashboard
					tenants={tenants}
					neonStatus={{
						connected: neonConnected,
						latencyMs: neonLatency,
						storageType: sql ? "Neon Postgres" : "Local Data Store",
					}}
					totalNotices={notices.length}
					clientOrigin={clientOrigin}
				/>
			</div>
		);
	}

	// Fetch live counts from standalone Database API for Client Portal
	const statsRes = await apiGet<{
		totalMRs: number;
		totalCompanies: number;
		totalItems: number;
		manufacturerStats: Array<{
			manufacturer: string;
			description: string;
			totalProducts: number;
		}>;
	}>("/api/kpi/dashboard-stats");

	const totalMRs = statsRes.data?.totalMRs || 0;
	const totalCompanies = statsRes.data?.totalCompanies || 0;
	const totalItems = statsRes.data?.totalItems || 0;
	const manufacturerStats = statsRes.data?.manufacturerStats || [];

	return (
		<div className="mt-4 space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-extrabold text-3xl text-gray-900">
						Global ERP Management
					</h1>
				</div>
				<div className="flex flex-wrap gap-4">
					<Link
						className="rounded-xl border border-gray-200 bg-white px-4 py-2 font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
						href="/admin/mrs"
					>
						Manage MR Access
					</Link>
					<Link
						className="rounded-xl border border-gray-200 bg-white px-4 py-2 font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
						href="/admin/companies"
					>
						Companies
					</Link>
					<Link
						className="rounded-xl bg-[#0071BC] px-4 py-2 font-bold text-white shadow-sm transition hover:bg-[#005a96]"
						href="/admin/notices"
					>
						Broadcast Notices
					</Link>
					{session.user.role === "DEVELOPER" && (
						<Link
							className="rounded-xl bg-purple-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-purple-700"
							href="/admin/dev"
						>
							Developer Options
						</Link>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="font-bold text-gray-400 text-xs uppercase tracking-wider">
						Active Medical Representatives
					</div>
					<div className="mt-2 font-extrabold text-4xl text-[#0B2545]">
						{Number(totalMRs).toLocaleString()}
					</div>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="font-bold text-gray-400 text-xs uppercase tracking-wider">
						Active Companies / Divisions
					</div>
					<div className="mt-2 font-extrabold text-4xl text-[#0071BC]">
						{Number(totalCompanies).toLocaleString()}
					</div>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="font-bold text-gray-400 text-xs uppercase tracking-wider">
						Live Catalog Products
					</div>
					<div className="mt-2 font-extrabold text-4xl text-emerald-600">
						{Number(totalItems).toLocaleString()}
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 className="font-bold text-gray-900 text-lg">
					Live Products Breakdown by Marketing Company
				</h2>
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead>
							<tr>
								<th className="px-6 py-3 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">
									Company Code
								</th>
								<th className="px-6 py-3 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">
									Company Name
								</th>
								<th className="px-6 py-3 text-right font-bold text-gray-500 text-xs uppercase tracking-wider">
									Total Active Products
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 bg-white">
							{manufacturerStats.map((stat, i) => (
								<tr className="hover:bg-gray-50" key={i}>
									<td className="whitespace-nowrap px-6 py-4 font-bold text-gray-900 text-sm">
										{stat.manufacturer}
									</td>
									<td className="whitespace-nowrap px-6 py-4 font-medium text-gray-600 text-sm">
										{stat.description || "-"}
									</td>
									<td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-gray-900 text-sm">
										{Number(stat.totalProducts).toLocaleString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
