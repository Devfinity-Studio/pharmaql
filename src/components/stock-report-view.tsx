import React from "react";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { mrInventory, mrManufacturers, products, sales, user } from "@/server/db/schema";


export async function StockReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
	};
}) {
	// Fetch data
	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || !mrInfo.canViewStock) return <div>No access to stock data.</div>;

	const company = searchParams?.division || "All";

	const assignments = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	const manufacturerNames = assignments.map((a) => a.manufacturer);
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0) return <div>No data assigned</div>;

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) return <div>No products found</div>;

	// Inventory
	let inventoryCondition = and(inArray(mrInventory.productId, productIds), eq(mrInventory.mrId, mrId));
	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			inventoryCondition = and(inventoryCondition, lte(mrInventory.date, toDate));
		}
	}

	const inventory = await db
		.select()
		.from(mrInventory)
		.where(inventoryCondition);

	// Sort by date ascending
	inventory.sort((a, b) => {
		const da = a.date ? new Date(a.date).getTime() : 0;
		const dbVal = b.date ? new Date(b.date).getTime() : 0;
		return da - dbVal;
	});

	const inventoryMap = new Map<string, { opening: number; inward: number; outward: number; stock: number; ptr: number; mrp: number; prate: number; hasSeenInPeriod?: boolean }>();
	const limitFromDate = searchParams?.from ? new Date(searchParams.from) : null;

	inventory.forEach((inv) => {
		const isBefore = limitFromDate && inv.date && new Date(inv.date) < limitFromDate;
		const existing = inventoryMap.get(inv.productId);

		if (isBefore) {
			inventoryMap.set(inv.productId, {
				opening: inv.stock || 0,
				inward: 0,
				outward: 0,
				stock: inv.stock || 0,
				ptr: Number(inv.ptr) || 0,
				mrp: Number(inv.mrp) || 0,
				prate: Number(inv.prate) || 0,
				hasSeenInPeriod: false,
			});
		} else {
			if (!existing) {
				inventoryMap.set(inv.productId, {
					opening: inv.opening || 0,
					inward: inv.inward || 0,
					outward: inv.outward || 0,
					stock: inv.stock || 0,
					ptr: Number(inv.ptr) || 0,
					mrp: Number(inv.mrp) || 0,
					prate: Number(inv.prate) || 0,
					hasSeenInPeriod: true,
				});
			} else {
				if (!existing.hasSeenInPeriod) {
					existing.opening = inv.opening || 0;
					existing.inward = inv.inward || 0;
					existing.outward = inv.outward || 0;
					existing.stock = inv.stock || 0;
					existing.hasSeenInPeriod = true;
				} else {
					existing.inward += inv.inward || 0;
					existing.outward += inv.outward || 0;
					existing.stock = inv.stock || 0;
				}
				existing.ptr = Number(inv.ptr) || existing.ptr;
				existing.mrp = Number(inv.mrp) || existing.mrp;
				existing.prate = Number(inv.prate) || existing.prate;
			}
		}
	});

	// Sales (to get Sales Qty)
	const salesMap = new Map<string, number>();
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

	const accessibleSales = await db
		.select({
			productId: sales.productId,
			quantity: sales.quantity,
		})
		.from(sales)
		.where(salesCondition);

	accessibleSales.forEach(s => {
		salesMap.set(s.productId, (salesMap.get(s.productId) || 0) + (s.quantity || 0));
	});

	// Transform data for rendering
	const reportData: any[] = [];
	accessibleProducts.forEach((p) => {
		const inv = inventoryMap.get(p.id);
		// Include if inventory exists or sales exist
		if (inv || salesMap.get(p.id)) {
			const opening = inv?.opening || 0;
			const inward = inv?.inward || 0;
			const purchase = inward;
			const sRet = 0;
			const pRet = 0;
			const salesQty = salesMap.get(p.id) || inv?.outward || 0;
			
			const actualBalance = inv?.stock || 0;
			const expectedBalance = opening + purchase - sRet - salesQty - pRet;
			
			let stkAdjAdd = 0;
			let stkAdjLess = 0;
			
			if (actualBalance > expectedBalance) {
				stkAdjAdd = actualBalance - expectedBalance;
			} else if (actualBalance < expectedBalance) {
				stkAdjLess = expectedBalance - actualBalance;
			}
			
			const totalIn = opening + purchase - sRet + stkAdjAdd;
			
			const balanceQty = inv?.stock || (totalIn - salesQty - pRet - stkAdjLess); // Fallback
			const ptr = inv?.ptr || 0;
			const prate = inv?.prate || 0;
			const stockValue = balanceQty * prate;

			reportData.push({
				Manufacturer: p.manufacturer,
				"Item Name": p.name,
				Packing: p.freeScheme || "-",
				"Purc Days": 30, // Default to 30 days
				"Opening Qty.": opening,
				"Purchase Qty": purchase,
				"S.Ret Qty.": sRet,
				"Stk Adj Add": stkAdjAdd,
				"Total In Qty": totalIn,
				"Sales Qty.": salesQty,
				"P.Ret Qty.": pRet,
				"Stk Adj Less": stkAdjLess,
				"Balance Qty.": balanceQty,
				"Stock Value": stockValue,
				"Opening Value": opening * prate,
				"Purchase Value": purchase * prate,
				"Sales Value": salesQty * prate,
				prate: prate,
				ptr: ptr
			});
		}
	});

	// Grouping by Manufacturer
	const manufacturers = [...new Set(reportData.map((d) => d.Manufacturer))].sort();
	let grandTotalOpeningValue = 0;
	let grandTotalPurchaseValue = 0;
	let grandTotalSalesValue = 0;
	let grandTotalStockValue = 0;

	return (
		<div className="space-y-8 mt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-6 overflow-hidden">
			{/* Header */}
			<div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-2 border-b-2 border-[#0B2545] pb-2">
				<div className="flex gap-4 items-center">
					<div className="text-[#0B2545] font-black italic text-5xl">A</div>
					<div>
						<h2 className="font-extrabold text-[#0B2545] text-xl tracking-tight">ASMEE PHARMA PRIVATE LIMITED</h2>
						<p className="text-xs text-gray-500 font-medium mt-0.5 max-w-sm leading-relaxed">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD, RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br/>Contact: 9409789800, 9409789700 Mobile: 9409789700
						</p>
					</div>
				</div>
				<div className="text-right text-[10px] text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-medium leading-normal self-stretch md:self-auto flex flex-col justify-center">
					<p className="font-bold text-[#0B2545] text-xs">Stock Movement Statement</p>
					<p className="mt-1">For the Period of : <span className="font-bold">{searchParams?.from || "01/04/2026"}</span> to <span className="font-bold">{searchParams?.to || "30/04/2026"}</span></p>
					<p className="mt-0.5">Purc Days : <span className="font-bold">Difference between last purchase date and today's date</span></p>
					<p className="mt-2 text-base">Value Calc. on : <span className="font-extrabold">PRate</span></p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-t-2 border-[#0B2545] pt-1">
				<table className="w-full min-w-[1200px] text-left border-collapse font-sans">
					<thead>
						<tr className="border-y-2 border-[#0B2545]">
							<th className="py-2 text-[#0B2545] font-bold text-sm w-64">Item Name</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-center">Packing</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Purc<br/>Days</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Opening<br/>Qty.</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Purchase<br/>Qty</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">S.Ret<br/>Qty.</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Stk Adj<br/>Add</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Total<br/>In Qty</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Sales<br/>Qty.</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">P.Ret<br/>Qty.</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Stk Adj<br/>Less</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Balance<br/>Qty.</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right pr-2">Stock<br/>Value</th>
						</tr>
					</thead>
					<tbody className="text-sm font-medium">
						{manufacturers.map((mfg, idx) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							let mfgOpeningValue = 0;
							let mfgPurchaseValue = 0;
							let mfgSalesValue = 0;
							let mfgStockValue = 0;

							return (
								<React.Fragment key={idx}>
									{/* Company Header Row */}
									<tr>
										<td colSpan={13} className="py-2 font-bold text-[#000080] border-b border-gray-200 bg-gray-50/50 px-2">
											Company : {mfg.toUpperCase()} - {mfg.split(" ")[0].toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgOpeningValue += row["Opening Value"];
										mfgPurchaseValue += row["Purchase Value"];
										mfgSalesValue += row["Sales Value"];
										mfgStockValue += row["Stock Value"];

										return (
											<tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50 text-[#0B2545]">
												<td className="py-1.5 whitespace-nowrap pl-2">{row["Item Name"]}</td>
												<td className="py-1.5 text-center text-gray-500">{row["Packing"] || "-"}</td>
												<td className="py-1.5 text-right">{row["Purc Days"]}</td>
												<td className="py-1.5 text-right">{row["Opening Qty."] || "-"}</td>
												<td className="py-1.5 text-right">{row["Purchase Qty"] || "-"}</td>
												<td className="py-1.5 text-right">{row["S.Ret Qty."] !== 0 ? row["S.Ret Qty."] : "-"}</td>
												<td className="py-1.5 text-right">{row["Stk Adj Add"] !== 0 ? row["Stk Adj Add"] : "-"}</td>
												<td className="py-1.5 text-right">{row["Total In Qty"] || "-"}</td>
												<td className="py-1.5 text-right">{row["Sales Qty."] || "-"}</td>
												<td className="py-1.5 text-right">{row["P.Ret Qty."] !== 0 ? row["P.Ret Qty."] : "-"}</td>
												<td className="py-1.5 text-right">{row["Stk Adj Less"] !== 0 ? row["Stk Adj Less"] : "-"}</td>
												<td className="py-1.5 text-right">{row["Balance Qty."] || "-"}</td>
												<td className="py-1.5 text-right pr-2">{row["Stock Value"] ? row["Stock Value"].toFixed(2) : "0.00"}</td>
											</tr>
										);
									})}
									{/* Company Total */}
									{(() => {
										grandTotalOpeningValue += mfgOpeningValue;
										grandTotalPurchaseValue += mfgPurchaseValue;
										grandTotalSalesValue += mfgSalesValue;
										grandTotalStockValue += mfgStockValue;
										return (
											<tr className="border-y border-gray-300 font-bold text-[#0B2545] bg-gray-50/50">
												<td colSpan={3} className="py-2 pl-2">Total value of {mfg.split(" ")[0].toUpperCase()} :</td>
												<td className="py-2 text-right">{mfgOpeningValue.toFixed(2)}</td>
												<td className="py-2 text-right">{mfgPurchaseValue.toFixed(2)}</td>
												<td colSpan={3}></td>
												<td className="py-2 text-right">{mfgSalesValue.toFixed(2)}</td>
												<td colSpan={3}></td>
												<td className="py-2 text-right pr-2">{mfgStockValue.toFixed(2)}</td>
											</tr>
										);
									})()}
									{/* Full Company Total */}
									<tr className="border-b-2 border-gray-400 font-bold text-[#0B2545] bg-gray-50">
										<td colSpan={3} className="py-2 pl-2">Total value of {mfg.toUpperCase()} :</td>
										<td className="py-2 text-right">{mfgOpeningValue.toFixed(2)}</td>
										<td className="py-2 text-right">{mfgPurchaseValue.toFixed(2)}</td>
										<td colSpan={3}></td>
										<td className="py-2 text-right">{mfgSalesValue.toFixed(2)}</td>
										<td colSpan={3}></td>
										<td className="py-2 text-right pr-2">{mfgStockValue.toFixed(2)}</td>
									</tr>
								</React.Fragment>
							);
						})}
						{/* Grand Total */}
						<tr className="border-b-4 border-[#0B2545] font-extrabold text-[#0B2545] bg-gray-100 text-base">
							<td colSpan={3} className="py-3 pl-2">Total Value :</td>
							<td className="py-3 text-right">{grandTotalOpeningValue.toFixed(2)}</td>
							<td className="py-3 text-right">{grandTotalPurchaseValue.toFixed(2)}</td>
							<td colSpan={3}></td>
							<td className="py-3 text-right">{grandTotalSalesValue.toFixed(2)}</td>
							<td colSpan={3}></td>
							<td className="py-3 text-right pr-2">{grandTotalStockValue.toFixed(2)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
