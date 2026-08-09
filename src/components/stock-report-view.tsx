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
	if (!mrInfo || !mrInfo.canViewStock || !mrInfo.locNo) return <div>No access to stock data or location not assigned.</div>;

	const selectedDivision = searchParams?.division || "All";

	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	const selectedAssignments =
		selectedDivision === "All"
			? assigned
			: assigned.filter(
					(a) => (a.division || a.manufacturer) === selectedDivision,
			  );

	if (selectedAssignments.length === 0) return <div>No data assigned</div>;

	const productConditionList = selectedAssignments.map((d) => {
		const conditions: any[] = [eq(products.code, d.manufacturer)];
		if (d.division) {
			conditions.push(eq(products.division, d.division));
		}
		return and(...conditions);
	});

	const { or } = await import("drizzle-orm");

	const accessibleProducts = productConditionList.length > 0 
		? await db
			.select()
			.from(products)
			.where(or(...productConditionList))
		: [];
	
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

	const nextDayInventoryMap = new Map<string, number>();
	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCDate(toDate.getUTCDate() + 1);
			toDate.setUTCHours(0, 0, 0, 0);
			const nextInv = await db
				.select({
					productId: mrInventory.productId,
					opening: mrInventory.opening
				})
				.from(mrInventory)
				.where(
					and(
						eq(mrInventory.mrId, mrId),
						eq(mrInventory.date, toDate)
					)
				);
			nextInv.forEach(inv => {
				nextDayInventoryMap.set(inv.productId, inv.opening || 0);
			});
		}
	}

	// Sort by date ascending
	inventory.sort((a, b) => {
		const da = a.date ? new Date(a.date).getTime() : 0;
		const dbVal = b.date ? new Date(b.date).getTime() : 0;
		return da - dbVal;
	});

	const reportData: any[] = [];
	const limitFromDate = searchParams?.from ? new Date(searchParams.from) : new Date('2026-04-01T00:00:00.000Z');
	const limitToDate = searchParams?.to ? new Date(searchParams.to) : new Date('9999-12-31T23:59:59.999Z');
	if (searchParams?.to) limitToDate.setUTCHours(23, 59, 59, 999);

	// Calculate exact stock data from inventory
	const stockDataMap = new Map<string, { opening: number, inward: number, outward: number, prate: number, ptr: number }>();
	inventory.forEach((inv) => {
		const invDate = inv.date ? new Date(inv.date).getTime() : 0;
		const limitFromTime = limitFromDate ? limitFromDate.getTime() : 0;
		const limitToTime = limitToDate ? limitToDate.getTime() : new Date('9999-12-31T23:59:59.999Z').getTime();
		
		const existing = stockDataMap.get(inv.productId || "") || { opening: 0, inward: 0, outward: 0, prate: 0, ptr: 0 };
		
		// The exact match for limitFromDate, or closest prior gives the opening stock
		if (invDate <= limitFromTime) {
			existing.opening = inv.opening || 0;
			existing.prate = Number(inv.prate || existing.prate);
			existing.ptr = Number(inv.ptr || existing.ptr);
		}
		
		// Sum inward/outward for the selected period
		if (invDate >= limitFromTime && invDate <= limitToTime) {
			existing.inward += inv.inward || 0;
			existing.outward += inv.outward || 0;
			existing.prate = Math.max(existing.prate, Number(inv.prate || 0));
			existing.ptr = Math.max(existing.ptr, Number(inv.ptr || 0));
		}
		
		stockDataMap.set(inv.productId || "", existing);
	});

	const { sql } = await import("drizzle-orm");
	for (const p of accessibleProducts) {
		const res = await db.execute(sql`
			SELECT 
				SUM(a.inward) as inward,
				SUM(a.s_ret_inward) as s_ret_inward,
				SUM(a.add_stock_adj) as add_stock_adj,
				SUM(a.sale_qty + a.sale_f_qty) as sale_qty,
				SUM(a.outward) as outward,
				SUM(a.less_stock_adj) as less_stock_adj,
				SUM(a.curr_qty) as curr_qty,
				MAX(a.prate) as prate,
				MAX(a.ptr) as ptr,
				MAX(a.mrp) as mrp
			FROM (
				SELECT 0 as inward, 0 as s_ret_inward, 0 as add_stock_adj, 0 as sale_qty, 0 as sale_f_qty, 0 as outward, 0 as less_stock_adj, 0 as curr_qty,
				v.batch_id,
				MAX(h.prate) as prate, MAX(h.ptr) as ptr, MAX(h.mrp) as mrp
				FROM "pg-drizzle_legacy_view_stocks" v
				LEFT JOIN "pg-drizzle_legacy_h_batch" h ON h.id = v.batch_id AND h.item_id = v.item_id
				WHERE v.item_id = ${p.id} AND v.loc_no = ${mrInfo.locNo.toString()} AND v.t_date < ${(limitFromDate || new Date(0)).toISOString()}
				GROUP BY v.batch_id
				
				UNION ALL
				
				SELECT SUM(v.inward) as inward, SUM(v.s_ret_inward) as s_ret_inward, SUM(v.add_stock_adj) as add_stock_adj, SUM(v.sale_qty) as sale_qty, SUM(v.sale_f_qty) as sale_f_qty, SUM(v.outward) as outward, SUM(v.less_stock_adj) as less_stock_adj, SUM(v.qty) as curr_qty,
				v.batch_id,
				MAX(h.prate) as prate, MAX(h.ptr) as ptr, MAX(h.mrp) as mrp
				FROM "pg-drizzle_legacy_view_stocks" v
				LEFT JOIN "pg-drizzle_legacy_h_batch" h ON h.id = v.batch_id AND h.item_id = v.item_id
				WHERE v.item_id = ${p.id} AND v.loc_no = ${mrInfo.locNo.toString()} AND v.t_date >= ${(limitFromDate || new Date(0)).toISOString()} AND v.t_date <= ${limitToDate.toISOString()}
				GROUP BY v.batch_id
			) as a
		`);
		
		const r = res[0] as any;
		
		const stockData = stockDataMap.get(p.id);
		const opening = stockData?.opening || 0;
		const purchase = Number(r?.inward || 0);
		const salesQty = Number(r?.sale_qty || 0);

		const sRet = Number(r?.s_ret_inward || 0);
		const stkAdjAdd = Number(r?.add_stock_adj || 0);
		const pRet = Number(r?.outward || 0);
		const stkAdjLess = Number(r?.less_stock_adj || 0);
		
		const currQty = opening + purchase + sRet + stkAdjAdd - salesQty - pRet - stkAdjLess;

		if (opening !== 0 || purchase !== 0 || currQty !== 0 || salesQty !== 0) {
			const prate = Math.max(Number(stockData?.prate || 0), Number(r?.prate || 0));
			const ptr = Math.max(Number(stockData?.ptr || 0), Number(r?.ptr || 0));
			
			const stockValue = currQty * prate;
			const openingValue = opening * prate;
			const purchaseValue = purchase * prate;
			const salesValue = salesQty * prate;
			
			const totalIn = opening + purchase + sRet;

			reportData.push({
				Manufacturer: p.manufacturer,
				Division: p.division || p.manufacturer,
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
				"Balance Qty.": currQty,
				"Stock Value": stockValue,
				"Opening Value": openingValue,
				"Purchase Value": purchaseValue,
				"Sales Value": salesValue,
				prate: prate,
				ptr: ptr
			});
		}
	}

	// Grouping by Manufacturer then Division
	const manufacturersList = [...new Set(reportData.map((d) => d.Manufacturer))].sort();
	
	const grandTotalOpeningValue = reportData.reduce((sum, row) => sum + row["Opening Value"], 0);
	const grandTotalPurchaseValue = reportData.reduce((sum, row) => sum + row["Purchase Value"], 0);
	const grandTotalSalesValue = reportData.reduce((sum, row) => sum + row["Sales Value"], 0);
	const grandTotalStockValue = reportData.reduce((sum, row) => sum + row["Stock Value"], 0);

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
						{manufacturersList.map((mfg, idx) => {
							const mfgRows = reportData.filter((d) => d.Manufacturer === mfg);
							const divisionsList = [...new Set(mfgRows.map((d) => d.Division))].sort();
							
							const companyOpeningValue = mfgRows.reduce((sum, row) => sum + row["Opening Value"], 0);
							const companyPurchaseValue = mfgRows.reduce((sum, row) => sum + row["Purchase Value"], 0);
							const companySalesValue = mfgRows.reduce((sum, row) => sum + row["Sales Value"], 0);
							const companyStockValue = mfgRows.reduce((sum, row) => sum + row["Stock Value"], 0);

							return (
								<React.Fragment key={idx}>
									{divisionsList.map((div, divIdx) => {
										const divData = mfgRows.filter((d) => d.Division === div);
										const divOpeningValue = divData.reduce((sum, row) => sum + row["Opening Value"], 0);
										const divPurchaseValue = divData.reduce((sum, row) => sum + row["Purchase Value"], 0);
										const divSalesValue = divData.reduce((sum, row) => sum + row["Sales Value"], 0);
										const divStockValue = divData.reduce((sum, row) => sum + row["Stock Value"], 0);
										
										return (
											<React.Fragment key={divIdx}>
												{/* Division Header Row */}
												<tr>
													<td colSpan={13} className="py-2 font-bold text-[#000080] border-b border-gray-200 bg-gray-50/50 px-2">
														Company : {mfg.toUpperCase()} - {div.toUpperCase()}
													</td>
												</tr>
												{/* Items */}
												{divData.map((row, rowIdx) => {
													return (
														<tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50 text-[#0B2545]">
															<td className="py-1.5 whitespace-nowrap pl-2">{row["Item Name"]}</td>
															<td className="py-1.5 text-center text-gray-500">{row["Packing"] || "-"}</td>
															<td className="py-1.5 text-right">{row["Purc Days"]}</td>
															<td className="py-1.5 text-right">{row["Opening Qty."] ?? "-"}</td>
															<td className="py-1.5 text-right">{row["Purchase Qty"] ?? "-"}</td>
															<td className="py-1.5 text-right">{row["S.Ret Qty."] !== 0 ? row["S.Ret Qty."] : "-"}</td>
															<td className="py-1.5 text-right">{row["Stk Adj Add"] !== 0 ? row["Stk Adj Add"] : "-"}</td>
															<td className="py-1.5 text-right">{row["Total In Qty"] ?? "-"}</td>
															<td className="py-1.5 text-right">{row["Sales Qty."] ?? "-"}</td>
															<td className="py-1.5 text-right">{row["P.Ret Qty."] !== 0 ? row["P.Ret Qty."] : "-"}</td>
															<td className="py-1.5 text-right">{row["Stk Adj Less"] !== 0 ? row["Stk Adj Less"] : "-"}</td>
															<td className="py-1.5 text-right">{row["Balance Qty."] ?? "-"}</td>
															<td className="py-1.5 text-right pr-2">{row["Stock Value"] ? row["Stock Value"].toFixed(2) : "0.00"}</td>
														</tr>
													);
												})}
												{/* Division Total */}
												<tr className="border-y border-gray-300 font-bold text-[#0B2545] bg-gray-50/50">
													<td colSpan={3} className="py-2 pl-2">Total value of {div.toUpperCase()} :</td>
													<td className="py-2 text-right">{divOpeningValue.toFixed(2)}</td>
													<td className="py-2 text-right">{divPurchaseValue.toFixed(2)}</td>
													<td colSpan={3}></td>
													<td className="py-2 text-right">{divSalesValue.toFixed(2)}</td>
													<td colSpan={3}></td>
													<td className="py-2 text-right pr-2">{divStockValue.toFixed(2)}</td>
												</tr>
											</React.Fragment>
										);
									})}
									{/* Full Company Total */}
									<tr className="border-b-2 border-gray-400 font-bold text-[#0B2545] bg-gray-50">
										<td colSpan={3} className="py-2 pl-2">Total value of {mfg.toUpperCase()} :</td>
										<td className="py-2 text-right">{companyOpeningValue.toFixed(2)}</td>
										<td className="py-2 text-right">{companyPurchaseValue.toFixed(2)}</td>
										<td colSpan={3}></td>
										<td className="py-2 text-right">{companySalesValue.toFixed(2)}</td>
										<td colSpan={3}></td>
										<td className="py-2 text-right pr-2">{companyStockValue.toFixed(2)}</td>
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
