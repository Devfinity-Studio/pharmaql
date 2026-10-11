import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { legacyDb } from "@/lib/legacy-db";
import { auth } from "@/server/auth";

export default async function AdminDashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		redirect("/login");
	}

	// Fetch live counts from legacy MySQL ERP
	const [mrCountRows] = await legacyDb.query(`
		SELECT COUNT(*) AS total FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` WHERE IsInActive = 0
	`);
	const totalMRs = (mrCountRows as any[])[0]?.total || 0;

	const [companyCountRows] = await legacyDb.query(`
		SELECT COUNT(*) AS total FROM \`pdyasvmaster\`.\`m_mktcompany\` WHERE IsInActive = 0
	`);
	const totalCompanies = (companyCountRows as any[])[0]?.total || 0;

	const [itemCountRows] = await legacyDb.query(`
		SELECT COUNT(*) AS total FROM \`pdyasvmaster\`.\`m_item\` WHERE InActive = 0
	`);
	const totalItems = (itemCountRows as any[])[0]?.total || 0;

	// Company Breakdown
	const [companyRows] = await legacyDb.query(`
		SELECT 
			m.Code AS manufacturer,
			m.Description AS description,
			COUNT(DISTINCT i.ID) AS totalProducts
		FROM \`pdyasvmaster\`.\`m_mktcompany\` m
		LEFT JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON m.Code = l.CompCode
		LEFT JOIN \`pdyasvmaster\`.\`m_item\` i ON i.DivisionId = l.ID AND i.InActive = 0
		WHERE m.IsInActive = 0
		GROUP BY m.Code, m.Description
		ORDER BY totalProducts DESC
		LIMIT 15
	`);
	const manufacturerStats = (companyRows as any[]) || [];

	return (
		<div className="mt-4 space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-extrabold text-3xl text-gray-900">
						Global ERP Management
					</h1>
					<p className="mt-2 font-medium text-gray-500">
						Live statistics from legacy MySQL ERP (`pdyasvmaster` &
						`pdyasvtrans`).
					</p>
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
