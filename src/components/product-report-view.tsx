import Image from "next/image";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import React from "react";
import { db } from "@/server/db";
import {
	mrInventory,
	mrManufacturers,
	products,
	sales,
} from "@/server/db/schema";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getItemCustomerSale,
	type ItemCustomerSaleResult,
	type ItemCustomerSaleRow,
} from "@/server/actions/customerItemSale";

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
	};
}) {
	// Fetch MR Info and permissions
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo || !mrInfo.canViewProductWise)
		return <div>No access to products data.</div>;

	const company = searchParams?.division || "All";
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));
	let manufacturerNames = assigned.map((a) => a.manufacturer);
	if (manufacturerNames.length === 0 && mrInfo.company) {
		manufacturerNames = [mrInfo.company];
	}
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0 && !mrInfo.companyCode) {
		return <div>No data assigned</div>;
	}

	// Query product-wise sales using the legacy procedure `rptItemCustomerSale`
	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || (companiesToQuery.length > 0 ? companiesToQuery : "")
			: mrInfo.companyCode && (mrInfo.company === company || mrInfo.division === company)
				? mrInfo.companyCode
				: company;

	const procSalesResult: ItemCustomerSaleResult =
		mrInfo.canViewSales && searchParams?.from && searchParams?.to
			? await getItemCustomerSale({
					fromDate: searchParams.from,
					toDate: searchParams.to,
					compCode: compCodeToQuery,
					locNo: mrInfo.locNo,
				})
			: {
					success: false,
					error: !mrInfo.canViewSales
						? "MR does not have sales view permissions"
						: "Missing 'from' or 'to' date parameters in URL",
					data: null,
					debugSql: undefined,
				};

	const fromDisplay = formatDisplayDate(searchParams?.from) || "01/10/2026";
	const toDisplay = formatDisplayDate(searchParams?.to) || "11/10/2026";

	// If procedure returned data, organize it into the exact PDF format
	if (procSalesResult.success && procSalesResult.data && procSalesResult.data.length > 0) {
		let rowsToProcess = procSalesResult.data;

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

		// Group rows by Product (preserving natural procedure ordering)
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

			const isReturn =
				row.DocType === "SLRT" ||
				(row.Series && row.Series.toUpperCase().includes("RETURN"));
			const seriesKey = (row.Series || (isReturn ? "SALES RETURN" : "CASH O/S")).trim();

			if (isReturn) {
				const existing = group.returnsBySeries.get(seriesKey) || [];
				existing.push(row);
				group.returnsBySeries.set(seriesKey, existing);
				group.returnTotalQty += Math.abs(Number(row.Qty || 0));
				group.returnTotalFree += Math.abs(Number(row.FQty || 0));
				group.returnTotalAmount += Math.abs(Number(row.IAmt || 0));
			} else {
				const existing = group.salesBySeries.get(seriesKey) || [];
				existing.push(row);
				group.salesBySeries.set(seriesKey, existing);
				group.salesTotalQty += Number(row.Qty || 0);
				group.salesTotalFree += Number(row.FQty || 0);
				group.salesTotalAmount += Number(row.IAmt || 0);
			}
		}

		const productGroups = Array.from(productGroupsMap.values());

		// Grand totals
		let grandSalesQty = 0;
		let grandSalesFree = 0;
		let grandSalesAmount = 0;
		let grandReturnQty = 0;
		let grandReturnFree = 0;
		let grandReturnAmount = 0;

		for (const g of productGroups) {
			grandSalesQty += g.salesTotalQty;
			grandSalesFree += g.salesTotalFree;
			grandSalesAmount += g.salesTotalAmount;
			grandReturnQty += g.returnTotalQty;
			grandReturnFree += g.returnTotalFree;
			grandReturnAmount += g.returnTotalAmount;
		}

		return (
			<div className="mt-4 space-y-4 rounded-xl border border-gray-300 bg-white p-6 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none font-sans text-gray-900">
				{/* DEBUG QUERY BANNER */}
				<div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-mono text-xs text-amber-950 shadow-sm print:hidden">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2 mb-2 font-bold text-amber-900 text-xs">
						<span>[DEBUG QUERY] Stored Procedure Execution Status</span>
						<span className="rounded bg-amber-200 px-2 py-0.5 text-[11px] font-semibold">
							{procSalesResult.data?.length ?? 0} rows returned
						</span>
					</div>
					<div className="space-y-1.5">
						<p className="font-bold text-amber-900 text-[11px]">Final SQL Query being run:</p>
						<pre className="overflow-x-auto rounded border border-amber-200 bg-amber-100 p-2.5 text-[11px] font-mono select-all whitespace-pre-wrap break-all text-amber-950">
							{procSalesResult.debugSql ||
								`-- Procedure was not called because 'from' and/or 'to' date parameters are missing in searchParams.\n-- Current searchParams: from=${searchParams?.from || "NOT PROVIDED"}, to=${searchParams?.to || "NOT PROVIDED"}, division=${searchParams?.division || "All"}`}
						</pre>
						<div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-amber-800 pt-1.5 border-t border-amber-200">
							<div><span className="font-semibold">Company Code Query:</span> {JSON.stringify(compCodeToQuery)}</div>
							<div><span className="font-semibold">MR Company:</span> {mrInfo.company || "N/A"}</div>
							<div><span className="font-semibold">MR Code:</span> {mrInfo.companyCode || "N/A"}</div>
							<div><span className="font-semibold">LocNo:</span> {mrInfo.locNo || "11"}</div>
						</div>
					</div>
				</div>

				{/* REPORT HEADER - MATCHING PDF */}
				<div className="border-b-2 border-gray-900 pb-2">
					<div className="flex flex-col md:flex-row items-start justify-between gap-3">
						<div className="flex items-start gap-4">
							<Image
								src="/logo.png"
								alt="Asmee Pharma Logo"
								width={140}
								height={45}
								className="object-contain pt-0.5"
								priority
							/>
							<div>
								<h1 className="font-extrabold text-base tracking-tight text-gray-900 uppercase">
									ASMEE PHARMA PRIVATE LIMITED
								</h1>
								<p className="mt-0.5 text-[11px] leading-tight text-gray-700">
									BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,
									<br />
									RAOPURA, VADODARA - 390001, GUJARAT - 24
									<br />
									Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
								</p>
							</div>
						</div>
					</div>

					{/* Title and metadata bar */}
					<div className="mt-3 flex items-center justify-between border-t border-gray-300 pt-1.5 text-xs font-bold text-gray-900">
						<div>Year : 2026-27</div>
						<div className="text-center font-extrabold text-xs text-[#0B2545]">
							Itemwise/Customerwise Sales for Period of {fromDisplay} to {toDisplay}
						</div>
						<div className="text-right text-[11px] font-medium text-gray-600">
							Total Items: {productGroups.length}
						</div>
					</div>
				</div>

				{/* REPORT DATA TABLE */}
				<div className="w-full overflow-x-auto">
					<table className="w-full min-w-[1150px] border-collapse text-left font-sans text-[11px] leading-tight">
						<thead>
							<tr className="border-y-2 border-gray-900 bg-gray-50 text-[11px] font-bold text-gray-900">
								<th className="py-1 px-1 text-center w-[35px]">SNo.</th>
								<th className="py-1 px-1.5 w-[65px]">InvNo</th>
								<th className="py-1 px-1.5 w-[75px]">InvDt</th>
								<th className="py-1 px-2 w-[180px]">Customer</th>
								<th className="py-1 px-2 w-[140px]">Address</th>
								<th className="py-1 px-2 w-[150px]">Area / City</th>
								<th className="py-1 px-1.5 w-[75px]">BatchNo</th>
								<th className="py-1 px-1.5 w-[75px]">Exp.</th>
								<th className="py-1 px-1.5 text-right w-[45px]">Qty.</th>
								<th className="py-1 px-1 text-right w-[40px]">Free</th>
								<th className="py-1 px-1.5 text-right w-[55px]">PTR</th>
								<th className="py-1 px-1.5 text-right w-[55px]">S.Rate</th>
								<th className="py-1 px-2 text-right w-[75px]">Amount</th>
								<th className="py-1 px-2 w-[95px]">CreatedBy</th>
								<th className="py-1 px-1.5 w-[70px]">Reason</th>
							</tr>
						</thead>
						<tbody>
							{productGroups.map((product, pIdx) => {
								let salesSnoCounter = 0;
								let returnSnoCounter = 0;

								return (
									<React.Fragment key={`prod-${pIdx}-${product.code}`}>
										{/* Product Item Header Bar */}
										<tr className="border-y border-[#b8d7f5] bg-[#eef6fc]">
											<td
												colSpan={15}
												className="py-1 px-2 font-bold text-[#002b66] text-xs"
											>
												{product.code} - {product.name}{" "}
												{product.packing ? `[ ${product.packing} ]` : ""}
											</td>
										</tr>

										{/* Sales Section */}
										{product.salesBySeries.size > 0 && (
											<>
												<tr>
													<td
														colSpan={15}
														className="pt-1.5 pb-0.5 px-2 font-bold text-xs text-gray-900"
													>
														Sales
													</td>
												</tr>

												{Array.from(product.salesBySeries.entries()).map(
													([seriesName, rows]) => (
														<React.Fragment key={`series-${seriesName}`}>
															<tr>
																<td
																	colSpan={15}
																	className="pt-1 pb-0.5 px-3 font-semibold text-[11px] text-gray-800 italic"
																>
																	Series : {seriesName}
																</td>
															</tr>

															{rows.map((row, rIdx) => {
																salesSnoCounter += 1;
																const createdByDisplay = `${row.Godown || ""} ${row.CreatedBy || ""}`.trim();

																return (
																	<tr
																		key={`row-${row.ID}-${rIdx}`}
																		className="border-b border-gray-100 hover:bg-gray-50/80 text-[11px] text-gray-800"
																	>
																		<td className="py-0.5 px-1 text-center text-gray-600">
																			{salesSnoCounter}
																		</td>
																		<td className="py-0.5 px-1.5 font-medium whitespace-nowrap">
																			{row.InvNo}
																		</td>
																		<td className="py-0.5 px-1.5 whitespace-nowrap">
																			{formatDisplayDate(row.InvDt)}
																		</td>
																		<td className="py-0.5 px-2 font-medium leading-tight">
																			{row.Customer}
																		</td>
																		<td className="py-0.5 px-2 text-gray-600 truncate max-w-[140px]">
																			{row.Address || ""}
																		</td>
																		<td className="py-0.5 px-2 text-gray-600 truncate max-w-[150px]">
																			{row.City || ""}
																		</td>
																		<td className="py-0.5 px-1.5 whitespace-nowrap">
																			{row.BatchNo}
																		</td>
																		<td className="py-0.5 px-1.5 whitespace-nowrap">
																			{formatExpDate(row.ExpDt)}
																		</td>
																		<td className="py-0.5 px-1.5 text-right font-semibold">
																			{Math.abs(row.Qty)}
																		</td>
																		<td className="py-0.5 px-1 text-right text-gray-600">
																			{row.FQty ? Math.abs(row.FQty) : ""}
																		</td>
																		<td className="py-0.5 px-1.5 text-right">
																			{Number(row.PTR || 0).toFixed(2)}
																		</td>
																		<td className="py-0.5 px-1.5 text-right">
																			{Number(row.Srate || 0).toFixed(2)}
																		</td>
																		<td className="py-0.5 px-2 text-right font-medium">
																			{Number(row.IAmt || 0).toFixed(2)}
																		</td>
																		<td className="py-0.5 px-2 text-gray-700 whitespace-nowrap">
																			{createdByDisplay}
																		</td>
																		<td className="py-0.5 px-1.5 text-gray-600">
																			{row.ReturnType || row.Remarks || ""}
																		</td>
																	</tr>
																);
															})}
														</React.Fragment>
													),
												)}

												{/* Total Sales for this product */}
												<tr className="border-y border-gray-400 bg-gray-50/50 text-[11px] font-bold text-gray-900">
													<td colSpan={8} className="py-1 px-2 text-left">
														Total Sales of {product.name}
													</td>
													<td className="py-1 px-1.5 text-right">
														{product.salesTotalQty}
													</td>
													<td className="py-1 px-1 text-right">
														{product.salesTotalFree || ""}
													</td>
													<td colSpan={2}></td>
													<td className="py-1 px-2 text-right">
														{product.salesTotalAmount.toFixed(2)}
													</td>
													<td colSpan={2}></td>
												</tr>
											</>
										)}

										{/* Sales Return Section */}
										{product.returnsBySeries.size > 0 && (
											<>
												<tr>
													<td
														colSpan={15}
														className="pt-2 pb-0.5 px-2 font-bold text-xs text-rose-900"
													>
														Sales Return
													</td>
												</tr>

												{Array.from(product.returnsBySeries.entries()).map(
													([seriesName, rows]) => (
														<React.Fragment key={`ret-series-${seriesName}`}>
															<tr>
																<td
																	colSpan={15}
																	className="pt-1 pb-0.5 px-3 font-semibold text-[11px] text-gray-800 italic"
																>
																	Series : {seriesName}
																</td>
															</tr>

															{rows.map((row, rIdx) => {
																returnSnoCounter += 1;
																const createdByDisplay = `${row.Godown || ""} ${row.CreatedBy || ""}`.trim();

																return (
																	<tr
																		key={`ret-row-${row.ID}-${rIdx}`}
																		className="border-b border-gray-100 hover:bg-rose-50/40 text-[11px] text-gray-800"
																	>
																		<td className="py-0.5 px-1 text-center text-gray-600">
																			{returnSnoCounter}
																		</td>
																		<td className="py-0.5 px-1.5 font-medium whitespace-nowrap">
																			{row.InvNo}
																		</td>
																		<td className="py-0.5 px-1.5 whitespace-nowrap">
																			{formatDisplayDate(row.InvDt)}
																		</td>
																		<td className="py-0.5 px-2 font-medium leading-tight">
																			{row.Customer}
																		</td>
																		<td className="py-0.5 px-2 text-gray-600 truncate max-w-[140px]">
																			{row.Address || ""}
																		</td>
																		<td className="py-0.5 px-2 text-gray-600 truncate max-w-[150px]">
																			{row.City || ""}
																		</td>
																		<td className="py-0.5 px-1.5 whitespace-nowrap">
																			{row.BatchNo}
																		</td>
																		<td className="py-0.5 px-1.5 whitespace-nowrap">
																			{formatExpDate(row.ExpDt)}
																		</td>
																		<td className="py-0.5 px-1.5 text-right font-semibold text-rose-700">
																			{Math.abs(row.Qty)}
																		</td>
																		<td className="py-0.5 px-1 text-right text-gray-600">
																			{row.FQty ? Math.abs(row.FQty) : ""}
																		</td>
																		<td className="py-0.5 px-1.5 text-right">
																			{Number(row.PTR || 0).toFixed(2)}
																		</td>
																		<td className="py-0.5 px-1.5 text-right">
																			{Number(row.Srate || 0).toFixed(2)}
																		</td>
																		<td className="py-0.5 px-2 text-right font-medium text-rose-700">
																			{Number(row.IAmt || 0).toFixed(2)}
																		</td>
																		<td className="py-0.5 px-2 text-gray-700 whitespace-nowrap">
																			{createdByDisplay}
																		</td>
																		<td className="py-0.5 px-1.5 text-gray-600">
																			{row.ReturnType || row.Remarks || ""}
																		</td>
																	</tr>
																);
															})}
														</React.Fragment>
													),
												)}

												{/* Total Sales Return */}
												<tr className="border-y border-gray-400 bg-rose-50/30 text-[11px] font-bold text-rose-900">
													<td colSpan={8} className="py-1 px-2 text-left">
														Total Sales Return of {product.name}
													</td>
													<td className="py-1 px-1.5 text-right">
														{product.returnTotalQty}
													</td>
													<td className="py-1 px-1 text-right">
														{product.returnTotalFree || ""}
													</td>
													<td colSpan={2}></td>
													<td className="py-1 px-2 text-right">
														{product.returnTotalAmount.toFixed(2)}
													</td>
													<td colSpan={2}></td>
												</tr>

												{/* Net Total Sales */}
												<tr className="border-y border-gray-400 bg-gray-100 text-[11px] font-bold text-gray-900">
													<td colSpan={8} className="py-1 px-2 text-left">
														Net Total Sales of {product.name}
													</td>
													<td className="py-1 px-1.5 text-right">
														{product.salesTotalQty - product.returnTotalQty}
													</td>
													<td className="py-1 px-1 text-right">
														{product.salesTotalFree - product.returnTotalFree || ""}
													</td>
													<td colSpan={2}></td>
													<td className="py-1 px-2 text-right">
														{(product.salesTotalAmount - product.returnTotalAmount).toFixed(2)}
													</td>
													<td colSpan={2}></td>
												</tr>
											</>
										)}
									</React.Fragment>
								);
							})}

							{/* REPORT GRAND TOTALS */}
							<tr className="border-t-2 border-b-2 border-gray-900 bg-gray-100 font-extrabold text-xs text-gray-900">
								<td colSpan={8} className="py-2.5 px-2 text-left">
									Grand Total Sales :
								</td>
								<td className="py-2.5 px-1.5 text-right text-blue-800">
									{grandSalesQty}
								</td>
								<td className="py-2.5 px-1 text-right">
									{grandSalesFree || ""}
								</td>
								<td colSpan={2}></td>
								<td className="py-2.5 px-2 text-right text-blue-800">
									{grandSalesAmount.toFixed(2)}
								</td>
								<td colSpan={2}></td>
							</tr>

							{grandReturnQty > 0 && (
								<>
									<tr className="border-b border-gray-400 bg-rose-50/50 font-extrabold text-xs text-rose-900">
										<td colSpan={8} className="py-2 px-2 text-left">
											Grand Total Sales Return :
										</td>
										<td className="py-2 px-1.5 text-right text-rose-700">
											{grandReturnQty}
										</td>
										<td className="py-2 px-1 text-right">
											{grandReturnFree || ""}
										</td>
										<td colSpan={2}></td>
										<td className="py-2 px-2 text-right text-rose-700">
											{grandReturnAmount.toFixed(2)}
										</td>
										<td colSpan={2}></td>
									</tr>
									<tr className="border-b-2 border-gray-900 bg-emerald-50 font-extrabold text-xs text-emerald-950">
										<td colSpan={8} className="py-2 px-2 text-left">
											Net Grand Total Sales :
										</td>
										<td className="py-2 px-1.5 text-right text-emerald-800">
											{grandSalesQty - grandReturnQty}
										</td>
										<td className="py-2 px-1 text-right">
											{grandSalesFree - grandReturnFree || ""}
										</td>
										<td colSpan={2}></td>
										<td className="py-2 px-2 text-right text-emerald-800">
											{(grandSalesAmount - grandReturnAmount).toFixed(2)}
										</td>
										<td colSpan={2}></td>
									</tr>
								</>
							)}
						</tbody>
					</table>
				</div>
			</div>
		);
	}

	// Fallback to local DB products & sales tables (when legacy procedure returned no data or wasn't invoked)
	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	// Inventory
	const inventoryMap = new Map<string, number>();
	if (mrInfo.canViewStock && productIds.length > 0) {
		let inventoryCondition = and(
			inArray(mrInventory.productId, productIds),
			eq(mrInventory.mrId, mrId),
		);
		if (searchParams?.to) {
			const toDate = new Date(searchParams.to);
			if (!isNaN(toDate.getTime())) {
				toDate.setUTCHours(23, 59, 59, 999);
				inventoryCondition = and(
					inventoryCondition,
					lte(mrInventory.date, toDate),
				);
			}
		}

		const inventory = await db
			.select()
			.from(mrInventory)
			.where(inventoryCondition);

		inventory.forEach((inv) => {
			inventoryMap.set(inv.productId, inv.stock || 0);
		});
	}

	// Sales
	let salesCondition = and(
		inArray(sales.productId, productIds),
		eq(sales.mrId, mrId),
	);
	if (searchParams?.from) {
		const fromDate = new Date(searchParams.from);
		if (!isNaN(fromDate.getTime())) {
			salesCondition = and(salesCondition, gte(sales.date, fromDate));
		}
	}
	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			salesCondition = and(salesCondition, lte(sales.date, toDate));
		}
	}

	const accessibleSales =
		mrInfo.canViewSales && productIds.length > 0
			? await db
					.select({
						productId: sales.productId,
						quantity: sales.quantity,
						amount: sales.amount,
					})
					.from(sales)
					.where(salesCondition)
			: [];

	const salesMap = new Map<string, { qty: number; amount: number }>();
	accessibleSales.forEach((s) => {
		const curr = salesMap.get(s.productId) || { qty: 0, amount: 0 };
		curr.qty += s.quantity || 0;
		curr.amount += s.amount ? parseFloat(s.amount.toString()) : 0;
		salesMap.set(s.productId, curr);
	});

	let fallbackData = accessibleProducts.map((p) => {
		const s = salesMap.get(p.id) || { qty: 0, amount: 0 };
		return {
			Manufacturer: p.manufacturer,
			"Product Name": p.name,
			"Free Scheme": p.freeScheme || "N/A",
			"Current Stock": inventoryMap.get(p.id) || 0,
			"Total Sales Qty": s.qty,
			"Total Sales Amt": s.amount,
		};
	});

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		fallbackData = fallbackData.filter(
			(d) =>
				d["Product Name"].toLowerCase().includes(q) ||
				d["Manufacturer"].toLowerCase().includes(q),
		);
	}

	const manufacturers = [
		...new Set(fallbackData.map((d) => d.Manufacturer)),
	].sort();

	return (
		<div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{/* DEBUG QUERY BANNER */}
			<div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-mono text-xs text-amber-950 shadow-sm print:hidden">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2 mb-2 font-bold text-amber-900 text-xs">
					<span>[DEBUG QUERY] Stored Procedure Execution Status</span>
					<span className="rounded bg-amber-200 px-2 py-0.5 text-[11px] font-semibold">
						{procSalesResult.success
							? `${procSalesResult.data?.length ?? 0} rows returned`
							: procSalesResult.error || "Query Not Run"}
					</span>
				</div>
				<div className="space-y-1.5">
					<p className="font-bold text-amber-900 text-[11px]">Final SQL Query being run:</p>
					<pre className="overflow-x-auto rounded border border-amber-200 bg-amber-100 p-2.5 text-[11px] font-mono select-all whitespace-pre-wrap break-all text-amber-950">
						{procSalesResult.debugSql ||
							`-- Procedure was not called because 'from' and/or 'to' date parameters are missing in searchParams.\n-- Current searchParams: from=${searchParams?.from || "NOT PROVIDED"}, to=${searchParams?.to || "NOT PROVIDED"}, division=${searchParams?.division || "All"}`}
					</pre>
					<div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-amber-800 pt-1.5 border-t border-amber-200">
						<div><span className="font-semibold">Company Code Query:</span> {JSON.stringify(compCodeToQuery)}</div>
						<div><span className="font-semibold">MR Company:</span> {mrInfo.company || "N/A"}</div>
						<div><span className="font-semibold">MR Code:</span> {mrInfo.companyCode || "N/A"}</div>
						<div><span className="font-semibold">LocNo:</span> {mrInfo.locNo || "11"}</div>
					</div>
				</div>
			</div>

			{/* HEADER */}
			<div className="border-b-2 border-gray-900 pb-2">
				<div className="flex items-start gap-4">
					<Image
						src="/logo.png"
						alt="Asmee Pharma Logo"
						width={140}
						height={45}
						className="object-contain"
						priority
					/>
					<div>
						<h2 className="font-extrabold text-base tracking-tight text-gray-900 uppercase">
							ASMEE PHARMA PRIVATE LIMITED
						</h2>
						<p className="mt-0.5 text-[11px] leading-tight text-gray-700">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,
							<br />
							RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br />
							Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
						</p>
					</div>
				</div>

				<div className="mt-3 flex items-center justify-between border-t border-gray-300 pt-1.5 text-xs font-bold text-gray-900">
					<div>Year : 2026-27</div>
					<div className="text-center font-extrabold text-xs text-[#0B2545]">
						Itemwise/Customerwise Sales for Period of {fromDisplay} to {toDisplay}
					</div>
					<div>Total Items: {fallbackData.length}</div>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-t border-gray-300 pt-2">
				<table className="w-full min-w-[900px] border-collapse text-left font-sans text-xs">
					<thead>
						<tr className="border-y-2 border-gray-900 bg-gray-50">
							<th className="py-2 pl-2 font-bold text-gray-900">Product Name</th>
							{mrInfo.canViewFreeScheme && (
								<th className="py-2 font-bold text-gray-900">Free Scheme</th>
							)}
							{mrInfo.canViewStock && (
								<th className="py-2 text-right font-bold text-gray-900">Current Stock</th>
							)}
							{mrInfo.canViewSales && (
								<th className="py-2 text-right font-bold text-gray-900">Total Sales Qty</th>
							)}
							{mrInfo.canViewSales && (
								<th className="py-2 pr-2 text-right font-bold text-gray-900">Total Sales Amt</th>
							)}
						</tr>
					</thead>
					<tbody>
						{manufacturers.length === 0 ? (
							<tr>
								<td colSpan={5} className="py-6 text-center text-gray-500 font-medium">
									No records found for the selected period.
								</td>
							</tr>
						) : (
							manufacturers.map((mfg, idx) => {
								const mfgData = fallbackData.filter((d) => d.Manufacturer === mfg);
								return (
									<React.Fragment key={idx}>
										<tr>
											<td
												className="border-gray-200 border-b bg-gray-50 px-2 py-1.5 font-bold text-[#002b66]"
												colSpan={5}
											>
												Company : {mfg.toUpperCase()}
											</td>
										</tr>
										{mfgData.map((row, rowIdx) => (
											<tr
												className="border-b border-gray-100 hover:bg-gray-50 text-gray-800"
												key={rowIdx}
											>
												<td className="whitespace-nowrap py-1.5 pl-2">
													{row["Product Name"]}
												</td>
												{mrInfo.canViewFreeScheme && (
													<td className="py-1.5 font-bold text-blue-600">
														{row["Free Scheme"]}
													</td>
												)}
												{mrInfo.canViewStock && (
													<td className="py-1.5 text-right font-bold text-amber-600">
														{row["Current Stock"]}
													</td>
												)}
												{mrInfo.canViewSales && (
													<td className="py-1.5 text-right font-bold text-[#0071BC]">
														{row["Total Sales Qty"]}
													</td>
												)}
												{mrInfo.canViewSales && (
													<td className="py-1.5 pr-2 text-right font-bold text-rose-600">
														{row["Total Sales Amt"].toFixed(2)}
													</td>
												)}
											</tr>
										))}
									</React.Fragment>
								);
							})
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
