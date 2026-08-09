import { and, eq, gte, inArray, lte } from "drizzle-orm";
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

	// Sales
	type SaleDetail = {
		productId: string;
		quantity: number;
		freeQty: number | null;
		dealer: string | null;
	};
	const salesDetails: SaleDetail[] = [];
	if (mrInfo.canViewSales) {
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
		const pSales = salesDetails.filter((s) => s.productId === p.id);

		if (pSales.length > 0) {
			const dealerMap = new Map<string, { qty: number; free: number }>();
			pSales.forEach((s) => {
				const party = s.dealer || "UNKNOWN PARTY";
				const curr = dealerMap.get(party) || { qty: 0, free: 0 };
				curr.qty += s.quantity || 0;
				curr.free += s.freeQty || 0;
				dealerMap.set(party, curr);
			});

			dealerMap.forEach((totals, party) => {
				reportData.push({
					Manufacturer: p.manufacturer,
					SchemeType: "Qty",
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
					"Scheme Qty": 0,
					"Rate Diff.": 0,
					"Scheme Value": 0,
					"Item Scheme": p.freeScheme || "",
					"Applied Scheme": "",
				});
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
			className={`border border-gray-300 bg-gray-100 px-2 py-2 font-bold text-[#0B2545] text-[10px] uppercase leading-tight ${className}`}
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
			className={`border-gray-200 border-x px-2 py-1.5 text-gray-700 text-xs ${className}`}
		>
			{children}
		</td>
	);

	return (
		<div className="mt-4 space-y-8">
			{manufacturers.map((mfg) => {
				const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
				const claimTypes = [
					...new Set(mfgData.map((d) => d.SchemeType)),
				].sort();

				let mfgSaleQty = 0;
				let mfgFreeQty = 0;
				let mfgSchemeQty = 0;
				let mfgClaimVal = 0;

				return (
					<div
						className="overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
						key={mfg}
					>
						{/* Header for Manufacturer Group */}
						<div className="mb-6 flex flex-col items-start justify-between gap-4 border-gray-200 border-b pb-4 md:flex-row">
							<div>
								<h2 className="font-extrabold text-[#0B2545] text-xl tracking-tight">
									ASMEE PHARMA PRIVATE LIMITED
								</h2>
								<p className="mt-1 max-w-sm font-medium text-gray-500 text-xs leading-relaxed">
									BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,
									PRATAP ROAD, RAOPURA, VADODARA - 390001, GUJARAT - 24
									<br />
									Contact: 9409789800, 9409789700 Mobile: 9409789700
								</p>
							</div>
							<div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-right text-[10px] text-gray-600">
								<div className="flex gap-4 font-bold text-[#0B2545]">
									<span className="w-20">Qty Scheme :</span>{" "}
									<span className="font-medium text-gray-600">
										Scheme Value = PTR x SchemeQty
									</span>
								</div>
								<div className="mt-1 flex gap-4 font-bold text-[#0B2545]">
									<span className="w-20">Rate Scheme :</span>{" "}
									<span className="font-medium text-gray-600">
										Scheme Value = (NetRate - InvRate) x SaleQty (Scheme)
									</span>
								</div>
								<div className="flex gap-4 font-bold text-[#0B2545]">
									<span className="w-20"></span>{" "}
									<span className="font-medium text-gray-600">
										Scheme Value = (PTR - InvRate) x SaleQty (No Scheme)
									</span>
								</div>
							</div>
						</div>

						<h3 className="mb-4 font-extrabold text-[#0071BC] text-lg uppercase">
							{mfg}
						</h3>

						{claimTypes.map((cType) => {
							const cTypeData = mfgData.filter((d) => d.SchemeType === cType);
							const parties = [
								...new Set(cTypeData.map((d) => d.Party)),
							].sort();

							return (
								<div className="mb-6" key={cType}>
									<h4 className="mb-2 font-bold text-gray-700 text-sm underline underline-offset-2">
										Scheme Type : {cType}
									</h4>

									{parties.map((party) => {
										const partyData = cTypeData.filter(
											(d) => d.Party === party,
										);

										const pSaleQty = partyData.reduce(
											(acc, curr) => acc + curr["Sale Qty"],
											0,
										);
										const pFreeQty = partyData.reduce(
											(acc, curr) => acc + curr["Free Qty"],
											0,
										);
										const pSchemeQty = partyData.reduce(
											(acc, curr) => acc + curr["Scheme Qty"],
											0,
										);
										const pClaimVal = partyData.reduce(
											(acc, curr) => acc + curr["Scheme Value"],
											0,
										);

										mfgSaleQty += pSaleQty;
										mfgFreeQty += pFreeQty;
										mfgSchemeQty += pSchemeQty;
										mfgClaimVal += pClaimVal;

										return (
											<div className="mb-8" key={party}>
												<h5 className="mb-2 font-bold text-[#0B2545] text-[13px] italic">
													{party}
												</h5>
												<div className="scrollbar-hide w-full overflow-x-auto rounded-lg border border-gray-300">
													<table className="w-full min-w-[1200px] border-collapse text-left">
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
																<Th className="text-right">Scheme Qty</Th>
																<Th className="text-right">Rate Diff.</Th>
																<Th className="text-right">Scheme Value</Th>
																<Th>Item Scheme</Th>
																<Th>Applied Scheme</Th>
															</tr>
														</thead>
														<tbody>
															{partyData.map((row, idx) => (
																<tr
																	className="border-gray-200 border-b transition-colors hover:bg-gray-50"
																	key={idx}
																>
																	<Td>{row.Code}</Td>
																	<Td className="font-semibold">
																		{row["Product Name"]}
																	</Td>
																	<Td>{row.Packing}</Td>
																	<Td>{row["Batch No."]}</Td>
																	<Td>{row["Inv. No."]}</Td>
																	<Td>{row["Inv. Dt."]}</Td>
																	<Td className="text-right">
																		{row.MRP.toFixed(2)}
																	</Td>
																	<Td className="text-right">
																		{row.PRate.toFixed(2)}
																	</Td>
																	<Td className="text-right">
																		{row.PTR.toFixed(2)}
																	</Td>
																	<Td className="text-right">
																		{row["Net Rate"].toFixed(2)}
																	</Td>
																	<Td className="text-right">
																		{row["Inv. Rate"].toFixed(2)}
																	</Td>
																	<Td className="text-right">
																		{row["Sale Qty"]}
																	</Td>
																	<Td className="text-right">
																		{row["Free Qty"]}
																	</Td>
																	<Td className="text-right">-</Td>
																	<Td className="text-right">
																		{row["Scheme Qty"]}
																	</Td>
																	<Td className="text-right">
																		{row["Rate Diff."].toFixed(2)}
																	</Td>
																	<Td className="text-right">
																		{row["Scheme Value"].toFixed(2)}
																	</Td>
																	<Td>{row["Item Scheme"]}</Td>
																	<Td>{row["Applied Scheme"]}</Td>
																</tr>
															))}
															{/* Party Total Row */}
															<tr className="border-gray-300 border-t bg-gray-50">
																<td
																	className="px-2 py-2 text-right font-bold text-[11px] text-gray-500"
																	colSpan={11}
																></td>
																<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
																	{pSaleQty}
																</td>
																<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
																	{pFreeQty}
																</td>
																<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
																	-
																</td>
																<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
																	{pSchemeQty}
																</td>
																<td className="border-gray-200 border-x px-2 py-2"></td>
																<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
																	{pClaimVal.toFixed(2)}
																</td>
																<td
																	className="border-gray-200 border-l"
																	colSpan={2}
																></td>
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
							<h4 className="mb-3 font-bold text-[#0B2545] text-sm">
								Summary :
							</h4>
							<div className="w-full overflow-x-auto rounded-lg border border-gray-300 sm:w-[800px]">
								<table className="w-full min-w-[600px] border-collapse text-left">
									<thead>
										<tr>
											<Th>ItemName</Th>
											<Th>Packing</Th>
											<Th className="text-right">Sale Qty</Th>
											<Th className="text-right">Free Qty</Th>
											<Th className="text-right">Actual FQty</Th>
											<Th className="text-right">Scheme Qty</Th>
											<Th className="text-right">Scheme Value</Th>
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
														SchemeQty: 0,
														ClaimValue: 0,
													});
												}
												const agg = summaryMap.get(key);
												agg.SaleQty += item["Sale Qty"];
												agg.FreeQty += item["Free Qty"];
												agg.SchemeQty += item["Scheme Qty"];
												agg.ClaimValue += item["Scheme Value"];
											});

											const summaries = Array.from(summaryMap.values());
											return (
												<>
													{summaries.map((s, i) => (
														<tr
															className="border-gray-200 border-b hover:bg-gray-50"
															key={i}
														>
															<Td className="font-semibold">{s.ItemName}</Td>
															<Td>{s.Packing}</Td>
															<Td className="text-right">{s.SaleQty}</Td>
															<Td className="text-right">{s.FreeQty}</Td>
															<Td className="text-right">-</Td>
															<Td className="text-right">{s.SchemeQty}</Td>
															<Td className="text-right">
																{s.ClaimValue.toFixed(2)}
															</Td>
														</tr>
													))}
													<tr className="border-gray-300 border-t-2 bg-gray-100">
														<td
															className="px-2 py-2 font-bold text-[#0B2545] text-xs"
															colSpan={2}
														>
															Total :
														</td>
														<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
															{mfgSaleQty}
														</td>
														<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
															{mfgFreeQty}
														</td>
														<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
															-
														</td>
														<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
															{mfgSchemeQty}
														</td>
														<td className="border-gray-200 border-x px-2 py-2 text-right font-bold text-[#0B2545] text-xs">
															{mfgClaimVal.toFixed(2)}
														</td>
													</tr>
												</>
											);
										})()}
									</tbody>
								</table>
							</div>
						</div>

						{/* Manufacturer Grand Total */}
						<div className="mt-8 flex flex-col items-end justify-between gap-4 border-gray-300 border-t-2 pt-4 md:flex-row">
							<div className="font-extrabold text-[#0B2545] text-sm uppercase">
								Total of {mfg} :
							</div>
							<div className="flex gap-8 rounded-xl border border-gray-200 bg-gray-50 px-6 py-3 font-bold text-xs shadow-inner">
								<div className="text-center">
									<div className="mb-1 text-[10px] text-gray-500">Sale Qty</div>
									<div className="text-[#0B2545] text-sm">{mfgSaleQty}</div>
								</div>
								<div className="text-center">
									<div className="mb-1 text-[10px] text-gray-500">Free Qty</div>
									<div className="text-[#0B2545] text-sm">{mfgFreeQty}</div>
								</div>
								<div className="text-center">
									<div className="mb-1 text-[10px] text-gray-500">
										Scheme Qty
									</div>
									<div className="text-[#0071BC] text-sm">{mfgSchemeQty}</div>
								</div>
								<div className="text-center">
									<div className="mb-1 text-[10px] text-gray-500">
										Scheme Value
									</div>
									<div className="text-green-600 text-sm">
										₹{mfgClaimVal.toFixed(2)}
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
