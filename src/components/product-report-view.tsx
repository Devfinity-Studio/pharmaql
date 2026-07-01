import React from "react";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { mrInventory, mrManufacturers, products, sales, user } from "@/server/db/schema";

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
	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || !mrInfo.canViewProductWise) return <div>No access to products data.</div>;

	const company = searchParams?.division || "All";
	const assigned = await db.select().from(mrManufacturers).where(eq(mrManufacturers.mrId, mrId));
	const manufacturerNames = assigned.map((a) => a.manufacturer);
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0) return <div>No data assigned</div>;

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) return <div>No products found</div>;

	// Inventory (to get Current Stock for reference if they want it, but the old one didn't show stock for products, only sales. Wait, we can include it)
	const inventoryMap = new Map<string, number>();
	if (mrInfo.canViewStock) {
		const inventory = await db
			.select()
			.from(mrInventory)
			.where(and(inArray(mrInventory.productId, productIds), eq(mrInventory.mrId, mrId)));
		inventory.forEach((inv) => {
			inventoryMap.set(inv.productId, inv.stock || 0);
		});
	}

	// Fetch Sales
	let salesCondition = and(inArray(sales.productId, productIds), eq(sales.mrId, mrId));
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

	const accessibleSales = mrInfo.canViewSales ? await db
		.select({
			productId: sales.productId,
			quantity: sales.quantity,
			amount: sales.amount,
		})
		.from(sales)
		.where(salesCondition) : [];

	const salesMap = new Map<string, { qty: number; amount: number }>();
	accessibleSales.forEach(s => {
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
		reportData = reportData.filter(d => 
			d["Product Name"].toLowerCase().includes(q) || 
			d["Manufacturer"].toLowerCase().includes(q)
		);
	}

	// Grouping by Manufacturer
	const manufacturers = [...new Set(reportData.map((d) => d.Manufacturer))].sort();
	let grandTotalSales = 0;
	let grandTotalAmount = 0;

	return (
		<div className="space-y-8 mt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-6 overflow-hidden">
			{/* Header */}
			<div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-2 border-b-2 border-[#0B2545] pb-2">
				<div className="flex gap-4 items-center">
					<div className="text-[#0B2545] font-black italic text-5xl">A</div>
					<div>
						<h2 className="font-extrabold text-[#0B2545] text-2xl tracking-tight">ASMEE PHARMA PRIVATE LIMITED</h2>
						<p className="text-sm text-[#0B2545] font-medium mt-1 leading-relaxed">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD,
							<br/>RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br/>Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
						</p>
					</div>
				</div>
			</div>

			<div className="flex justify-between items-end mb-4 text-[#0B2545] font-bold text-sm">
				<div>
					<p>Year : 2026-27</p>
					<p className="text-base mt-2">Product Wise Statement for the Period of {searchParams?.from || "Start"} to {searchParams?.to || "End"}</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-t-2 border-[#0B2545] pt-1">
				<table className="w-full min-w-[900px] text-left border-collapse font-sans">
					<thead>
						<tr className="border-y-2 border-[#0B2545]">
							<th className="py-2 pl-2 text-[#0B2545] font-bold text-sm">Product Name</th>
							{mrInfo.canViewFreeScheme && <th className="py-2 text-[#0B2545] font-bold text-sm">Free Scheme</th>}
							{mrInfo.canViewStock && <th className="py-2 text-[#0B2545] font-bold text-sm text-right">Current Stock</th>}
							{mrInfo.canViewSales && <th className="py-2 text-[#0B2545] font-bold text-sm text-right">Total Sales Qty</th>}
							{mrInfo.canViewSales && <th className="py-2 text-[#0B2545] font-bold text-sm text-right pr-2">Total Sales Amt</th>}
						</tr>
					</thead>
					<tbody className="text-sm font-medium">
						{manufacturers.map((mfg, idx) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							let mfgSales = 0;
							let mfgAmount = 0;

							return (
								<React.Fragment key={idx}>
									{/* Company Header Row */}
									<tr>
										<td colSpan={5} className="py-2 font-bold text-[#000080] border-b border-gray-200 bg-gray-50/50 px-2">
											Company : {mfg.toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgSales += row["Total Sales Qty"];
										mfgAmount += row["Total Sales Amt"];

										return (
											<tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50 text-[#0B2545]">
												<td className="py-1.5 whitespace-nowrap pl-2">{row["Product Name"]}</td>
												{mrInfo.canViewFreeScheme && <td className="py-1.5 text-blue-600 font-bold">{row["Free Scheme"]}</td>}
												{mrInfo.canViewStock && <td className="py-1.5 text-right font-bold text-amber-600">{row["Current Stock"]}</td>}
												{mrInfo.canViewSales && <td className="py-1.5 text-right font-bold text-[#0071BC]">{row["Total Sales Qty"]}</td>}
												{mrInfo.canViewSales && <td className="py-1.5 text-right pr-2 font-bold text-rose-600">{row["Total Sales Amt"].toFixed(2)}</td>}
											</tr>
										);
									})}
									{/* Full Company Total */}
									<tr className="border-b-2 border-gray-400 font-bold text-[#0B2545] bg-gray-50">
										<td colSpan={mrInfo.canViewFreeScheme ? 2 : 1} className="py-2 pl-2">Total for {mfg.toUpperCase()} :</td>
										{mrInfo.canViewStock && <td className="py-2"></td>}
										{mrInfo.canViewSales && <td className="py-2 text-right text-[#0071BC]">{mfgSales}</td>}
										{mrInfo.canViewSales && <td className="py-2 text-right pr-2 text-rose-700">{mfgAmount.toFixed(2)}</td>}
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
							<tr className="border-b-4 border-[#0B2545] font-extrabold text-[#0B2545] bg-gray-100 text-base">
								<td colSpan={mrInfo.canViewFreeScheme ? 2 : 1} className="py-3 pl-2">Grand Total :</td>
								{mrInfo.canViewStock && <td className="py-3"></td>}
								<td className="py-3 text-right text-[#0071BC]">{grandTotalSales}</td>
								<td className="py-3 text-right pr-2 text-rose-700">{grandTotalAmount.toFixed(2)}</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
