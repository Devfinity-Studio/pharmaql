import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { mrInventory, mrManufacturers, products, sales, user } from "@/server/db/schema";

export async function ClaimReportView({
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
	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo) return <div>MR not found</div>;

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

	// Stock
	const stockMap = new Map<string, { mrp: number; ptr: number }>();
	if (mrInfo.canViewStock) {
		const inventory = await db
			.select()
			.from(mrInventory)
			.where(and(inArray(mrInventory.productId, productIds), eq(mrInventory.mrId, mrId)));
		inventory.forEach((inv) => stockMap.set(inv.productId, {
			mrp: Number(inv.mrp) || 0,
			ptr: Number(inv.ptr) || 0
		}));
	}

	// Sales
	type SaleDetail = { productId: string; quantity: number; freeQty: number | null; dealer: string | null };
	const salesDetails: SaleDetail[] = [];
	if (mrInfo.canViewSales) {
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
				freeQty: sales.freeQty,
				dealer: sales.dealer,
			})
			.from(sales)
			.where(salesCondition);

		salesDetails.push(...accessibleSales);
	}

	// Transform data for rendering
	const reportData: any[] = [];
	accessibleProducts.forEach((p) => {
		const pStock = stockMap.get(p.id) || { mrp: 0, ptr: 0 };
		const pSales = salesDetails.filter(s => s.productId === p.id);
		
		if (pSales.length > 0) {
			const dealerMap = new Map<string, { qty: number, free: number }>();
			pSales.forEach(s => {
				const party = s.dealer || "UNKNOWN PARTY";
				const curr = dealerMap.get(party) || { qty: 0, free: 0 };
				curr.qty += s.quantity || 0;
				curr.free += s.freeQty || 0;
				dealerMap.set(party, curr);
			});

			dealerMap.forEach((totals, party) => {
				reportData.push({
					Manufacturer: p.manufacturer,
					ClaimType: "Qty",
					Party: party,
					Code: p.code || "",
					"Product Name": p.name,
					Packing: "",
					"Batch No.": "",
					"Inv. No.": "",
					"Inv. Dt.": "",
					MRP: pStock.mrp,
					PRate: pStock.ptr,
					PTR: pStock.ptr,
					"Net Rate": 0,
					"Inv. Rate": 0,
					"Sale Qty": totals.qty,
					"Free Qty": totals.free,
					"Actual FQty": 0,
					"Claim Qty": 0,
					"Rate Diff.": 0,
					"Claim Value": 0,
					"Item Scheme": p.freeScheme || "",
					"Applied Scheme": "",
				});
			});
		}
	});

	if (reportData.length === 0) {
		return <div className="p-8 text-center text-gray-500 font-medium border rounded-xl bg-white mt-4">No claim data available for the selected filters.</div>;
	}

	// Grouping
	const manufacturers = [...new Set(reportData.map((d) => d.Manufacturer))].sort();

	const Th = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
		<th className={`px-2 py-2 border border-gray-300 font-bold text-[#0B2545] text-[10px] leading-tight uppercase bg-gray-100 ${className}`}>
			{children}
		</th>
	);

	const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
		<td className={`px-2 py-1.5 border-x border-gray-200 text-gray-700 text-xs ${className}`}>
			{children}
		</td>
	);

	return (
		<div className="space-y-8 mt-4">
			{manufacturers.map((mfg) => {
				const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
				const claimTypes = [...new Set(mfgData.map((d) => d.ClaimType))].sort();

				let mfgSaleQty = 0;
				let mfgFreeQty = 0;
				let mfgClaimQty = 0;
				let mfgClaimVal = 0;

				return (
					<div key={mfg} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6">
						
						{/* Header for Manufacturer Group */}
						<div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 pb-4 border-b border-gray-200">
							<div>
								<h2 className="font-extrabold text-[#0B2545] text-xl tracking-tight">ASMEE PHARMA PRIVATE LIMITED</h2>
								<p className="text-xs text-gray-500 font-medium mt-1 max-w-sm leading-relaxed">
									BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD, RAOPURA, VADODARA - 390001, GUJARAT - 24
									<br/>Contact: 9409789800, 9409789700 Mobile: 9409789700
								</p>
							</div>
							<div className="text-right text-[10px] text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
								<div className="flex gap-4 font-bold text-[#0B2545]"><span className="w-20">Qty Claim :</span> <span className="font-medium text-gray-600">Claim Value = PTR x ClaimQty</span></div>
								<div className="flex gap-4 font-bold text-[#0B2545] mt-1"><span className="w-20">Rate Claim :</span> <span className="font-medium text-gray-600">Claim Value = (NetRate - InvRate) x SaleQty (Scheme)</span></div>
								<div className="flex gap-4 font-bold text-[#0B2545]"><span className="w-20"></span> <span className="font-medium text-gray-600">Claim Value = (PTR - InvRate) x SaleQty (No Scheme)</span></div>
							</div>
						</div>

						<h3 className="font-extrabold text-lg text-[#0071BC] mb-4 uppercase">{mfg}</h3>

						{claimTypes.map((cType) => {
							const cTypeData = mfgData.filter((d) => d.ClaimType === cType);
							const parties = [...new Set(cTypeData.map((d) => d.Party))].sort();

							return (
								<div key={cType} className="mb-6">
									<h4 className="font-bold text-gray-700 text-sm mb-2 underline underline-offset-2">Claim Type : {cType}</h4>

									{parties.map((party) => {
										const partyData = cTypeData.filter((d) => d.Party === party);
										
										const pSaleQty = partyData.reduce((acc, curr) => acc + curr["Sale Qty"], 0);
										const pFreeQty = partyData.reduce((acc, curr) => acc + curr["Free Qty"], 0);
										const pClaimQty = partyData.reduce((acc, curr) => acc + curr["Claim Qty"], 0);
										const pClaimVal = partyData.reduce((acc, curr) => acc + curr["Claim Value"], 0);

										mfgSaleQty += pSaleQty;
										mfgFreeQty += pFreeQty;
										mfgClaimQty += pClaimQty;
										mfgClaimVal += pClaimVal;

										return (
											<div key={party} className="mb-8">
												<h5 className="font-bold italic text-[#0B2545] text-[13px] mb-2">{party}</h5>
												<div className="w-full overflow-x-auto rounded-lg border border-gray-300 scrollbar-hide">
													<table className="w-full min-w-[1200px] text-left border-collapse">
														<thead>
															<tr>
																<Th>Code</Th>
																<Th>Product Name</Th>
																<Th>Packing</Th>
																<Th>Batch No.</Th>
																<Th>Inv. No.</Th>
																<Th>Inv. Dt.</Th>
																<Th className="text-right">MRP</Th>
																<Th className="text-right">PRate</Th>
																<Th className="text-right">PTR</Th>
																<Th className="text-right">Net Rate</Th>
																<Th className="text-right">Inv. Rate</Th>
																<Th className="text-right">Sale Qty</Th>
																<Th className="text-right">Free Qty</Th>
																<Th className="text-right">Actual FQty</Th>
																<Th className="text-right">Claim Qty</Th>
																<Th className="text-right">Rate Diff.</Th>
																<Th className="text-right">Claim Value</Th>
																<Th>Item Scheme</Th>
																<Th>Applied Scheme</Th>
															</tr>
														</thead>
														<tbody>
															{partyData.map((row, idx) => (
																<tr key={idx} className="hover:bg-gray-50 transition-colors border-b border-gray-200">
																	<Td>{row.Code}</Td>
																	<Td className="font-semibold">{row["Product Name"]}</Td>
																	<Td>{row.Packing}</Td>
																	<Td>{row["Batch No."]}</Td>
																	<Td>{row["Inv. No."]}</Td>
																	<Td>{row["Inv. Dt."]}</Td>
																	<Td className="text-right">{row.MRP.toFixed(2)}</Td>
																	<Td className="text-right">{row.PRate.toFixed(2)}</Td>
																	<Td className="text-right">{row.PTR.toFixed(2)}</Td>
																	<Td className="text-right">{row["Net Rate"].toFixed(2)}</Td>
																	<Td className="text-right">{row["Inv. Rate"].toFixed(2)}</Td>
																	<Td className="text-right">{row["Sale Qty"]}</Td>
																	<Td className="text-right">{row["Free Qty"]}</Td>
																	<Td className="text-right">-</Td>
																	<Td className="text-right">{row["Claim Qty"]}</Td>
																	<Td className="text-right">{row["Rate Diff."].toFixed(2)}</Td>
																	<Td className="text-right">{row["Claim Value"].toFixed(2)}</Td>
																	<Td>{row["Item Scheme"]}</Td>
																	<Td>{row["Applied Scheme"]}</Td>
																</tr>
															))}
															{/* Party Total Row */}
															<tr className="bg-gray-50 border-t border-gray-300">
																<td colSpan={11} className="px-2 py-2 text-right font-bold text-[11px] text-gray-500"></td>
																<td className="px-2 py-2 text-right font-bold text-xs text-[#0B2545] border-x border-gray-200">{pSaleQty}</td>
																<td className="px-2 py-2 text-right font-bold text-xs text-[#0B2545] border-x border-gray-200">{pFreeQty}</td>
																<td className="px-2 py-2 text-right font-bold text-xs text-[#0B2545] border-x border-gray-200">-</td>
																<td className="px-2 py-2 text-right font-bold text-xs text-[#0B2545] border-x border-gray-200">{pClaimQty}</td>
																<td className="px-2 py-2 border-x border-gray-200"></td>
																<td className="px-2 py-2 text-right font-bold text-xs text-[#0B2545] border-x border-gray-200">{pClaimVal.toFixed(2)}</td>
																<td colSpan={2} className="border-l border-gray-200"></td>
															</tr>
														</tbody>
													</table>
												</div>
											</div>
										);
									})}
								</div>
							);
						})}

						{/* Summary Table for Manufacturer */}
						<div className="mt-8">
							<h4 className="font-bold text-[#0B2545] text-sm mb-3">Summary :</h4>
							<div className="w-full sm:w-[800px] overflow-x-auto rounded-lg border border-gray-300">
								<table className="w-full text-left border-collapse min-w-[600px]">
									<thead>
										<tr>
											<Th>ItemName</Th>
											<Th>Packing</Th>
											<Th className="text-right">Sale Qty</Th>
											<Th className="text-right">Free Qty</Th>
											<Th className="text-right">Actual FQty</Th>
											<Th className="text-right">Claim Qty</Th>
											<Th className="text-right">Claim Value</Th>
										</tr>
									</thead>
									<tbody>
										{/* Compute Summary */}
										{(() => {
											const summaryMap = new Map();
											mfgData.forEach((item) => {
												const key = item["Product Name"];
												if (!summaryMap.has(key)) {
													summaryMap.set(key, {
														ItemName: key,
														Packing: item.Packing,
														SaleQty: 0,
														FreeQty: 0,
														ClaimQty: 0,
														ClaimValue: 0
													});
												}
												const agg = summaryMap.get(key);
												agg.SaleQty += item["Sale Qty"];
												agg.FreeQty += item["Free Qty"];
												agg.ClaimQty += item["Claim Qty"];
												agg.ClaimValue += item["Claim Value"];
											});

											const summaries = Array.from(summaryMap.values());
											return (
												<>
													{summaries.map((s, i) => (
														<tr key={i} className="hover:bg-gray-50 border-b border-gray-200">
															<Td className="font-semibold">{s.ItemName}</Td>
															<Td>{s.Packing}</Td>
															<Td className="text-right">{s.SaleQty}</Td>
															<Td className="text-right">{s.FreeQty}</Td>
															<Td className="text-right">-</Td>
															<Td className="text-right">{s.ClaimQty}</Td>
															<Td className="text-right">{s.ClaimValue.toFixed(2)}</Td>
														</tr>
													))}
													<tr className="bg-gray-100 border-t-2 border-gray-300">
														<td colSpan={2} className="px-2 py-2 font-bold text-xs text-[#0B2545]">Total :</td>
														<td className="px-2 py-2 font-bold text-xs text-right text-[#0B2545] border-x border-gray-200">{mfgSaleQty}</td>
														<td className="px-2 py-2 font-bold text-xs text-right text-[#0B2545] border-x border-gray-200">{mfgFreeQty}</td>
														<td className="px-2 py-2 font-bold text-xs text-right text-[#0B2545] border-x border-gray-200">-</td>
														<td className="px-2 py-2 font-bold text-xs text-right text-[#0B2545] border-x border-gray-200">{mfgClaimQty}</td>
														<td className="px-2 py-2 font-bold text-xs text-right text-[#0B2545] border-x border-gray-200">{mfgClaimVal.toFixed(2)}</td>
													</tr>
												</>
											);
										})()}
									</tbody>
								</table>
							</div>
						</div>

						{/* Manufacturer Grand Total */}
						<div className="mt-8 border-t-2 border-gray-300 pt-4 flex flex-col md:flex-row justify-between items-end gap-4">
							<div className="font-extrabold text-[#0B2545] text-sm uppercase">
								Total of {mfg} :
							</div>
							<div className="flex gap-8 font-bold text-xs bg-gray-50 py-3 px-6 rounded-xl border border-gray-200 shadow-inner">
								<div className="text-center">
									<div className="text-[10px] text-gray-500 mb-1">Sale Qty</div>
									<div className="text-[#0B2545] text-sm">{mfgSaleQty}</div>
								</div>
								<div className="text-center">
									<div className="text-[10px] text-gray-500 mb-1">Free Qty</div>
									<div className="text-[#0B2545] text-sm">{mfgFreeQty}</div>
								</div>
								<div className="text-center">
									<div className="text-[10px] text-gray-500 mb-1">Claim Qty</div>
									<div className="text-[#0071BC] text-sm">{mfgClaimQty}</div>
								</div>
								<div className="text-center">
									<div className="text-[10px] text-gray-500 mb-1">Claim Value</div>
									<div className="text-green-600 text-sm">₹{mfgClaimVal.toFixed(2)}</div>
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
