import React from "react";
import { OfflineReportSync } from "@/components/offline-report-sync";
import { ReportStationeryHeader } from "@/components/report-stationery-header";
import {
	getItemCustomerSale,
	type ItemCustomerSaleResult,
	type ItemCustomerSaleRow,
} from "@/server/actions/customerItemSale";
import {
	getItemDivisionMap,
	getProductCatalog,
} from "@/server/actions/itemCatalog";
import { getMRInfo } from "@/server/actions/mrInfo";

function formatDisplayDate(val?: string | Date | null): string {
	if (!val) return "";
	if (typeof val === "string") {
		const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (match) return `${match[3]}/${match[2]}/${match[1]}`;
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return String(val);
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

function formatExpDate(val?: string | Date | null): string {
	if (!val) return "";
	if (typeof val === "string") {
		const match = val.match(/\d{4}-\d{2}(-\d{2})?/);
		if (match) return match[0];
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return String(val);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

interface ProductItemReportGroup {
	code: string;
	name: string;
	packing: string;
	salesBySeries: Map<string, ItemCustomerSaleRow[]>;
	returnsBySeries: Map<string, ItemCustomerSaleRow[]>;
	salesTotalQty: number;
	salesTotalFree: number;
	salesTotalAmount: number;
	returnTotalQty: number;
	returnTotalFree: number;
	returnTotalAmount: number;
}

export async function ProductReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
		q?: string;
		debug?: string;
	};
}) {
	// Fetch MR Info and permissions
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo || !mrInfo.canViewProductWise)
		return <div>No access to products data.</div>;

	const company = searchParams?.division || "All";
	const compCodeToQuery = (() => {
		if (company === "All") {
			const allCodes = Array.from(
				new Set(
					(mrInfo.assignments || []).map((a) => a.companyCode).filter(Boolean),
				),
			);
			return allCodes.length > 0
				? allCodes.join(",")
				: mrInfo.companyCode || mrInfo.company || "";
		}
		const matchingAssignment = (mrInfo.assignments || []).find(
			(a) =>
				a.division === company ||
				a.manufacturer === company ||
				a.company === company,
		);
		if (matchingAssignment?.companyCode) return matchingAssignment.companyCode;
		return mrInfo.companyCode || company;
	})();

	const fromParam = searchParams?.from || "2026-04-01";
	const toParam = searchParams?.to || "2026-09-30";

	const [procSalesResult, itemDivisionMap] = await Promise.all([
		mrInfo.canViewSales
			? getItemCustomerSale({
					fromDate: fromParam,
					toDate: toParam,
					compCode: compCodeToQuery,
					locNo: mrInfo.locNo || "11",
				})
			: Promise.resolve<ItemCustomerSaleResult>({
					success: false,
					error: "MR does not have sales view permissions",
					data: null,
					debugSql: undefined,
				}),
		company !== "All"
			? getItemDivisionMap(compCodeToQuery, mrInfo.locNo || "11")
			: Promise.resolve<Map<string, string> | null>(null),
	]);

	const fromDisplay = formatDisplayDate(fromParam);
	const toDisplay = formatDisplayDate(toParam);

	// If procedure returned data, organize it into the exact PDF format
	if (
		procSalesResult.success &&
		procSalesResult.data &&
		procSalesResult.data.length > 0
	) {
		let rowsToProcess = procSalesResult.data;

		if (company !== "All" && itemDivisionMap) {
			const sel = company.trim().toUpperCase();
			rowsToProcess = rowsToProcess.filter((r) => {
				const name = (r.ItemName || "").toString().trim().toUpperCase();
				const code = (r.ItemCode || "").toString().trim().toUpperCase();
				const itemDiv = itemDivisionMap.get(name) || itemDivisionMap.get(code);
				if (!itemDiv) return false;
				return (
					itemDiv === sel || itemDiv.includes(sel) || sel.includes(itemDiv)
				);
			});
		}

		if (searchParams?.q) {
			const q = searchParams.q.toLowerCase();
			rowsToProcess = rowsToProcess.filter(
				(r) =>
					(r.ItemName && r.ItemName.toLowerCase().includes(q)) ||
					(r.ItemCode && r.ItemCode.toLowerCase().includes(q)) ||
					(r.Customer && r.Customer.toLowerCase().includes(q)) ||
					(r.City && r.City.toLowerCase().includes(q)) ||
					(r.InvNo && r.InvNo.toLowerCase().includes(q)),
			);
		}

		// Group rows by Product
		const productGroupsMap = new Map<string, ProductItemReportGroup>();

		for (const row of rowsToProcess) {
			const key = `${row.ItemCode || ""}_${row.ItemName || ""}`;
			let group = productGroupsMap.get(key);
			if (!group) {
				group = {
					code: row.ItemCode || "",
					name: row.ItemName || "Unknown Item",
					packing: row.Packing || "",
					salesBySeries: new Map(),
					returnsBySeries: new Map(),
					salesTotalQty: 0,
					salesTotalFree: 0,
					salesTotalAmount: 0,
					returnTotalQty: 0,
					returnTotalFree: 0,
					returnTotalAmount: 0,
				};
				productGroupsMap.set(key, group);
			}

			const isSalesReturn =
				row.DocType === "SR" ||
				row.DocType === "CN" ||
				String(row.ReturnType || "").toUpperCase() === "Y" ||
				Number(row.Qty) < 0;

			const seriesName = row.Series || row.DocType || "INV";
			const targetMap = isSalesReturn
				? group.returnsBySeries
				: group.salesBySeries;

			const seriesList = targetMap.get(seriesName) || [];
			seriesList.push(row);
			targetMap.set(seriesName, seriesList);

			const q = Math.abs(Number(row.Qty) || 0);
			const f = Math.abs(Number(row.FQty) || 0);
			const a = Math.abs(Number(row.IAmt) || 0);

			if (isSalesReturn) {
				group.returnTotalQty += q;
				group.returnTotalFree += f;
				group.returnTotalAmount += a;
			} else {
				group.salesTotalQty += q;
				group.salesTotalFree += f;
				group.salesTotalAmount += a;
			}
		}

		const productGroups = Array.from(productGroupsMap.values());

		let grandSalesQty = 0;
		let grandSalesFree = 0;
		let grandSalesAmount = 0;
		let grandReturnQty = 0;
		let grandReturnFree = 0;
		let grandReturnAmount = 0;

		productGroups.forEach((p) => {
			grandSalesQty += p.salesTotalQty;
			grandSalesFree += p.salesTotalFree;
			grandSalesAmount += p.salesTotalAmount;
			grandReturnQty += p.returnTotalQty;
			grandReturnFree += p.returnTotalFree;
			grandReturnAmount += p.returnTotalAmount;
		});

		return (
			<div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
				<OfflineReportSync
					data={productGroups}
					mrId={mrId}
					params={searchParams}
					tab="products"
				/>
				{/* Official Stationery Header */}
				<ReportStationeryHeader
					fromDisplay={fromDisplay}
					summaryRight={`Total Items: ${productGroups.length}`}
					title="Itemwise/Customerwise Sales"
					toDisplay={toDisplay}
				/>

				{/* REPORT TABLE */}
				<div className="w-full overflow-x-auto border-gray-900 border-t-2 pt-1">
					<table className="w-full min-w-[1100px] border-collapse text-left font-sans text-xs">
						<thead>
							<tr className="border-gray-900 border-y-2 bg-gray-50 text-[11px] text-gray-800 uppercase tracking-wider">
								<th className="py-2 pl-2 font-bold">Party / City</th>
								<th className="py-2 font-bold">Address</th>
								<th className="py-2 font-bold">Doc No</th>
								<th className="py-2 font-bold">Date</th>
								<th className="py-2 font-bold">Batch</th>
								<th className="py-2 font-bold">Exp Dt</th>
								<th className="py-2 text-right font-bold">PTR</th>
								<th className="py-2 text-right font-bold">Rate</th>
								<th className="py-2 text-right font-bold">Qty</th>
								<th className="py-2 text-right font-bold">Free</th>
								<th className="py-2 text-right font-bold">Taxable</th>
								<th className="py-2 text-right font-bold">GST</th>
								<th className="py-2 text-right font-bold">Amount</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{productGroups.map((group, pIdx) => (
								<React.Fragment key={pIdx}>
									<tr className="bg-blue-50/70 font-bold text-blue-900">
										<td className="py-2 pl-2" colSpan={13}>
											{group.name} [{group.code}] - Packing: {group.packing}
										</td>
									</tr>
									{Array.from(group.salesBySeries.entries()).map(
										([series, items]) =>
											items.map((row, rIdx) => (
												<tr
													className="hover:bg-gray-50"
													key={`${pIdx}-${series}-${rIdx}`}
												>
													<td className="py-1 pl-2 font-medium">
														{row.Customer}
													</td>
													<td className="py-1 text-gray-500">
														{row.Address || row.City || "-"}
													</td>
													<td className="py-1">{row.InvNo}</td>
													<td className="py-1">
														{formatDisplayDate(row.InvDt)}
													</td>
													<td className="py-1">{row.BatchNo}</td>
													<td className="py-1">{formatExpDate(row.ExpDt)}</td>
													<td className="py-1 text-right">
														{Number(row.PTR || 0).toFixed(2)}
													</td>
													<td className="py-1 text-right">
														{Number(row.Srate || 0).toFixed(2)}
													</td>
													<td className="py-1 text-right font-semibold text-blue-700">
														{row.Qty}
													</td>
													<td className="py-1 text-right">{row.FQty || ""}</td>
													<td className="py-1 text-right">
														{Number(row.IAmt || 0).toFixed(2)}
													</td>
													<td className="py-1 text-right">-</td>
													<td className="py-1 text-right font-bold text-gray-900">
														{Number(row.IAmt || 0).toFixed(2)}
													</td>
												</tr>
											)),
									)}
								</React.Fragment>
							))}
							<tr className="border-gray-900 border-t-2 border-b-2 bg-gray-100 font-extrabold">
								<td className="py-2.5 pl-2" colSpan={8}>
									Grand Total Sales:
								</td>
								<td className="py-2.5 text-right text-blue-800">
									{grandSalesQty}
								</td>
								<td className="py-2.5 text-right">{grandSalesFree || ""}</td>
								<td colSpan={2}></td>
								<td className="py-2.5 text-right text-blue-800">
									{grandSalesAmount.toFixed(2)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		);
	}

	// Native Product Catalog from MySQL master
	const catalogResult = await getProductCatalog({
		mktBy: compCodeToQuery || undefined,
	});

	let catalogItems =
		catalogResult.success && catalogResult.data ? catalogResult.data : [];
	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		catalogItems = catalogItems.filter(
			(d) =>
				(d.ItemName && d.ItemName.toLowerCase().includes(q)) ||
				(d.ItemCode && d.ItemCode.toLowerCase().includes(q)) ||
				(d.Division && d.Division.toLowerCase().includes(q)),
		);
	}

	return (
		<div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<ReportStationeryHeader
				summaryRight={`Total Products: ${catalogItems.length}`}
				title="Product Catalog"
			/>

			<div className="w-full overflow-x-auto border-gray-300 border-t pt-2">
				<table className="w-full min-w-[800px] border-collapse text-left font-sans text-xs">
					<thead>
						<tr className="border-gray-900 border-y-2 bg-gray-50">
							<th className="py-2 pl-2 font-bold text-gray-900">Item Code</th>
							<th className="py-2 font-bold text-gray-900">Product Name</th>
							<th className="py-2 font-bold text-gray-900">Packing</th>
							<th className="py-2 font-bold text-gray-900">Division</th>
							<th className="py-2 font-bold text-gray-900">Mkt By</th>
						</tr>
					</thead>
					<tbody>
						{catalogItems.length === 0 ? (
							<tr>
								<td
									className="py-6 text-center font-medium text-gray-500"
									colSpan={5}
								>
									No products found.
								</td>
							</tr>
						) : (
							catalogItems.map((item, idx: number) => (
								<tr
									className="border-gray-200 border-b hover:bg-gray-50"
									key={idx}
								>
									<td className="py-1.5 pl-2 font-mono text-gray-600">
										{item.ItemCode}
									</td>
									<td className="py-1.5 font-bold text-gray-900">
										{item.ItemName}
									</td>
									<td className="py-1.5 text-gray-600">{item.Packing}</td>
									<td className="py-1.5 text-gray-600">{item.Division}</td>
									<td className="py-1.5 text-gray-600">{item.MktBy}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
