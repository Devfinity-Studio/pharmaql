import { db } from "@/server/db";
import { products, sales, mrManufacturers, user } from "@/server/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import Link from "next/link";

export async function MrDashboardContent({
  mrId,
  searchParams,
  isAdminView = false,
}: {
  mrId: string;
  searchParams?: { company?: string };
  isAdminView?: boolean;
}) {
  // 1. Get MR Info (for Admin View)
  const mrInfoArr = await db
    .select()
    .from(user)
    .where(eq(user.id, mrId))
    .limit(1);
  const mrInfo = mrInfoArr[0];

  if (!mrInfo) {
    return (
      <div className="text-red-500 font-bold p-8 text-center">
        MR not found.
      </div>
    );
  }

  // 2. Get MR's assigned manufacturers
  const assigned = await db
    .select()
    .from(mrManufacturers)
    .where(eq(mrManufacturers.mrId, mrId));
  const manufacturerNames = assigned.map((a) => a.manufacturer);

  if (manufacturerNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="text-3xl font-extrabold text-gray-900">
          No Data Assigned
        </h2>
        <p className="mt-4 text-gray-500 font-medium max-w-md">
          {isAdminView
            ? `You have not assigned any manufacturers to ${mrInfo.name}.`
            : "Your administrator has not assigned any manufacturers to your account yet. Please contact your admin for access."}
        </p>
      </div>
    );
  }

  // 3. Filter by Company Tab
  const selectedCompany = searchParams?.company || "All";
  const companiesToQuery =
    selectedCompany === "All" ? manufacturerNames : [selectedCompany];

  // 4. Get Products belonging to these queried manufacturers
  const accessibleProducts = await db
    .select()
    .from(products)
    .where(inArray(products.manufacturer, companiesToQuery));
  const productIds = accessibleProducts.map((p) => p.id);

  let totalSales = 0;
  let productReports: any[] = [];
  let monthlyReports: any[] = [];
  let quarterlyReports: any[] = [];
  let yearlyReports: any[] = [];

  if (productIds.length > 0) {
    // 5. Get all sales for these products and specifically for this MR!
    const accessibleSales = await db
      .select({
        productId: sales.productId,
        productName: products.name,
        quantity: sales.quantity,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .innerJoin(products, eq(sales.productId, products.id))
      .where(and(inArray(sales.productId, productIds), eq(sales.mrId, mrId)));

    // Calculate metrics
    const productMap = new Map<string, { name: string; total: number }>();
    const monthMap = new Map<string, number>();
    const quarterMap = new Map<string, number>();
    const yearMap = new Map<string, number>();

    accessibleSales.forEach((sale) => {
      totalSales += sale.quantity;

      // Product-wise
      const pData = productMap.get(sale.productId) || {
        name: sale.productName,
        total: 0,
      };
      pData.total += sale.quantity;
      productMap.set(sale.productId, pData);

      // Time-based parsing
      const date = new Date(sale.createdAt);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      const quarter = `Q${Math.floor(date.getMonth() / 3) + 1} ${year}`;

      monthMap.set(month, (monthMap.get(month) || 0) + sale.quantity);
      quarterMap.set(quarter, (quarterMap.get(quarter) || 0) + sale.quantity);
      yearMap.set(year, (yearMap.get(year) || 0) + sale.quantity);
    });

    productReports = Array.from(productMap.values()).sort(
      (a, b) => b.total - a.total,
    );
    monthlyReports = Array.from(monthMap.entries()).map(([time, qty]) => ({
      time,
      qty,
    }));
    quarterlyReports = Array.from(quarterMap.entries()).map(([time, qty]) => ({
      time,
      qty,
    }));
    yearlyReports = Array.from(yearMap.entries()).map(([time, qty]) => ({
      time,
      qty,
    }));
  }

  const baseUrl = isAdminView ? `/admin/mrs/${mrId}` : `/dashboard`;

  return (
    <div className="space-y-8 mt-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {isAdminView ? `${mrInfo.name}'s Data` : "Your Reports Dashboard"}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            Viewing aggregated sales data
          </p>
        </div>
        {isAdminView && (
          <Link
            href="/admin/mrs"
            className="text-blue-600 font-bold hover:underline"
          >
            &larr; Back to MR List
          </Link>
        )}
      </div>

      {/* Company Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        <Link
          href={`${baseUrl}`}
          className={`px-4 py-2 rounded-full text-sm font-bold transition ${selectedCompany === "All" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}
        >
          All Companies
        </Link>
        {manufacturerNames.map((m) => (
          <Link
            key={m}
            href={`${baseUrl}?company=${encodeURIComponent(m)}`}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${selectedCompany === m ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}
          >
            {m}
          </Link>
        ))}
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-blue-100 font-bold tracking-wider uppercase text-sm mb-2">
            Total Sales Volume ({selectedCompany})
          </div>
          <div className="text-5xl font-extrabold">
            {totalSales.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Product-wise Report */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">
            Product-Wise Report
          </h2>
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                    Total Sales
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {productReports.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No sales data found for {selectedCompany}.
                    </td>
                  </tr>
                ) : (
                  productReports.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {p.name}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600 text-right">
                        {p.total.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time-based Reports */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">
              Monthly Performance
            </h2>
            <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <tbody className="divide-y divide-gray-100 bg-white">
                  {monthlyReports.length === 0 ? (
                    <tr>
                      <td className="px-6 py-4 text-center text-gray-500">
                        No data
                      </td>
                    </tr>
                  ) : (
                    monthlyReports.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {r.time}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-blue-600 text-right">
                          {r.qty.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
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
                      <tr>
                        <td className="px-4 py-3 text-center text-gray-500 text-sm">
                          No data
                        </td>
                      </tr>
                    ) : (
                      quarterlyReports.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            {r.time}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-indigo-600 text-right">
                            {r.qty.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
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
                      <tr>
                        <td className="px-4 py-3 text-center text-gray-500 text-sm">
                          No data
                        </td>
                      </tr>
                    ) : (
                      yearlyReports.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            {r.time}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-purple-600 text-right">
                            {r.qty.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
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
