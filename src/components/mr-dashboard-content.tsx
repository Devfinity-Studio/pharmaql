import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import Link from "next/link";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterSelect } from "@/components/filter-select";
import { FreeSchemeReportView } from "@/components/free-scheme-report-view";
import { OutstandingDownloadButtons } from "@/components/outstanding-download-buttons";
import { OutstandingReportView } from "@/components/outstanding-report-view";
import { ProductReportView } from "@/components/product-report-view";
import { ReportDownloadButtons } from "@/components/report-download-buttons";
import { NewSalesReportView } from "@/components/new-sales-report-view";
import { StockReportView } from "@/components/stock-report-view";
import { db } from "@/server/db";
import {
	invoices,
	mrInventory,
	mrManufacturers,
	outstanding,
	products,
	sales,
	user,
} from "@/server/db/schema";

export async function MrDashboardContent({
	mrId,
	searchParams,
	isAdminView = false,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
		tab?: string;
		product?: string;
		party?: string;
		q?: string;
	};
	isAdminView?: boolean;
}) {
	// 1. Get MR Info
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];

	if (!mrInfo) {
		return (
			<div className="p-8 text-center font-bold text-red-500">
				MR not found.
			</div>
		);
	}

	// 2. Get MR's assigned divisions
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	const assignedDivisions = Array.from(
		new Set(assigned.map((a) => a.division || a.manufacturer)),
	);

	if (assignedDivisions.length === 0) {
		return (
			<div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
				<h2 className="font-extrabold text-3xl text-[#0B2545]">
					No Data Assigned
				</h2>
				<p className="mt-4 max-w-md font-medium text-gray-500">
					{isAdminView
						? `You have not assigned any divisions to ${mrInfo.name}.`
						: "Your administrator has not assigned any divisions to your account yet. Please contact your admin for access."}
				</p>
			</div>
		);
	}

	// 3. Filter by Division Tab
	const selectedDivision = searchParams?.division || "All";
	const selectedAssignments =
		selectedDivision === "All"
			? assigned
			: assigned.filter(
					(a) => (a.division || a.manufacturer) === selectedDivision,
				);

	// 4. Get Products belonging to these queried divisions
	const productConditionList = selectedAssignments.map((d) => {
		const conditions = [eq(products.manufacturer, d.manufacturer)];
		if (d.division) {
			conditions.push(eq(products.division, d.division));
		}
		return and(...conditions);
	});

	const accessibleProducts =
		productConditionList.length > 0
			? await db
					.select()
					.from(products)
					.where(or(...productConditionList))
			: [];

	const productIds = accessibleProducts.map((p) => p.id);

	// Determine permissions
	const canViewSales = isAdminView || mrInfo.canViewSales;
	const canViewStock = isAdminView || mrInfo.canViewStock;
	const canViewFreeScheme = isAdminView || mrInfo.canViewFreeScheme;
	const canViewPartyWise = isAdminView || mrInfo.canViewPartyWise;
	const canViewProductWise = isAdminView || mrInfo.canViewProductWise;

	let totalSales = 0;
	let totalInvoicesAmt = 0;
	let totalOutstandingAmt = 0;

	let productReports: any[] = [];
	let monthlyReports: any[] = [];
	let quarterlyReports: any[] = [];
	let yearlyReports: any[] = [];
	const stockMap = new Map<string, number>();

	let recentInvoices: any[] = [];
	let outstandingByDoctor: { doctor: string; city: string; amount: number }[] =
		[];

	if (canViewStock && productIds.length > 0) {
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
		let salesCondition =
			productIds.length > 0
				? and(inArray(sales.productId, productIds), eq(sales.mrId, mrId))
				: undefined;

		let invoiceCondition = and(
			inArray(
				invoices.manufacturerCode,
				selectedAssignments.map((d) => d.manufacturer),
			),
			eq(invoices.mrId, mrId),
		);

		const outstandingConditionList = selectedAssignments.map((d) => {
			const conditions = [eq(outstanding.manufacturerCode, d.manufacturer)];
			if (d.division) {
				conditions.push(eq(outstanding.division, d.division));
			}
			return and(...conditions);
		});

		let outstandingCondition = and(
			eq(outstanding.mrId, mrId),
			or(...outstandingConditionList),
		);

		if (searchParams?.from) {
			const fromDate = new Date(searchParams.from);
			if (!isNaN(fromDate.getTime())) {
				salesCondition = and(salesCondition, gte(sales.date, fromDate));
				invoiceCondition = and(invoiceCondition, gte(invoices.date, fromDate));
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
				salesCondition = and(salesCondition, lte(sales.date, toDate));
				invoiceCondition = and(invoiceCondition, lte(invoices.date, toDate));
				outstandingCondition = and(
					outstandingCondition,
					lte(outstanding.invDt, toDate),
				);
			}
		}

		const accessibleSales = salesCondition
			? await db
					.select({
						productId: sales.productId,
						productName: products.name,
						quantity: sales.quantity,
						date: sales.date,
					})
					.from(sales)
					.innerJoin(products, eq(sales.productId, products.id))
					.where(salesCondition)
			: [];

		const accessibleInvoices = invoiceCondition
			? await db.select().from(invoices).where(invoiceCondition)
			: [];

		const accessibleOutstanding = outstandingCondition
			? await db.select().from(outstanding).where(outstandingCondition)
			: [];

		console.log(
			`[Dashboard] MR: ${mrId}, Division: ${selectedDivision}, ProductIds: ${productIds.length}, SalesCount: ${accessibleSales.length}, Invoices: ${accessibleInvoices.length}, Outstanding: ${accessibleOutstanding.length}`,
		);

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

			const date = sale.date ? new Date(sale.date) : new Date();
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
			return db - da;
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
		<div className="mt-2 space-y-6">
			<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="font-extrabold text-3xl text-[#0B2545] tracking-tight md:text-4xl">
						{isAdminView ? `${mrInfo.name}'s Data` : "Your Reports Dashboard"}
					</h1>
					<p className="mt-1 font-semibold text-base text-gray-500">
						Viewing aggregated sales & financial data
					</p>
					{!isAdminView && (
						<div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 font-medium text-gray-600 text-xs">
							<span className="font-bold text-[#0B2545]">
								Debug Permissions:
							</span>
							<span
								className={
									mrInfo.canViewFreeScheme
										? "font-bold text-[#0071BC]"
										: "text-red-400 line-through"
								}
							>
								Free Scheme
							</span>{" "}
							&bull;
							<span
								className={
									mrInfo.canViewStock
										? "font-bold text-[#0071BC]"
										: "text-red-400 line-through"
								}
							>
								Stock Reports
							</span>{" "}
							&bull;
							<span
								className={
									mrInfo.canViewSales
										? "font-bold text-[#0071BC]"
										: "text-red-400 line-through"
								}
							>
								Sales & Financials
							</span>{" "}
							&bull;
							<span
								className={
									mrInfo.canViewProductWise
										? "font-bold text-[#0071BC]"
										: "text-red-400 line-through"
								}
							>
								Product Wise
							</span>{" "}
							&bull;
							<span
								className={
									mrInfo.canViewPartyWise
										? "font-bold text-[#0071BC]"
										: "text-red-400 line-through"
								}
							>
								Party Wise
							</span>
						</div>
					)}
				</div>
				{isAdminView && (
					<Link
						className="font-bold text-[#0071BC] underline underline-offset-4 transition-colors hover:text-[#134074]"
						href="/admin/mrs"
					>
						&larr; Back to MR List
					</Link>
				)}
			</div>

			{/* Filters and Actions */}
			<div className="flex flex-col justify-between gap-6 border-gray-200 border-b pb-6 xl:flex-row xl:items-end">
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap gap-2">
						<Link
							className={`rounded-lg px-4 py-2 font-bold text-sm transition-colors ${selectedDivision === "All" ? "bg-[#0B2545] text-white" : "border-2 border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
							href={`${baseUrl}?${new URLSearchParams({
								...(searchParams?.from && { from: searchParams.from }),
								...(searchParams?.to && { to: searchParams.to }),
								...(searchParams?.tab && { tab: searchParams.tab }),
								...(searchParams?.q && { q: searchParams.q }),
							}).toString()}`}
						>
							All Divisions
						</Link>
						{assignedDivisions.map((div) => {
							const p = new URLSearchParams();
							p.set("division", div);
							if (searchParams?.from) p.set("from", searchParams.from);
							if (searchParams?.to) p.set("to", searchParams.to);
							if (searchParams?.tab) p.set("tab", searchParams.tab);
							if (searchParams?.q) p.set("q", searchParams.q);

							return (
								<Link
									className={`rounded-lg px-4 py-2 font-bold text-sm transition-colors ${selectedDivision === div ? "bg-[#0B2545] text-white" : "border-2 border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
									href={`${baseUrl}?${p.toString()}`}
									key={div}
								>
									{div}
								</Link>
							);
						})}
					</div>
					<DateRangePicker />
				</div>
				{/* RENDER THE CORRECT DOWNLOAD BUTTON CONDITIONALLY AT THE TOP FILTER BAR */}
				{(searchParams?.tab === "products" ||
					searchParams?.tab === "sales" ||
					searchParams?.tab === "free-schemes" ||
					searchParams?.tab === "stock") && (
					<ReportDownloadButtons mrId={mrId} />
				)}
				{searchParams?.tab === "party" && (
					<OutstandingDownloadButtons mrId={mrId} />
				)}
			</div>

			{/* Tabs Row */}
			<div className="scrollbar-hide flex overflow-x-auto whitespace-nowrap rounded-t-xl border-gray-200 border-b bg-white px-2">
				{canViewSales && (
					<Link
						className={`border-b-4 px-6 py-4 font-bold text-base transition-colors ${
							(searchParams?.tab || "overview") === "overview"
								? "border-[#0071BC] text-[#0071BC]"
								: "border-transparent text-gray-500 hover:text-[#0B2545]"
						}`}
						href={`${baseUrl}?${new URLSearchParams({
							...searchParams,
							tab: "overview",
						}).toString()}`}
					>
						Overview
					</Link>
				)}
				{canViewProductWise && (
					<Link
						className={`border-b-4 px-6 py-4 font-bold text-base transition-colors ${
							searchParams?.tab === "products"
								? "border-[#0071BC] text-[#0071BC]"
								: "border-transparent text-gray-500 hover:text-[#0B2545]"
						}`}
						href={`${baseUrl}?${new URLSearchParams({
							...searchParams,
							tab: "products",
						}).toString()}`}
					>
						Product Wise
					</Link>
				)}
				{canViewSales && (
					<Link
						className={`border-b-4 px-6 py-4 font-bold text-base transition-colors ${
							searchParams?.tab === "sales"
								? "border-[#0071BC] text-[#0071BC]"
								: "border-transparent text-gray-500 hover:text-[#0B2545]"
						}`}
						href={`${baseUrl}?${new URLSearchParams({
							...searchParams,
							tab: "sales",
						}).toString()}`}
					>
						Sales Reports
					</Link>
				)}
				{canViewStock && (
					<Link
						className={`border-b-4 px-6 py-4 font-bold text-base transition-colors ${
							searchParams?.tab === "stock"
								? "border-[#0071BC] text-[#0071BC]"
								: "border-transparent text-gray-500 hover:text-[#0B2545]"
						}`}
						href={`${baseUrl}?${new URLSearchParams({
							...searchParams,
							tab: "stock",
						}).toString()}`}
					>
						Stock Reports
					</Link>
				)}
				{canViewFreeScheme && (
					<Link
						className={`border-b-4 px-6 py-4 font-bold text-base transition-colors ${
							searchParams?.tab === "free-schemes"
								? "border-[#0071BC] text-[#0071BC]"
								: "border-transparent text-gray-500 hover:text-[#0B2545]"
						}`}
						href={`${baseUrl}?${new URLSearchParams({
							...searchParams,
							tab: "free-schemes",
						}).toString()}`}
					>
						Free Schemes
					</Link>
				)}
				{canViewPartyWise && (
					<Link
						className={`border-b-4 px-6 py-4 font-bold text-base transition-colors ${
							searchParams?.tab === "party"
								? "border-[#0071BC] text-[#0071BC]"
								: "border-transparent text-gray-500 hover:text-[#0B2545]"
						}`}
						href={`${baseUrl}?${new URLSearchParams({
							...searchParams,
							tab: "party",
						}).toString()}`}
					>
						Party Wise
					</Link>
				)}
			</div>

			{/* OVERVIEW TAB */}
			{canViewSales && (searchParams?.tab || "overview") === "overview" && (
				<div className="space-y-6">
					{/* Refined Metric Cards Family */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
						<div className="rounded-xl bg-[#0071BC] p-6 text-white shadow-sm">
							<div>
								<div className="mb-1 font-bold text-blue-100 text-xs uppercase tracking-wider">
									Total Sales Volume
								</div>
								<div className="truncate font-extrabold text-4xl">
									{totalSales.toLocaleString()}
								</div>
							</div>
						</div>
						<div className="rounded-xl bg-[#1E40AF] p-6 text-white shadow-sm">
							<div>
								<div className="mb-1 font-bold text-indigo-100 text-xs uppercase tracking-wider">
									Total Invoices
								</div>
								<div className="truncate font-extrabold text-4xl">
									₹
									{totalInvoicesAmt.toLocaleString(undefined, {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</div>
							</div>
						</div>
						{/* Accessible Red Warning Frame Variant */}
						<div className="rounded-xl bg-red-600 p-6 text-white shadow-sm">
							<div>
								<div className="mb-1 font-bold text-white text-xs uppercase tracking-wider">
									Outstanding Balance
								</div>
								<div className="truncate font-extrabold text-4xl text-white">
									₹
									{totalOutstandingAmt.toLocaleString(undefined, {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-8">
						{/* Monthly Performance */}
						<div className="space-y-4">
							<h2 className="font-bold text-[#0B2545] text-xl">
								Monthly Performance
							</h2>
							<div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
								<table className="min-w-full divide-y divide-gray-200">
									<tbody className="divide-y divide-gray-200 bg-white">
										{monthlyReports.length === 0 ? (
											<tr>
												<td className="px-6 py-4 text-center font-medium text-gray-500">
													No data
												</td>
											</tr>
										) : (
											monthlyReports.slice(0, 8).map((r, idx) => (
												<tr
													className="transition-colors hover:bg-gray-50"
													key={idx}
												>
													<td className="px-6 py-4 font-bold text-[#0B2545] text-sm">
														{r.time}
													</td>
													<td className="px-6 py-4 text-right font-bold text-[#0071BC] text-sm">
														{r.qty.toLocaleString()}
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
							<h2 className="font-bold text-[#0B2545] text-xl">
								Recent Invoices
							</h2>
							<div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50">
										<tr>
											<th className="px-6 py-4 text-left font-bold text-gray-500 text-xs uppercase">
												Invoice No
											</th>
											<th className="px-6 py-4 text-left font-bold text-gray-500 text-xs uppercase">
												Date
											</th>
											<th className="px-6 py-4 text-left font-bold text-gray-500 text-xs uppercase">
												Type
											</th>
											<th className="px-6 py-4 text-right font-bold text-gray-500 text-xs uppercase">
												Amount
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200 bg-white">
										{recentInvoices.length === 0 ? (
											<tr>
												<td
													className="px-6 py-8 text-center font-medium text-gray-500"
													colSpan={4}
												>
													No recent invoices.
												</td>
											</tr>
										) : (
											recentInvoices.map((inv, idx) => (
												<tr
													className="transition-colors hover:bg-gray-50"
													key={idx}
												>
													<td className="px-6 py-4 font-bold text-[#0B2545] text-sm">
														{inv.invNo}
													</td>
													<td className="px-6 py-4 font-medium text-gray-500 text-sm">
														{inv.date
															? new Date(inv.date).toLocaleDateString()
															: "N/A"}
													</td>
													<td className="px-6 py-4 text-gray-500 text-sm">
														<span className="rounded-md bg-gray-100 px-2 py-1 font-bold text-gray-600 text-xs">
															{inv.invType || "N/A"}
														</span>
													</td>
													<td className="px-6 py-4 text-right font-bold text-[#0071BC] text-sm">
														₹
														{inv.invAmt
															? parseFloat(inv.invAmt).toLocaleString(
																	undefined,
																	{
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2,
																	},
																)
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
				</div>
			)}

			{/* DYNAMIC REPORTS */}
			{searchParams?.tab === "products" && canViewProductWise && (
				<div>
					<div className="mb-4 flex items-center justify-between">
						<form
							action={baseUrl}
							className="flex w-full max-w-sm gap-2"
							method="GET"
						>
							{Object.entries(searchParams || {}).map(([k, v]) => {
								if (k === "q") return null;
								return (
									<input key={k} name={k} type="hidden" value={v as string} />
								);
							})}
							<input
								className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
								defaultValue={searchParams?.q || ""}
								name="q"
								placeholder="Search product..."
							/>
							<button
								className="rounded-xl bg-[#0071BC] px-4 py-2 font-bold text-white"
								type="submit"
							>
								Search
							</button>
						</form>
					</div>
					<ProductReportView mrId={mrId} searchParams={searchParams} />
				</div>
			)}

			{searchParams?.tab === "sales" && canViewSales && (
				<div>
					<div className="mb-4 flex items-center justify-between">
						<form
							action={baseUrl}
							className="flex w-full max-w-sm gap-2"
							method="GET"
						>
							{Object.entries(searchParams || {}).map(([k, v]) => {
								if (k === "q") return null;
								return (
									<input key={k} name={k} type="hidden" value={v as string} />
								);
							})}
							<input
								className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
								defaultValue={searchParams?.q || ""}
								name="q"
								placeholder="Search product or party..."
							/>
							<button
								className="rounded-xl bg-[#0071BC] px-4 py-2 font-bold text-white"
								type="submit"
							>
								Search
							</button>
						</form>
					</div>
					<NewSalesReportView mrId={mrId} searchParams={searchParams} />
				</div>
			)}

			{searchParams?.tab === "party" && canViewPartyWise && (
				<div>
					<div className="mb-4 flex items-center justify-between"></div>
					<OutstandingReportView mrId={mrId} searchParams={searchParams} />
				</div>
			)}

			{/* FREE SCHEME REPORTS TAB */}
			{canViewFreeScheme && searchParams?.tab === "free-schemes" && (
				<FreeSchemeReportView mrId={mrId} searchParams={searchParams} />
			)}

			{/* STOCK REPORTS TAB */}
			{canViewStock && searchParams?.tab === "stock" && (
				<StockReportView mrId={mrId} searchParams={searchParams} />
			)}
		</div>
	);
}
