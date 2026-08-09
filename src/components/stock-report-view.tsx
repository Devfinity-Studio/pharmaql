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
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || !mrInfo.canViewStock || !mrInfo.locNo)
		return <div>No access to stock data or location not assigned.</div>;

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

	const nextDayInventoryMap = new Map<string, number>();
	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCDate(toDate.getUTCDate() + 1);
			toDate.setUTCHours(0, 0, 0, 0);
			const nextInv = await db
				.select({
					productId: mrInventory.productId,
					opening: mrInventory.opening,
				})
				.from(mrInventory)
				.where(and(eq(mrInventory.mrId, mrId), eq(mrInventory.date, toDate)));
			nextInv.forEach((inv) => {
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
	const limitFromDate = searchParams?.from ? new Date(searchParams.from) : null;
	const limitToDate = searchParams?.to
		? new Date(searchParams.to)
		: new Date("9999-12-31T23:59:59.999Z");
	if (searchParams?.to) limitToDate.setUTCHours(23, 59, 59, 999);

	const { sql } = await import("drizzle-orm");
	for (const p of accessibleProducts) {
		const res = await db.execute(sql`
			SELECT 
				SUM(opening) as opening,
				SUM(inward) as purchase,
				SUM(s_ret_inward) as s_return,
				SUM(add_stock_adj) as stk_adj_add,
				SUM(sale_qty + sale_f_qty) as sales_qty,
				SUM(outward) as p_return,
				SUM(less_stock_adj) as stk_adj_less,
				SUM(opening + curr_qty) as curr_qty,
				MAX(prate) as prate,
				MAX(ptr) as ptr,
				MAX(mrp) as mrp,
				SUM(opening) * MAX(prate) as opening_value,
				SUM(inward) * MAX(prate) as purchase_value,
				SUM(sale_qty + sale_f_qty) * MAX(prate) as sales_value,
				SUM(opening + curr_qty) * MAX(prate) as stock_value
			FROM (
				SELECT SUM(v.qty) as opening, 0 as inward, 0 as s_ret_inward, 0 as add_stock_adj, 0 as sale_qty, 0 as sale_f_qty, 0 as outward, 0 as less_stock_adj, 0 as curr_qty,
				v.batch_id,
				MAX(h.prate) as prate, MAX(h.ptr) as ptr, MAX(h.mrp) as mrp
				FROM "pg-drizzle_legacy_view_stocks" v
				LEFT JOIN "pg-drizzle_legacy_h_batch" h ON h.id = v.batch_id AND h.item_id = v.item_id
				WHERE v.item_id = ${p.id} AND v.loc_no = ${mrInfo.locNo.toString()} AND v.t_date < ${(limitFromDate || new Date(0)).toISOString()}
				AND (v.t_no IS NULL OR v.t_no NOT LIKE 'BR%') AND (v.entry_type IS NULL OR v.entry_type <> 'GRNO') AND COALESCE(v.qty, 0) <> 0
				GROUP BY v.batch_id
				
				UNION ALL
				
				SELECT 0 as opening, SUM(v.inward) as inward, SUM(v.s_ret_inward) as s_ret_inward, SUM(v.add_stock_adj) as add_stock_adj, SUM(v.sale_qty) as sale_qty, SUM(v.sale_f_qty) as sale_f_qty, SUM(v.outward) as outward, SUM(v.less_stock_adj) as less_stock_adj, SUM(v.qty) as curr_qty,
				v.batch_id,
				MAX(h.prate) as prate, MAX(h.ptr) as ptr, MAX(h.mrp) as mrp
				FROM "pg-drizzle_legacy_view_stocks" v
				LEFT JOIN "pg-drizzle_legacy_h_batch" h ON h.id = v.batch_id AND h.item_id = v.item_id
				WHERE v.item_id = ${p.id} AND v.loc_no = ${mrInfo.locNo.toString()} AND v.t_date >= ${(limitFromDate || new Date(0)).toISOString()} AND v.t_date <= ${limitToDate.toISOString()}
				AND (v.t_no IS NULL OR v.t_no NOT LIKE 'BR%') AND (v.entry_type IS NULL OR v.entry_type <> 'GRNO') AND COALESCE(v.qty, 0) <> 0
				GROUP BY v.batch_id
			) as a
		`);

		const r = res[0] as any;

		let opening = Number(r?.opening || 0);
		let purchase = Number(r?.purchase || 0);
		const salesQty = Number(r?.sales_qty || 0);
		let currQty = Number(r?.curr_qty || 0);

		// Override opening and purchase using APBaroda file data (mrInventory)
		const pInventory = inventory.filter((inv) => inv.productId === p.id);
		let rangeInventory = pInventory;
		if (limitFromDate) {
			rangeInventory = pInventory.filter((inv) => inv.date && new Date(inv.date) >= limitFromDate);
		}
		
		if (rangeInventory.length > 0) {
			opening = rangeInventory[0].opening || 0;
		} else {
			opening = 0;
		}

		const sRet = Number(r?.s_return || 0);
		
		const stkAdjAdd = Number(r?.stk_adj_add || 0);
		const pRet = Number(r?.p_return || 0);
		const stkAdjLess = Number(r?.stk_adj_less || 0);

		// Recalculate Balance Qty
		// total qty = purchase + opening + stock return + stock adjust add - sales - purchase return + stock adjust less (which is negative)
		currQty = purchase + opening + sRet + stkAdjAdd - salesQty - pRet + stkAdjLess;

		if (
			r &&
			(opening !== 0 || purchase !== 0 || currQty !== 0 || salesQty !== 0 || sRet !== 0 || stkAdjAdd !== 0 || stkAdjLess !== 0 || pRet !== 0)
		) {
			const prate = Number(r?.prate || 0);
			const ptr = Number(r?.ptr || 0);

			const stockValue = currQty * prate;
			const openingValue = opening * prate;
			const purchaseValue = purchase * prate;
			const salesValue = Number(r?.sales_value || 0);

			const totalIn = opening + purchase + sRet + stkAdjAdd;

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
				"Balance Qty.": currQty,
				"Stock Value": stockValue,
				"Opening Value": openingValue,
				"Purchase Value": purchaseValue,
				"Sales Value": salesValue,
				prate: prate,
				ptr: ptr,
			});
		}
	}

	// Grouping by Manufacturer
	const manufacturers = [
		...new Set(reportData.map((d) => d.Manufacturer)),
	].sort();
	let grandTotalOpeningValue = 0;
	let grandTotalPurchaseValue = 0;
	let grandTotalSalesValue = 0;
	let grandTotalStockValue = 0;

	return (
		<div className="mt-4 space-y-8 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{/* Header */}
			<div className="mb-2 flex flex-col items-start justify-between gap-4 border-[#0B2545] border-b-2 pb-2 md:flex-row">
				<div className="flex items-center gap-4">
					<div className="font-black text-5xl text-[#0B2545] italic">A</div>
					<div>
						<h2 className="font-extrabold text-[#0B2545] text-xl tracking-tight">
							ASMEE PHARMA PRIVATE LIMITED
						</h2>
						<p className="mt-0.5 max-w-sm font-medium text-gray-500 text-xs leading-relaxed">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP
							ROAD, RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br />
							Contact: 9409789800, 9409789700 Mobile: 9409789700
						</p>
					</div>
				</div>
				<div className="flex flex-col justify-center self-stretch rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-right font-medium text-[10px] text-gray-600 leading-normal md:self-auto">
					<p className="font-bold text-[#0B2545] text-xs">
						Stock Movement Statement
					</p>
					<p className="mt-1">
						For the Period of :{" "}
						<span className="font-bold">
							{searchParams?.from || "01/04/2026"}
						</span>{" "}
						to{" "}
						<span className="font-bold">
							{searchParams?.to || "30/04/2026"}
						</span>
					</p>
					<p className="mt-0.5">
						Purc Days :{" "}
						<span className="font-bold">
							Difference between last purchase date and today's date
						</span>
					</p>
					<p className="mt-2 text-base">
						Value Calc. on : <span className="font-extrabold">PRate</span>
					</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-[#0B2545] border-t-2 pt-1">
				<table className="w-full min-w-[1200px] border-collapse text-left font-sans">
					<thead>
						<tr className="border-[#0B2545] border-y-2">
							<th className="w-64 py-2 font-bold text-[#0B2545] text-sm">
								Item Name
							</th>
							<th className="py-2 text-center font-bold text-[#0B2545] text-sm">
								Packing
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Purc
								<br />
								Days
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Opening
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Purchase
								<br />
								Qty
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								S.Ret
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Stk Adj
								<br />
								Add
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Total
								<br />
								In Qty
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Sales
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								P.Ret
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Stk Adj
								<br />
								Less
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Balance
								<br />
								Qty.
							</th>
							<th className="py-2 pr-2 text-right font-bold text-[#0B2545] text-sm">
								Stock
								<br />
								Value
							</th>
						</tr>
					</thead>
					<tbody className="font-medium text-sm">
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
										<td
											className="border-gray-200 border-b bg-gray-50/50 px-2 py-2 font-bold text-[#000080]"
											colSpan={13}
										>
											Company : {mfg.toUpperCase()} -{" "}
											{mfg.split(" ")[0].toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgOpeningValue += row["Opening Value"];
										mfgPurchaseValue += row["Purchase Value"];
										mfgSalesValue += row["Sales Value"];
										mfgStockValue += row["Stock Value"];

										return (
											<tr
												className="border-gray-100 border-b text-[#0B2545] hover:bg-gray-50"
												key={rowIdx}
											>
												<td className="whitespace-nowrap py-1.5 pl-2">
													{row["Item Name"]}
												</td>
												<td className="py-1.5 text-center text-gray-500">
													{row["Packing"] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Purc Days"]}
												</td>
												<td className="py-1.5 text-right">
													{row["Opening Qty."] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Purchase Qty"] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["S.Ret Qty."] !== 0 ? row["S.Ret Qty."] : "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Stk Adj Add"] !== 0 ? row["Stk Adj Add"] : "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Total In Qty"] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Sales Qty."] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["P.Ret Qty."] !== 0 ? row["P.Ret Qty."] : "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Stk Adj Less"] !== 0
														? row["Stk Adj Less"]
														: "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Balance Qty."] || "-"}
												</td>
												<td className="py-1.5 pr-2 text-right">
													{row["Stock Value"]
														? row["Stock Value"].toFixed(2)
														: "0.00"}
												</td>
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
											<tr className="border-gray-300 border-y bg-gray-50/50 font-bold text-[#0B2545]">
												<td className="py-2 pl-2" colSpan={3}>
													Total value of {mfg.split(" ")[0].toUpperCase()} :
												</td>
												<td className="py-2 text-right">
													{mfgOpeningValue.toFixed(2)}
												</td>
												<td className="py-2 text-right">
													{mfgPurchaseValue.toFixed(2)}
												</td>
												<td colSpan={3}></td>
												<td className="py-2 text-right">
													{mfgSalesValue.toFixed(2)}
												</td>
												<td colSpan={3}></td>
												<td className="py-2 pr-2 text-right">
													{mfgStockValue.toFixed(2)}
												</td>
											</tr>
										);
									})()}
									{/* Full Company Total */}
									<tr className="border-gray-400 border-b-2 bg-gray-50 font-bold text-[#0B2545]">
										<td className="py-2 pl-2" colSpan={3}>
											Total value of {mfg.toUpperCase()} :
										</td>
										<td className="py-2 text-right">
											{mfgOpeningValue.toFixed(2)}
										</td>
										<td className="py-2 text-right">
											{mfgPurchaseValue.toFixed(2)}
										</td>
										<td colSpan={3}></td>
										<td className="py-2 text-right">
											{mfgSalesValue.toFixed(2)}
										</td>
										<td colSpan={3}></td>
										<td className="py-2 pr-2 text-right">
											{mfgStockValue.toFixed(2)}
										</td>
									</tr>
								</React.Fragment>
							);
						})}
						{/* Grand Total */}
						<tr className="border-[#0B2545] border-b-4 bg-gray-100 font-extrabold text-[#0B2545] text-base">
							<td className="py-3 pl-2" colSpan={3}>
								Total Value :
							</td>
							<td className="py-3 text-right">
								{grandTotalOpeningValue.toFixed(2)}
							</td>
							<td className="py-3 text-right">
								{grandTotalPurchaseValue.toFixed(2)}
							</td>
							<td colSpan={3}></td>
							<td className="py-3 text-right">
								{grandTotalSalesValue.toFixed(2)}
							</td>
							<td colSpan={3}></td>
							<td className="py-3 pr-2 text-right">
								{grandTotalStockValue.toFixed(2)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
