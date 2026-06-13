import { db } from "@/server/db";
import {
  products,
  sales,
  mrManufacturers,
  user,
  mrInventory,
  invoices,
  outstanding,
} from "@/server/db/schema";
import { eq, inArray, and, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { DateRangePicker } from "@/components/date-range-picker";
import { ReportDownloadButtons } from "@/components/report-download-buttons";

export async function MrDashboardContent({
  mrId,
  searchParams,
  isAdminView = false,
}: {
  mrId: string;
  searchParams?: { company?: string; from?: string; to?: string };
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

  // Determine permissions
  const canViewSales = isAdminView || mrInfo.canViewSales;
  const canViewStock = isAdminView || mrInfo.canViewStock;
  const canViewFreeScheme = isAdminView || mrInfo.canViewFreeScheme;

  let totalSales = 0;
  let totalInvoicesAmt = 0;
  let totalOutstandingAmt = 0;

  let productReports: any[] = [];
  let monthlyReports: any[] = [];
  let quarterlyReports: any[] = [];
  let yearlyReports: any[] = [];
  let stockMap = new Map<string, number>();

  let recentInvoices: any[] = [];
  let outstandingByDoctor: { doctor: string; city: string; amount: number }[] =
    [];

  if (productIds.length > 0) {
    // Fetch Stock if permitted
    if (canViewStock) {
      const inventory = await db
        .select()
        .from(mrInventory)
        .where(
          and(
            inArray(mrInventory.productId, productIds),
            eq(mrInventory.mrId, mrId),
          ),
        );
      inventory.forEach((inv) => {
        stockMap.set(inv.productId, inv.stock);
      });
    }

    // Fetch Sales if permitted
    if (canViewSales) {
      let salesCondition = and(
        inArray(sales.productId, productIds),
        eq(sales.mrId, mrId),
      );

      let invoiceCondition = and(
        inArray(invoices.manufacturerCode, companiesToQuery),
        eq(invoices.mrId, mrId),
      );

      let outstandingCondition = and(
        inArray(outstanding.manufacturerCode, companiesToQuery),
        eq(outstanding.mrId, mrId),
      );

      if (searchParams?.from) {
        const fromDate = new Date(searchParams.from);
        if (!isNaN(fromDate.getTime())) {
          salesCondition = and(salesCondition, gte(sales.createdAt, fromDate));
          invoiceCondition = and(
            invoiceCondition,
            gte(invoices.date, fromDate),
          );
          outstandingCondition = and(
            outstandingCondition,
            gte(outstanding.invDt, fromDate),
          );
        }
      }

      if (searchParams?.to) {
        const toDate = new Date(searchParams.to);
        if (!isNaN(toDate.getTime())) {
          toDate.setUTCHours(23, 59, 59, 999);
          salesCondition = and(salesCondition, lte(sales.createdAt, toDate));
          invoiceCondition = and(invoiceCondition, lte(invoices.date, toDate));
          outstandingCondition = and(
            outstandingCondition,
            lte(outstanding.invDt, toDate),
          );
        }
      }

      const accessibleSales = await db
        .select({
          productId: sales.productId,
          productName: products.name,
          quantity: sales.quantity,
          createdAt: sales.createdAt,
        })
        .from(sales)
        .innerJoin(products, eq(sales.productId, products.id))
        .where(salesCondition);

      const accessibleInvoices = await db
        .select()
        .from(invoices)
        .where(invoiceCondition);

      const accessibleOutstanding = await db
        .select()
        .from(outstanding)
        .where(outstandingCondition);

      // Calculate metrics
      const productMap = new Map<string, { name: string; total: number }>();
      const monthMap = new Map<string, number>();
      const quarterMap = new Map<string, number>();
      const yearMap = new Map<string, number>();

      accessibleSales.forEach((sale) => {
        totalSales += sale.quantity;

        const pData = productMap.get(sale.productId) || {
          name: sale.productName,
          total: 0,
        };
        pData.total += sale.quantity;
        productMap.set(sale.productId, pData);

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

      // Process Invoices
      const sortedInvoices = accessibleInvoices.sort((a, b) => {
        const da = a.date ? a.date.getTime() : 0;
        const db = b.date ? b.date.getTime() : 0;
        return db - da; // Descending
      });

      sortedInvoices.forEach((inv) => {
        if (inv.invAmt) {
          totalInvoicesAmt += parseFloat(inv.invAmt);
        }
      });
      recentInvoices = sortedInvoices.slice(0, 8);

      // Process Outstanding
      const docOutMap = new Map<
        string,
        { doctor: string; city: string; amount: number }
      >();
      accessibleOutstanding.forEach((out) => {
        if (out.invAmt) {
          const amt = parseFloat(out.invAmt);
          totalOutstandingAmt += amt;

          const key = `${out.doctor}-${out.city}`;
          const existing = docOutMap.get(key) || {
            doctor: out.doctor || "Unknown",
            city: out.city || "Unknown",
            amount: 0,
          };
          existing.amount += amt;
          docOutMap.set(key, existing);
        }
      });
      outstandingByDoctor = Array.from(docOutMap.values()).sort(
        (a, b) => b.amount - a.amount,
      );

      productReports = Array.from(productMap.values()).sort(
        (a, b) => b.total - a.total,
      );
      monthlyReports = Array.from(monthMap.entries()).map(([time, qty]) => ({
        time,
        qty,
      }));
      quarterlyReports = Array.from(quarterMap.entries()).map(
        ([time, qty]) => ({
          time,
          qty,
        }),
      );
      yearlyReports = Array.from(yearMap.entries()).map(([time, qty]) => ({
        time,
        qty,
      }));
    }
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
            Viewing aggregated sales & financial data
          </p>
          {!isAdminView && (
            <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-200 inline-flex items-center gap-2">
              <span className="font-bold text-gray-800">
                Debug Permissions:
              </span>
              <span
                className={
                  mrInfo.canViewFreeScheme
                    ? "text-green-600 font-semibold"
                    : "text-red-500 line-through"
                }
              >
                Free Scheme
              </span>{" "}
              &bull;
              <span
                className={
                  mrInfo.canViewStock
                    ? "text-green-600 font-semibold"
                    : "text-red-500 line-through"
                }
              >
                Stock Reports
              </span>{" "}
              &bull;
              <span
                className={
                  mrInfo.canViewSales
                    ? "text-green-600 font-semibold"
                    : "text-red-500 line-through"
                }
              >
                Sales & Financials
              </span>
            </div>
          )}
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

      {/* Filters and Actions */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${baseUrl}?${new URLSearchParams({
                ...(searchParams?.from && { from: searchParams.from }),
                ...(searchParams?.to && { to: searchParams.to }),
              }).toString()}`}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${selectedCompany === "All" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}
            >
              All Companies
            </Link>
            {manufacturerNames.map((m) => {
              const p = new URLSearchParams();
              p.set("company", m);
              if (searchParams?.from) p.set("from", searchParams.from);
              if (searchParams?.to) p.set("to", searchParams.to);

              return (
                <Link
                  key={m}
                  href={`${baseUrl}?${p.toString()}`}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition ${selectedCompany === m ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}
                >
                  {m}
                </Link>
              );
            })}
          </div>
          <DateRangePicker />
        </div>
        <ReportDownloadButtons mrId={mrId} />
      </div>

      {canViewSales && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-blue-100 font-bold tracking-wider uppercase text-xs mb-2">
                Total Sales Volume
              </div>
              <div className="text-4xl font-extrabold truncate">
                {totalSales.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-emerald-100 font-bold tracking-wider uppercase text-xs mb-2">
                Total Invoices
              </div>
              <div className="text-4xl font-extrabold truncate">
                ₹
                {totalInvoicesAmt.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-red-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-rose-100 font-bold tracking-wider uppercase text-xs mb-2">
                Outstanding Balance
              </div>
              <div className="text-4xl font-extrabold truncate">
                ₹
                {totalOutstandingAmt.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {canViewSales && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Outstanding by Doctor */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">
              Outstanding by Doctor
            </h2>
            <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                      Doctor / Party
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                      City
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                      Amount Due
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {outstandingByDoctor.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No outstanding balances.
                      </td>
                    </tr>
                  ) : (
                    outstandingByDoctor.map((out, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {out.doctor}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {out.city}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-rose-600 text-right">
                          ₹
                          {out.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Invoices</h2>
            <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                      Invoice No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {recentInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No recent invoices.
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {inv.invNo}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {inv.date
                            ? new Date(inv.date).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <span className="px-2 py-1 bg-gray-100 rounded-md text-xs">
                            {inv.invType || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-emerald-600 text-right">
                          ₹
                          {inv.invAmt
                            ? parseFloat(inv.invAmt).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "0.00"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Product-wise Report */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">
            Product-Wise Sales & Stock
          </h2>
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Product
                  </th>
                  {canViewFreeScheme && (
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">
                      Free Scheme
                    </th>
                  )}
                  {canViewStock && (
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">
                      Current Stock
                    </th>
                  )}
                  {canViewSales && (
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                      Total Sales
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {accessibleProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No products data found for {selectedCompany}.
                    </td>
                  </tr>
                ) : (
                  accessibleProducts.map((p, idx) => {
                    const stock = stockMap.get(p.id) || 0;
                    const salesData = productReports.find(
                      (pr) => pr.name === p.name,
                    );
                    const salesTotal = salesData ? salesData.total : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {p.name}
                        </td>
                        {canViewFreeScheme && (
                          <td className="px-6 py-4 text-sm font-semibold text-blue-600 text-center">
                            {p.freeScheme || "N/A"}
                          </td>
                        )}
                        {canViewStock && (
                          <td className="px-6 py-4 text-sm font-semibold text-orange-600 text-center">
                            {stock.toLocaleString()}
                          </td>
                        )}
                        {canViewSales && (
                          <td className="px-6 py-4 text-sm font-semibold text-green-600 text-right">
                            {salesTotal.toLocaleString()}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time-based Reports */}
        {canViewSales && (
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
        )}
      </div>
    </div>
  );
}
