import React from "react";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
	mrInventory,
	mrManufacturers,
	products,
	sales,
	user,
} from "@/server/db/schema";

export async function FreeSchemeReportView({
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
	// 1. Fetch data similar to the PDF API
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo) return <div>MR not found</div>;

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

	// Stock
	const stockMap = new Map<string, { mrp: number; ptr: number }>();
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

		inventory.forEach((inv) =>
			stockMap.set(inv.productId, {
				mrp: Number(inv.mrp) || 0,
				ptr: Number(inv.ptr) || 0,
			}),
		);
	}

	// Query raw SQL for legacy tables for Sales/Free Schemes
	let dateCondition = ``;
	if (searchParams?.from) {
		dateCondition += ` AND h.inv_dt >= '${searchParams.from}'`;
	}
	if (searchParams?.to) {
		dateCondition += ` AND h.inv_dt <= '${searchParams.to}'`;
	}

	const legacyDataResult = await db.execute(
		sql.raw(`
		SELECT 
			h.inv_no as inv_no,
			h.inv_dt as inv_dt,
			CONCAT(h.cust_id, ' ', COALESCE(c.name, 'Unknown Party'), ' , ', COALESCE(c.city, '')) as customer,
			l.item_id as item_id,
			l.batch_no as batch_no,
			l.mrp as mrp,
			l.exp_dt as exp_dt,
			l.qty as qty,
			l.f_qty as f_qty,
			l.rate as rate,
			l.taxable_amt as taxable_amt,
			l.vat_amt as gst_amt,
			l.line_amt as amount
		FROM "pg-drizzle_legacy_h_sale" h
		JOIN "pg-drizzle_legacy_l_sale" l ON l.rid = h.id
		LEFT JOIN "pg-drizzle_legacy_customers" c ON c.id = h.cust_id
		WHERE l.item_id IN (${productIds.map((id) => `'${id}'`).join(",")})
		${dateCondition}
	`),
	);

	const legacyRows = legacyDataResult as any[];

	const reportData: any[] = [];
	legacyRows.forEach((row: any) => {
		const p = accessibleProducts.find((prod) => prod.id === String(row.item_id));
		if (p) {
			const pStock = stockMap.get(p.id) || { mrp: 0, ptr: 0 };
			const qty = Number(row.qty) || 0;
			const fQty = Number(row.f_qty) || 0;
			
			if (fQty <= 0) return;

			const netRate = Number(row.rate) || 0;
			const invRate = pStock.ptr;
			const schemeQty = 0; // Requires deeper scheme evaluation
			const claimQty = fQty; // Using FQty for now as ClaimQty

			// Claim Value = (PTR - InvRate) x SaleQty ( No Scheme ) or PTR x ClaimQty
			const claimValue = invRate * claimQty;

			reportData.push({
				Manufacturer: p.division || p.manufacturer,
				SchemeType: "Qty",
				Party: row.customer || "Unknown Party",
				Code: p.code || "-",
				"Product Name": p.name,
				Packing: p.freeScheme || "-",
				"Batch No.": row.batch_no || "-",
				"Inv. No.": row.inv_no || "-",
				"Inv. Dt.": row.inv_dt ? new Date(row.inv_dt).toLocaleDateString("en-GB").replace(/\//g, "-") : "-",
				MRP: Number(row.mrp || pStock.mrp),
				PRate: invRate,
				PTR: invRate,
				"Net Rate": netRate,
				"Inv. Rate": netRate, // Same as Net Rate for now
				"Sale Qty": qty,
				"Free Qty": fQty,
				"Actual FQty": fQty,
				"Claim Qty": claimQty,
				"Rate Diff.": invRate - netRate,
				"Claim Value": claimValue,
				"Item Scheme": p.freeScheme || "-",
				"Applied Scheme": "-",
			});
		}
	});

	if (reportData.length === 0) {
		return (
			<div className="mt-4 rounded-xl border bg-white p-8 text-center font-medium text-gray-500">
				No free scheme data available for the selected filters.
			</div>
		);
	}

	// Grouping
	const manufacturers = [
		...new Set(reportData.map((d) => d.Manufacturer)),
	].sort();

	const Th = ({
		children,
		className = "",
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<th
			className={`border-y border-gray-300 px-2 py-2 font-bold text-[#0B2545] text-[10px] uppercase leading-tight bg-white ${className}`}
		>
			{children}
		</th>
	);

	const Td = ({
		children,
		className = "",
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<td
			className={`border-b border-gray-200 px-2 py-1.5 text-gray-700 text-xs ${className}`}
		>
			{children}
		</td>
	);

	const currentYear = new Date().getFullYear();

	return (
		<div className="mt-4 bg-white p-8 shadow-sm print:shadow-none print:p-0">
			<div className="flex flex-col md:flex-row justify-between mb-4">
				<div>
					<h2 className="font-bold text-[#0B2545] text-xl">ASMEE PHARMA PRIVATE LIMITED</h2>
					<p className="text-xs text-black mt-1">
						BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,<br/>
						RAOPURA, VADODARA - 390001, GUJARAT - 24<br/>
						Contact: 9409789800,9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
					</p>
				</div>
				<div className="text-right text-[10px] text-black font-bold">
					<div className="flex justify-end gap-2">
						<span className="underline">Qty Claim :</span>
						<span>Claim Value = PTR x ClaimQty</span>
					</div>
					<div className="flex justify-end gap-2 mt-1">
						<span className="underline">Rate Claim :</span>
						<span>Claim Value = (NetRate - InvRate) x SaleQty ( Scheme )</span>
					</div>
					<div className="flex justify-end gap-2 mt-1">
						<span className="opacity-0">Rate Claim :</span>
						<span>Claim Value = (PTR - InvRate) x SaleQty ( No Scheme )</span>
					</div>
				</div>
			</div>
			
			<div className="text-[11px] font-bold text-black mb-1">
				Year : {currentYear}-{String(currentYear + 1).slice(2)}
			</div>
			<div className="text-[11px] font-bold text-black mb-2">
				Qty / Special Rate Claim Report for the period of {searchParams?.from ? new Date(searchParams.from).toLocaleDateString("en-GB").replace(/\//g, "-") : "Start"} to {searchParams?.to ? new Date(searchParams.to).toLocaleDateString("en-GB").replace(/\//g, "-") : "End"}
			</div>

			<div className="w-full overflow-x-auto mt-4 border-t border-b border-gray-300">
				<table className="w-full min-w-[1200px] border-collapse text-left">
					<thead>
						<tr>
							<Th className="border-none">Code</Th>
							<Th className="border-none">Product Name</Th>
							<Th className="border-none">Packing</Th>
							<Th className="border-none">Batch No.</Th>
							<Th className="border-none whitespace-nowrap">Inv. No.</Th>
							<Th className="border-none whitespace-nowrap">Inv. Dt.</Th>
							<Th className="text-right border-none">MRP</Th>
							<Th className="text-right border-none">PRate</Th>
							<Th className="text-right border-none">PTR</Th>
							<Th className="text-right border-none">Net Rate</Th>
							<Th className="text-right border-none">Inv. Rate</Th>
							<Th className="text-right border-none">Sale Qty</Th>
							<Th className="text-right border-none">Free Qty</Th>
							<Th className="text-right border-none">Actual FQty</Th>
							<Th className="text-right border-none">Claim Qty</Th>
							<Th className="text-right border-none">Rate Diff.</Th>
							<Th className="text-right border-none">Claim Value</Th>
							<Th className="text-center border-none">Item Scheme</Th>
							<Th className="text-center border-none">Applied Scheme</Th>
						</tr>
					</thead>
					<tbody className="border-t border-gray-300">
						{manufacturers.map((mfg) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							const claimTypes = [...new Set(mfgData.map((d) => d.SchemeType))].sort();

							return (
								<React.Fragment key={mfg}>
									<tr>
										<td colSpan={19} className="px-2 pt-4 pb-2 text-[#0071BC] font-bold text-sm uppercase">
											{mfg} - {mfg}
										</td>
									</tr>
									{claimTypes.map((cType) => {
										const cTypeData = mfgData.filter((d) => d.SchemeType === cType);
										const parties = [...new Set(cTypeData.map((d) => d.Party))].sort();

										let typeSaleQty = 0;
										let typeFreeQty = 0;
										let typeActualFQty = 0;
										let typeClaimQty = 0;
										let typeClaimVal = 0;

										return (
											<React.Fragment key={cType}>
												<tr>
													<td colSpan={19} className="px-2 pt-2 pb-1 font-bold italic text-[11px] underline">
														Claim Type : {cType}
													</td>
												</tr>
												{parties.map((party) => {
													const partyData = cTypeData.filter((d) => d.Party === party);
													return (
														<React.Fragment key={party}>
															<tr>
																<td colSpan={19} className="px-2 pt-1 pb-1 font-bold italic text-[11px]">
																	{party}
																</td>
															</tr>
															{partyData.map((row, idx) => {
																typeSaleQty += row["Sale Qty"];
																typeFreeQty += row["Free Qty"];
																typeActualFQty += row["Actual FQty"];
																typeClaimQty += row["Claim Qty"];
																typeClaimVal += row["Claim Value"];

																return (
																	<tr key={idx}>
																		<Td className="border-none pb-0 pt-0.5">{row.Code}</Td>
																		<Td className="border-none pb-0 pt-0.5">{row["Product Name"]}</Td>
																		<Td className="border-none pb-0 pt-0.5">{row.Packing}</Td>
																		<Td className="border-none pb-0 pt-0.5">{row["Batch No."]}</Td>
																		<Td className="border-none pb-0 pt-0.5 whitespace-nowrap">{row["Inv. No."]}</Td>
																		<Td className="border-none pb-0 pt-0.5 whitespace-nowrap">{row["Inv. Dt."]}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row.MRP.toFixed(2)}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row.PRate.toFixed(2)}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row.PTR.toFixed(2)}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Net Rate"].toFixed(2)}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Inv. Rate"].toFixed(2)}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Sale Qty"] > 0 ? row["Sale Qty"] : "-"}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Free Qty"] > 0 ? row["Free Qty"] : "-"}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Actual FQty"] > 0 ? row["Actual FQty"] : "-"}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Claim Qty"] > 0 ? row["Claim Qty"] : "-"}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Rate Diff."] > 0 ? row["Rate Diff."].toFixed(2) : "-"}</Td>
																		<Td className="text-right border-none pb-0 pt-0.5">{row["Claim Value"] > 0 ? row["Claim Value"].toFixed(2) : "-"}</Td>
																		<Td className="text-center border-none pb-0 pt-0.5">{row["Item Scheme"]}</Td>
																		<Td className="text-center border-none pb-0 pt-0.5">{row["Applied Scheme"]}</Td>
																	</tr>
																);
															})}
														</React.Fragment>
													);
												})}
												{/* Claim Type Total Row */}
												<tr>
													<td colSpan={11}></td>
													<td className="border-y border-gray-400 px-2 py-1 text-right font-bold text-[11px]">{typeSaleQty > 0 ? typeSaleQty : "-"}</td>
													<td className="border-y border-gray-400 px-2 py-1 text-right font-bold text-[11px]">{typeFreeQty > 0 ? typeFreeQty : "-"}</td>
													<td className="border-y border-gray-400 px-2 py-1 text-right font-bold text-[11px]">{typeActualFQty > 0 ? typeActualFQty : "-"}</td>
													<td className="border-y border-gray-400 px-2 py-1 text-right font-bold text-[11px]">{typeClaimQty > 0 ? typeClaimQty : "-"}</td>
													<td className="px-2 py-1"></td>
													<td className="border-y border-gray-400 px-2 py-1 text-right font-bold text-[11px]">{typeClaimVal > 0 ? typeClaimVal.toFixed(2) : "-"}</td>
													<td colSpan={2}></td>
												</tr>
												<tr><td colSpan={19} className="h-4"></td></tr>
											</React.Fragment>
										);
									})}
								</React.Fragment>
							);
						})}
					</tbody>
				</table>
			</div>

			<div className="mt-6 flex flex-row">
				<div className="font-bold text-[10px] uppercase w-32 bg-gray-100 py-1 px-4 self-start rounded-t-sm">Summary :</div>
				<table className="w-full max-w-[800px] border-collapse text-left -ml-32 mt-6">
					<thead>
						<tr>
							<th className="border-y border-gray-300 px-2 py-1 font-bold text-black text-[10px] uppercase">ItemName</th>
							<th className="border-y border-gray-300 px-2 py-1 font-bold text-black text-[10px] uppercase text-center">Packing</th>
							<th className="border-y border-gray-300 px-2 py-1 font-bold text-black text-[10px] uppercase text-right">Sale Qty</th>
							<th className="border-y border-gray-300 px-2 py-1 font-bold text-black text-[10px] uppercase text-right">Free Qty</th>
							<th className="border-y border-gray-300 px-2 py-1 font-bold text-black text-[10px] uppercase text-right">Actual FQty</th>
							<th className="border-y border-gray-300 px-2 py-1 font-bold text-black text-[10px] uppercase text-right">Claim Qty</th>
							<th className="border-y border-gray-300 px-2 py-1 font-bold text-black text-[10px] uppercase text-right">Claim Value</th>
						</tr>
					</thead>
					<tbody>
						{(() => {
							const summaryMap = new Map();
							reportData.forEach((item) => {
								const key = item["Product Name"];
								if (!summaryMap.has(key)) {
									summaryMap.set(key, {
										ItemName: key,
										Packing: item.Packing,
										SaleQty: 0,
										FreeQty: 0,
										ClaimQty: 0,
										ClaimValue: 0,
									});
								}
								const agg = summaryMap.get(key);
								agg.SaleQty += item["Sale Qty"];
								agg.FreeQty += item["Free Qty"];
								agg.ClaimQty += item["Claim Qty"];
								agg.ClaimValue += item["Claim Value"];
							});

							const summaries = Array.from(summaryMap.values());
							const totals = summaries.reduce((acc, curr) => {
								acc.SaleQty += curr.SaleQty;
								acc.FreeQty += curr.FreeQty;
								acc.ClaimQty += curr.ClaimQty;
								acc.ClaimValue += curr.ClaimValue;
								return acc;
							}, { SaleQty: 0, FreeQty: 0, ClaimQty: 0, ClaimValue: 0 });

							return (
								<>
									{summaries.map((s, i) => (
										<tr key={i}>
											<Td className="font-bold border-none pb-0">{s.ItemName}</Td>
											<Td className="text-center border-none pb-0">{s.Packing}</Td>
											<Td className="text-right border-none pb-0">{s.SaleQty}</Td>
											<Td className="text-right border-none pb-0">{s.FreeQty}</Td>
											<Td className="text-right border-none pb-0">{s.FreeQty > 0 ? s.FreeQty : "-"}</Td>
											<Td className="text-right border-none pb-0">{s.ClaimQty}</Td>
											<Td className="text-right border-none pb-0">{s.ClaimValue.toFixed(2)}</Td>
										</tr>
									))}
									<tr>
										<td colSpan={2} className="border-y border-gray-300 px-2 py-1 font-bold text-[11px] mt-2">Total :</td>
										<td className="border-y border-gray-300 px-2 py-1 font-bold text-[11px] text-right mt-2">{totals.SaleQty}</td>
										<td className="border-y border-gray-300 px-2 py-1 font-bold text-[11px] text-right mt-2">{totals.FreeQty}</td>
										<td className="border-y border-gray-300 px-2 py-1 font-bold text-[11px] text-right mt-2">{totals.FreeQty > 0 ? totals.FreeQty : "-"}</td>
										<td className="border-y border-gray-300 px-2 py-1 font-bold text-[11px] text-right mt-2">{totals.ClaimQty}</td>
										<td className="border-y border-gray-300 px-2 py-1 font-bold text-[11px] text-right mt-2">{totals.ClaimValue.toFixed(2)}</td>
									</tr>
								</>
							);
						})()}
					</tbody>
				</table>
			</div>

			{manufacturers.map((mfg) => {
				const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
				const mfgTotals = mfgData.reduce((acc, curr) => {
					acc.SaleQty += curr["Sale Qty"];
					acc.FreeQty += curr["Free Qty"];
					acc.ClaimQty += curr["Claim Qty"];
					acc.ClaimValue += curr["Claim Value"];
					return acc;
				}, { SaleQty: 0, FreeQty: 0, ClaimQty: 0, ClaimValue: 0 });

				return (
					<div key={mfg} className="mt-8 w-full border-y border-gray-300 py-2 text-[11px] font-bold text-black">
						<table className="w-full min-w-[1200px] text-left">
							<tbody>
								<tr>
									<td colSpan={11} className="w-[60%]">Total of {mfg} :</td>
									<td className="text-right">{mfgTotals.SaleQty}</td>
									<td className="text-right">{mfgTotals.FreeQty}</td>
									<td className="text-right">-</td>
									<td className="text-right">{mfgTotals.ClaimQty}</td>
									<td></td>
									<td className="text-right">{mfgTotals.ClaimValue.toFixed(2)}</td>
									<td colSpan={2}></td>
								</tr>
							</tbody>
						</table>
					</div>
				);
			})}
		</div>
	);
}
