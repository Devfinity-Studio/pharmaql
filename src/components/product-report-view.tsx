import { and, eq, gte, inArray, lte } from "drizzle-orm";
import React from "react";
import { db } from "@/server/db";
import {
	mrInventory,
	mrManufacturers,
	products,
	sales,
	user,
} from "@/server/db/schema";

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
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || !mrInfo.canViewProductWise)
		return <div>No access to products data.</div>;

	const company = searchParams?.division || "All";
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));
	const manufacturerNames = assigned.map((a) => a.manufacturer);
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0) return <div>No data assigned</div>;

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) return <div>No products found</div>;

	// Inventory (to get Current Stock for reference if they want it)
	const inventoryMap = new Map<string, number>();
	if (mrInfo.canViewStock) {
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

		// Sort by date ascending so latest record overwrites
		inventory.sort((a, b) => {
			const da = a.date ? new Date(a.date).getTime() : 0;
			const dbVal = b.date ? new Date(b.date).getTime() : 0;
			return da - dbVal;
		});

		inventory.forEach((inv) => {
			inventoryMap.set(inv.productId, inv.stock || 0);
		});
	}

	// Fetch Sales
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

	const accessibleSales = mrInfo.canViewSales
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

	let reportData = accessibleProducts.map((p) => {
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
			{/* Header */}
			<div className="mb-2 flex flex-col items-start justify-between gap-4 border-[#0B2545] border-b-2 pb-2 md:flex-row">
				<div className="flex items-center gap-4">
					<div className="font-black text-5xl text-[#0B2545] italic">A</div>
					<div>
						<h2 className="font-extrabold text-2xl text-[#0B2545] tracking-tight">
							ASMEE PHARMA PRIVATE LIMITED
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
