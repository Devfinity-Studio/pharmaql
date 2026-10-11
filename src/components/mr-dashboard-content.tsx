import Link from "next/link";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterSelect } from "@/components/filter-select";
import { FreeSchemeReportView } from "@/components/free-scheme-report-view";
import { MROverdueWarningModal } from "@/components/mr-overdue-warning-modal";
import { NewSalesReportView } from "@/components/new-sales-report-view";
import { OutstandingDownloadButtons } from "@/components/outstanding-download-buttons";
import { OverdueReportView } from "@/components/overdue-report-view";
import { PartyReportView } from "@/components/party-report-view";
import { ProductReportView } from "@/components/product-report-view";
import { ReportDownloadButtons } from "@/components/report-download-buttons";
import { StockReportView } from "@/components/stock-report-view";
import { getItemCustomerSale } from "@/server/actions/customerItemSale";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getMRwisePeriodicalOutstanding,
	type OverduePeriodicalOutstandingRow,
} from "@/server/actions/overdueReports";

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
		debug?: string;
	};
	isAdminView?: boolean;
}) {
	// 1. Get MR Info from legacy schema
	const mrInfo = await getMRInfo(mrId);

	if (!mrInfo) {
		return (
			<div className="p-8 text-center font-bold text-red-500">
				MR not found.
			</div>
		);
	}

	// 2. Get MR's assigned divisions natively from ERP profile
	const legacyDivision = mrInfo.division || mrInfo.company;
	const effectiveAssignments = legacyDivision
		? [
				{
					id: `legacy-${mrId}`,
					mrId,
					manufacturer: mrInfo.company || legacyDivision,
					division: mrInfo.division || null,
					assignedAt: new Date(),
				},
			]
		: [];

	const assignedDivisions = Array.from(
		new Set(effectiveAssignments.map((a) => a.division || a.manufacturer)),
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
			? effectiveAssignments
			: effectiveAssignments.filter(
					(a) => (a.division || a.manufacturer) === selectedDivision,
				);

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
	const accessibleSales: any[] = [];
	const accessibleInvoices: any[] = [];
	const accessibleOutstanding: any[] = [];

	// Calculate metrics directly from live stored procedures
	const productMap = new Map<string, { name: string; total: number }>();
	const monthMap = new Map<string, number>();
	const quarterMap = new Map<string, number>();
	const yearMap = new Map<string, number>();
	const docOutMap = new Map<string, { doctor: string; city: string; amount: number }>();

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
		// If local tables are unpopulated, aggregate metrics live from stored procedures
		if (accessibleSales.length === 0 || accessibleOutstanding.length === 0) {
			const compCodeForProc = mrInfo.companyCode || mrInfo.company || "";
			const defaultFrom = searchParams?.from || "2026-04-01";
			const defaultTo = searchParams?.to || "2026-09-30";

			// 1. Live Sales Aggregation
			if (accessibleSales.length === 0 && compCodeForProc) {
				try {
					const liveSales = await getItemCustomerSale({
						fromDate: defaultFrom,
						toDate: defaultTo,
						compCode: compCodeForProc,
						locNo: mrInfo.locNo || "11",
					});
					if (liveSales.success && liveSales.data) {
						let procSalesQty = 0;
						let procSalesAmt = 0;
						liveSales.data.forEach((row) => {
							const q = Number(row.Qty || 0);
							const a = Number(row.IAmt || 0);
							procSalesQty += q;
							procSalesAmt += a;

							const pData = productMap.get(String(row.ItemID || row.ItemCode)) || {
								name: row.ItemName || row.ItemCode || "Item",
								total: 0,
							};
							pData.total += q;
							productMap.set(String(row.ItemID || row.ItemCode), pData);

							const d = row.InvDt ? new Date(row.InvDt) : new Date();
							const m = isNaN(d.getTime()) ? "Sep 2026" : d.toLocaleString("default", { month: "short", year: "numeric" });
							monthMap.set(m, (monthMap.get(m) || 0) + q);
						});
						if (totalSales === 0) totalSales = procSalesQty;
						if (totalInvoicesAmt === 0) totalInvoicesAmt = procSalesAmt;
					}
				} catch (err) {
					console.error("[Dashboard] Error fetching live sales procedure:", err);
				}
			}

			// 2. Live Outstanding Aggregation
			if (accessibleOutstanding.length === 0 && compCodeForProc) {
				try {
					const liveOut = await getMRwisePeriodicalOutstanding({
						mrId,
						compCode: compCodeForProc,
						fromDate: defaultFrom,
						toDate: defaultTo,
						locNo: mrInfo.locNo || "11",
					});
					if (liveOut.success && liveOut.data) {
						let procOutAmt = 0;
						liveOut.data.forEach((row: OverduePeriodicalOutstandingRow) => {
							const amt = Number(row.Amount || 0);
							const adj = Number(row.AdjAmt || 0);
							const net = amt - adj;
							if (net > 0) {
								procOutAmt += net;
								const doc = row.Customer || "Unknown Customer";
								const city = row.City || "Unknown City";
								const key = `${doc}-${city}`;
								const existing = docOutMap.get(key) || {
									doctor: doc,
									city: city,
									amount: 0,
								};
								existing.amount += net;
								docOutMap.set(key, existing);
							}
						});
						if (totalOutstandingAmt === 0) totalOutstandingAmt = procOutAmt;
					}
				} catch (err) {
					console.error("[Dashboard] Error fetching live outstanding procedure:", err);
				}
			}
		}

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

	// Evaluate Live Overdue & Impending Block Status
	const { evaluateMROverdueStatus } = await import("@/server/actions/overdueEngine");
	const mrOverdueStatus = await evaluateMROverdueStatus(mrId);

	const baseUrl = isAdminView ? `/admin/mrs/${mrId}` : `/dashboard`;

	return (
		<div className="mt-2 space-y-6">
			{/* Impending Block Warning Modal for 80-90 days */}
			{!isAdminView && mrOverdueStatus.status === "WARNING" && (
				<MROverdueWarningModal
					mrName={mrInfo.name}
					divisionName={mrInfo.division || mrInfo.company}
					invoices={mrOverdueStatus.warningInvoices}
				/>
			)}

			{/* Impending Block Warning Banner */}
			{!isAdminView && mrOverdueStatus.status === "WARNING" && (
				<div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm">
					<div className="flex items-center gap-3">
						<span className="text-2xl">⚠️</span>
						<div className="flex-1">
							<h4 className="font-extrabold text-amber-900 text-sm">
								Attention: Impending Automatic Block Notice
							</h4>
							<p className="mt-0.5 text-xs text-amber-800">
								{mrOverdueStatus.message}
							</p>
						</div>
					</div>
				</div>
			)}
			<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="font-extrabold text-3xl text-[#0B2545] tracking-tight md:text-4xl">
						{isAdminView ? `${mrInfo.name}'s Data` : `Welcome, ${mrInfo.name}`}
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
						Stock & Sales
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
						Claim Qty
					</Link>
				)}
				<Link
					className={`border-b-4 px-6 py-4 font-bold text-base transition-colors ${
						searchParams?.tab === "overdue"
							? "border-[#0071BC] text-[#0071BC]"
							: "border-transparent text-gray-500 hover:text-[#0B2545]"
					}`}
					href={`${baseUrl}?${new URLSearchParams({
						...searchParams,
						tab: "overdue",
					}).toString()}`}
				>
					Overdue
				</Link>
			</div>

			{/* OVERVIEW TAB */}
			{canViewSales && (searchParams?.tab || "overview") === "overview" && (
				<div className="space-y-6">
					{/* DEBUG QUERY BANNER FOR OVERVIEW */}
					{(searchParams?.debug === "1" || searchParams?.debug === "true") && (
						<div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-mono text-xs text-amber-950 shadow-sm print:hidden">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2 mb-2 font-bold text-amber-900 text-xs">
								<span>[DEBUG QUERY] Overview Tab Data Status</span>
								<span className="rounded bg-amber-200 px-2 py-0.5 text-[11px] font-semibold">
									Sales: {accessibleSales.length} | Invoices: {accessibleInvoices.length} | Outstanding: {accessibleOutstanding.length}
								</span>
							</div>
							<div className="space-y-1.5">
								<p className="font-bold text-amber-900 text-[11px]">Database Queries & Filter Conditions:</p>
								<pre className="overflow-x-auto rounded border border-amber-200 bg-amber-100 p-2.5 text-[11px] font-mono select-all whitespace-pre-wrap break-all text-amber-950">
{`-- Overview metrics calculated live via MySQL ERP stored procedures
-- Date Filters: from=${searchParams?.from || "NOT PROVIDED"}, to=${searchParams?.to || "NOT PROVIDED"}
-- Division Selected: ${selectedDivision}
-- Assigned Divisions: ${JSON.stringify(assignedDivisions)}
-- Sales: rptItemCustomerSale => ${totalSales} units | ₹${totalInvoicesAmt.toFixed(2)}
-- Outstanding: rptMRwisePeriodicalOutstanding => ₹${totalOutstandingAmt.toFixed(2)}`}
								</pre>
								<div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-amber-800 pt-1.5 border-t border-amber-200">
									<div><span className="font-semibold">MR ID:</span> {mrId}</div>
									<div><span className="font-semibold">MR Name:</span> {mrInfo.name || "N/A"}</div>
									<div><span className="font-semibold">MR Company:</span> {mrInfo.company || "N/A"}</div>
									<div><span className="font-semibold">LocNo:</span> {mrInfo.locNo || "11"}</div>
								</div>
							</div>
						</div>
					)}

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



			{searchParams?.tab === "party" && canViewPartyWise && (
				<div>
					<div className="mb-4 flex items-center justify-between"></div>
					<PartyReportView mrId={mrId} searchParams={searchParams} />
				</div>
			)}

			{/* FREE SCHEME REPORTS TAB */}
			{canViewFreeScheme && searchParams?.tab === "free-schemes" && (
				<FreeSchemeReportView mrId={mrId} searchParams={searchParams} />
			)}

			{/* OVERDUE TAB */}
			{searchParams?.tab === "overdue" && (
				<OverdueReportView mrId={mrId} searchParams={searchParams} />
			)}

			{/* STOCK REPORTS TAB */}
			{canViewStock && searchParams?.tab === "stock" && (
				<StockReportView mrId={mrId} searchParams={searchParams} />
			)}
		</div>
	);
}
