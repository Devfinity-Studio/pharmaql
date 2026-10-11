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
} from "@/server/actions/customerItemSale";

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
	// Fetch data
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

	if (companiesToQuery.length === 0 && !mrInfo.companyCode) return <div>No data assigned</div>;

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

	let reportData: Array<{
		Manufacturer: string;
		"Product Name": string;
		"Free Scheme": string;
		"Current Stock": number;
		"Total Sales Qty": number;
		"Total Sales Amt": number;
	}> = [];

	if (procSalesResult.success && procSalesResult.data && procSalesResult.data.length > 0) {
		// Aggregate procedure results by product
		const productAgg = new Map<
			string,
			{
				name: string;
				code: string;
				packing: string;
				qty: number;
				freeQty: number;
				amount: number;
				manufacturer: string;
			}
		>();

		for (const row of procSalesResult.data) {
			const key = row.ItemCode || String(row.ItemID) || row.ItemName;
			const current = productAgg.get(key) || {
				name: row.ItemName || "Unknown Item",
				code: row.ItemCode || "",
				packing: row.Packing || "N/A",
				qty: 0,
				freeQty: 0,
				amount: 0,
				manufacturer: mrInfo.company || (company !== "All" ? company : "All"),
			};
			current.qty += Number(row.Qty || 0);
			current.freeQty += Number(row.FQty || 0);
			current.amount += Number(row.IAmt || 0);
			productAgg.set(key, current);
		}

		reportData = Array.from(productAgg.values()).map((p) => ({
			Manufacturer: p.manufacturer,
			"Product Name": p.name,
			"Free Scheme": p.packing || "N/A",
			"Current Stock": 0,
			"Total Sales Qty": p.qty,
			"Total Sales Amt": p.amount,
		}));
	} else {
		// Fallback to local DB products & sales tables
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

			inventory.sort((a, b) => {
				const da = a.date ? new Date(a.date).getTime() : 0;
				const dbVal = b.date ? new Date(b.date).getTime() : 0;
				return da - dbVal;
			});

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

		const accessibleSales = mrInfo.canViewSales && productIds.length > 0
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

		reportData = accessibleProducts.map((p) => {
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
	}

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		reportData = reportData.filter(
			(d) =>
				d["Product Name"].toLowerCase().includes(q) ||
				d["Manufacturer"].toLowerCase().includes(q),
		);
	}

	// Grouping by Manufacturer
	const manufacturers = [
		...new Set(reportData.map((d) => d.Manufacturer)),
	].sort();
	let grandTotalSales = 0;
	let grandTotalAmount = 0;

	return (
		<div className="mt-4 space-y-8 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{/* TEMPORARY DEBUG BANNER */}
			<div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-mono text-xs text-amber-950 shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2 mb-2 font-bold text-amber-900 text-sm">
					<span>[TEMP DEBUG] Stored Procedure SQL Query & Execution</span>
					<span className="rounded bg-amber-200 px-2.5 py-0.5 text-xs font-semibold">
						{procSalesResult.success
							? `Success: ${procSalesResult.data?.length ?? 0} rows returned`
							: procSalesResult.error
								? `Error: ${procSalesResult.error}`
								: "Not Executed (Date filters missing)"}
					</span>
				</div>
				<div className="space-y-1">
					<p className="font-bold text-amber-900">Final SQL Query being run:</p>
					<pre className="overflow-x-auto rounded border border-amber-200 bg-amber-100 p-2 text-xs font-mono select-all whitespace-pre-wrap break-all text-amber-950">
						{procSalesResult.debugSql ||
							`-- Procedure was not called because dates were missing in searchParams.\n-- Current searchParams: from=${searchParams?.from || "none"}, to=${searchParams?.to || "none"}`}
					</pre>
					<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-amber-800 pt-1 border-t border-amber-200">
						<div><span className="font-semibold">Company Code Query:</span> {JSON.stringify(compCodeToQuery)}</div>
						<div><span className="font-semibold">MR Company:</span> {mrInfo.company || "N/A"}</div>
						<div><span className="font-semibold">MR Code:</span> {mrInfo.companyCode || "N/A"}</div>
						<div><span className="font-semibold">LocNo:</span> {mrInfo.locNo || "11"}</div>
					</div>
				</div>
			</div>

			{/* Header */}
			<div className="mb-2 flex flex-col items-start justify-between gap-4 border-[#0B2545] border-b-2 pb-2 md:flex-row">
				<div className="flex items-center gap-4">
					<div>
						<h2 className="font-extrabold text-2xl text-[#0B2545] tracking-tight">
							<Image src="/logo.png" alt="Asmee Pharma Logo" width={180} height={50} className="object-contain" priority />
						</h2>
						<p className="mt-1 font-medium text-[#0B2545] text-sm leading-relaxed">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP
							ROAD,
							<br />
							RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br />
							Contact: 9409789800, 9409789700 Mobile: 9409789700 Email:
							asmeepharma2022@gmail.com
						</p>
					</div>
				</div>
			</div>

			<div className="mb-4 flex items-end justify-between font-bold text-[#0B2545] text-sm">
				<div>
					<p>Year : 2026-27</p>
					<p className="mt-2 text-base">
						Product Wise Statement for the Period of{" "}
						{searchParams?.from || "Start"} to {searchParams?.to || "End"}
					</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-[#0B2545] border-t-2 pt-1">
				<table className="w-full min-w-[900px] border-collapse text-left font-sans">
					<thead>
						<tr className="border-[#0B2545] border-y-2">
							<th className="py-2 pl-2 font-bold text-[#0B2545] text-sm">
								Product Name
							</th>
							{mrInfo.canViewFreeScheme && (
								<th className="py-2 font-bold text-[#0B2545] text-sm">
									Free Scheme
								</th>
							)}
							{mrInfo.canViewStock && (
								<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
									Current Stock
								</th>
							)}
							{mrInfo.canViewSales && (
								<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
									Total Sales Qty
								</th>
							)}
							{mrInfo.canViewSales && (
								<th className="py-2 pr-2 text-right font-bold text-[#0B2545] text-sm">
									Total Sales Amt
								</th>
							)}
						</tr>
					</thead>
					<tbody className="font-medium text-sm">
						{manufacturers.map((mfg, idx) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							let mfgSales = 0;
							let mfgAmount = 0;

							return (
								<React.Fragment key={idx}>
									{/* Company Header Row */}
									<tr>
										<td
											className="border-gray-200 border-b bg-gray-50/50 px-2 py-2 font-bold text-[#000080]"
											colSpan={5}
										>
											Company : {mfg.toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgSales += row["Total Sales Qty"];
										mfgAmount += row["Total Sales Amt"];

										return (
											<tr
												className="border-gray-100 border-b text-[#0B2545] hover:bg-gray-50"
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
										);
									})}
									{/* Full Company Total */}
									<tr className="border-gray-400 border-b-2 bg-gray-50 font-bold text-[#0B2545]">
										<td
											className="py-2 pl-2"
											colSpan={mrInfo.canViewFreeScheme ? 2 : 1}
										>
											Total for {mfg.toUpperCase()} :
										</td>
										{mrInfo.canViewStock && <td className="py-2"></td>}
										{mrInfo.canViewSales && (
											<td className="py-2 text-right text-[#0071BC]">
												{mfgSales}
											</td>
										)}
										{mrInfo.canViewSales && (
											<td className="py-2 pr-2 text-right text-rose-700">
												{mfgAmount.toFixed(2)}
											</td>
										)}
									</tr>
									{(() => {
										grandTotalSales += mfgSales;
										grandTotalAmount += mfgAmount;
										return null;
									})()}
								</React.Fragment>
							);
						})}
						{/* Grand Total */}
						{mrInfo.canViewSales && (
							<tr className="border-[#0B2545] border-b-4 bg-gray-100 font-extrabold text-[#0B2545] text-base">
								<td
									className="py-3 pl-2"
									colSpan={mrInfo.canViewFreeScheme ? 2 : 1}
								>
									Grand Total :
								</td>
								{mrInfo.canViewStock && <td className="py-3"></td>}
								<td className="py-3 text-right text-[#0071BC]">
									{grandTotalSales}
								</td>
								<td className="py-3 pr-2 text-right text-rose-700">
									{grandTotalAmount.toFixed(2)}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
