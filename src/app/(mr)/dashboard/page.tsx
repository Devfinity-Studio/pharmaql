import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { products, sales, mrManufacturers } from "@/server/db/schema";
import { eq, inArray, sql, desc, and } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function MRDashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "MR") {
    redirect("/login");
  }

  // 1. Get MR's assigned manufacturers
  const assigned = await db.select().from(mrManufacturers).where(eq(mrManufacturers.mrId, session.user.id));
  const manufacturerNames = assigned.map(a => a.manufacturer);

  if (manufacturerNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="text-3xl font-extrabold text-gray-900">No Data Assigned</h2>
        <p className="mt-4 text-gray-500 font-medium max-w-md">Your administrator has not assigned any manufacturers to your account yet. Please contact your admin for access.</p>
      </div>
    );
  }

  // 2. Get Products belonging to these manufacturers
  const accessibleProducts = await db.select().from(products).where(inArray(products.manufacturer, manufacturerNames));
  const productIds = accessibleProducts.map(p => p.id);

  let totalSales = 0;
  let productReports: any[] = [];
  let monthlyReports: any[] = [];
  let quarterlyReports: any[] = [];
  let yearlyReports: any[] = [];

  if (productIds.length > 0) {
    // 3. Get all sales for these products
    const accessibleSales = await db
      .select({
        productId: sales.productId,
        productName: products.name,
        quantity: sales.quantity,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .innerJoin(products, eq(sales.productId, products.id))
      .where(inArray(sales.productId, productIds));

    // Calculate metrics in memory (or could be done via SQL group by, but in-memory is fine for this scale)
    const productMap = new Map<string, { name: string, total: number }>();
    const monthMap = new Map<string, number>();
    const quarterMap = new Map<string, number>();
    const yearMap = new Map<string, number>();

    accessibleSales.forEach(sale => {
      totalSales += sale.quantity;

      // Product-wise
      const pData = productMap.get(sale.productId) || { name: sale.productName, total: 0 };
      pData.total += sale.quantity;
      productMap.set(sale.productId, pData);

      // Time-based parsing
      const date = new Date(sale.createdAt);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      const quarter = `Q${Math.floor(date.getMonth() / 3) + 1} ${year}`;

      monthMap.set(month, (monthMap.get(month) || 0) + sale.quantity);
      quarterMap.set(quarter, (quarterMap.get(quarter) || 0) + sale.quantity);
      yearMap.set(year, (yearMap.get(year) || 0) + sale.quantity);
    });

    productReports = Array.from(productMap.values()).sort((a, b) => b.total - a.total);
    monthlyReports = Array.from(monthMap.entries()).map(([time, qty]) => ({ time, qty }));
    quarterlyReports = Array.from(quarterMap.entries()).map(([time, qty]) => ({ time, qty }));
    yearlyReports = Array.from(yearMap.entries()).map(([time, qty]) => ({ time, qty }));
  }

  return (
    <div className="space-y-8 mt-4">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">Your Reports Dashboard</h1>
        <p className="text-gray-500 mt-2 font-medium">Viewing aggregated sales data for: <span className="text-blue-600 font-bold">{manufacturerNames.join(", ")}</span></p>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-blue-100 font-bold tracking-wider uppercase text-sm mb-2">Total Assigned Sales Volume</div>
          <div className="text-5xl font-extrabold">{totalSales.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Product-wise Report */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Product-Wise Report</h2>
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Total Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {productReports.length === 0 ? (
                  <tr><td colSpan={2} className="px-6 py-8 text-center text-gray-500">No sales data found.</td></tr>
                ) : productReports.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600 text-right">{p.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time-based Reports */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Monthly Performance</h2>
            <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <tbody className="divide-y divide-gray-100 bg-white">
                  {monthlyReports.length === 0 ? (
                    <tr><td className="px-6 py-4 text-center text-gray-500">No data</td></tr>
                  ) : monthlyReports.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{r.time}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-blue-600 text-right">{r.qty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Quarterly</h2>
              <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {quarterlyReports.length === 0 ? (
                      <tr><td className="px-4 py-3 text-center text-gray-500 text-sm">No data</td></tr>
                    ) : quarterlyReports.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.time}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-indigo-600 text-right">{r.qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Yearly</h2>
              <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {yearlyReports.length === 0 ? (
                      <tr><td className="px-4 py-3 text-center text-gray-500 text-sm">No data</td></tr>
                    ) : yearlyReports.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.time}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-purple-600 text-right">{r.qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
