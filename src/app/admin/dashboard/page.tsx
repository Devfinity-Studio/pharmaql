import { desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { mrInventory, products, sales, user } from "@/server/db/schema";

export default async function AdminDashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	// Global metrics
	const totalStockResult = await db
		.select({ total: sql<number>`sum(${mrInventory.stock})` })
		.from(mrInventory);
	const totalStock = totalStockResult[0]?.total || 0;

	const totalSalesResult = await db
		.select({ total: sql<number>`sum(${sales.quantity})` })
		.from(sales);
	const totalSales = totalSalesResult[0]?.total || 0;

	// Manufacturer Breakdown
	const manufacturerStats = await db
		.select({
			manufacturer: products.manufacturer,
			totalProducts: sql<number>`count(DISTINCT ${products.id})`,
			totalStock: sql<number>`sum(${mrInventory.stock})`,
		})
		.from(products)
		.leftJoin(mrInventory, eq(products.id, mrInventory.productId))
		.groupBy(products.manufacturer);

	return (
		<div className="mt-4 space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-extrabold text-3xl text-gray-900">
						Global Admin Dashboard
					</h1>
					<p className="mt-2 font-medium text-gray-500">
						Overview of global stock and manufacturer metrics across all MRs.
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
						className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-blue-700"
						href="/admin/ingest"
					>
						Upload CSV
					</Link>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
					<div className="font-bold text-gray-500 text-sm uppercase tracking-wider">
						Total Stock Across MRs (Units)
					</div>
					<div className="mt-2 font-extrabold text-4xl text-blue-600">
						{totalStock}
					</div>
				</div>
				<div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
					<div className="font-bold text-gray-500 text-sm uppercase tracking-wider">
						Total Computed Sales
					</div>
					<div className="mt-2 font-extrabold text-4xl text-green-600">
						{totalSales}
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<h2 className="font-bold text-gray-900 text-xl">
					Manufacturer Breakdown
				</h2>
				<div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
					<table className="min-w-full divide-y divide-gray-100">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-4 text-left font-semibold text-gray-500 text-xs uppercase">
									Manufacturer
								</th>
								<th className="px-6 py-4 text-left font-semibold text-gray-500 text-xs uppercase">
									Products
								</th>
								<th className="px-6 py-4 text-left font-semibold text-gray-500 text-xs uppercase">
									Total Stock (All MRs)
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 bg-white">
							{manufacturerStats.map((stat, idx) => (
								<tr className="transition hover:bg-gray-50" key={idx}>
									<td className="px-6 py-4 font-bold text-gray-900 text-sm">
										{stat.manufacturer}
									</td>
									<td className="px-6 py-4 text-gray-500 text-sm">
										{stat.totalProducts}
									</td>
									<td className="px-6 py-4 font-semibold text-blue-600 text-sm">
										{stat.totalStock || 0}
									</td>
								</tr>
							))}
							{manufacturerStats.length === 0 && (
								<tr>
									<td
										className="px-6 py-8 text-center text-gray-500"
										colSpan={3}
									>
										No products ingested yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
