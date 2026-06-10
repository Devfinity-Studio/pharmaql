import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { products, sales, user } from "@/server/db/schema";
import { desc, sql, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Global metrics
  const totalStockResult = await db.select({ total: sql<number>`sum(${products.stock})` }).from(products);
  const totalStock = totalStockResult[0]?.total || 0;

  const totalSalesResult = await db.select({ total: sql<number>`sum(${sales.quantity})` }).from(sales);
  const totalSales = totalSalesResult[0]?.total || 0;

  // Manufacturer Breakdown
  const manufacturerStats = await db
    .select({
      manufacturer: products.manufacturer,
      totalProducts: sql<number>`count(${products.id})`,
      totalStock: sql<number>`sum(${products.stock})`,
    })
    .from(products)
    .groupBy(products.manufacturer);

  return (
    <div className="space-y-8 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Global Admin Dashboard</h1>
          <p className="text-gray-500 mt-2 font-medium">Overview of global stock and manufacturer metrics.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/admin/mrs" className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 transition">
            Manage MR Access
          </Link>
          <Link href="/admin/ingest" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition">
            Upload CSV
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Stock (Units)</div>
          <div className="mt-2 text-4xl font-extrabold text-blue-600">{totalStock}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Computed Sales</div>
          <div className="mt-2 text-4xl font-extrabold text-green-600">{totalSales}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Manufacturer Breakdown</h2>
        <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Manufacturer</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Products</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Total Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {manufacturerStats.map((stat, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{stat.manufacturer}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{stat.totalProducts}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">{stat.totalStock}</td>
                </tr>
              ))}
              {manufacturerStats.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">No products ingested yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
