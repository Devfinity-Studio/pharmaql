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
			h.inv_no as "InvNo",
			h.inv_dt as "InvDt",
			CONCAT(h.cust_id, ' ', COALESCE(c.name, 'Unknown Party'), ' , ', COALESCE(c.city, '')) as "Customer",
			l.item_id as "ItemID",
			l.batch_no as "BatchNo",
			l.mrp as "MRP",
			l.exp_dt as "ExpDt",
			l.qty as "Qty",
			l.f_qty as "FQty",
			l.rate as "Rate",
			l.taxable_amt as "TaxableAmt",
			l.vat_amt as "GSTAmt",
			l.line_amt as "Amount"
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
		const p = accessibleProducts.find((prod) => prod.id === String(row.ItemID));
		if (p) {
			const pStock = stockMap.get(p.id) || { mrp: 0, ptr: 0 };
			const qty = Number(row.Qty) || 0;
			const fQty = Number(row.FQty) || 0;
			const netRate = Number(row.Rate) || 0;
			const invRate = pStock.ptr;
			const schemeQty = 0; // Requires deeper scheme evaluation
			const claimQty = fQty; // Using FQty for now as ClaimQty

			// Claim Value = (PTR - InvRate) x SaleQty ( No Scheme ) or PTR x ClaimQty
			const claimValue = invRate * claimQty;

			reportData.push({
				Manufacturer: p.division || p.manufacturer,
				SchemeType: "Qty",
				Party: row.Customer || "Unknown Party",
				Code: p.code || "-",
				"Product Name": p.name,
				Packing: p.freeScheme || "-",
				"Batch No.": row.BatchNo || "-",
				"Inv. No.": row.InvNo || "-",
				"Inv. Dt.": row.InvDt ? new Date(row.InvDt).toLocaleDateString() : "-",
				MRP: Number(row.MRP || pStock.mrp),
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

	return (
		<div className="mt-4 space-y-8">
			{manufacturers.map((mfg) => {
				const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
				const claimTypes = [
					...new Set(mfgData.map((d) => d.SchemeType)),
				].sort();

				let mfgSaleQty = 0;
				let mfgFreeQty = 0;
				let mfgClaimQty = 0;
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
									<span className="w-20">Qty Claim :</span>{" "}
									<span className="font-medium text-gray-600">
										Claim Value = PTR x ClaimQty
									</span>
								</div>
								<div className="mt-1 flex gap-4 font-bold text-[#0B2545]">
									<span className="w-20">Rate Claim :</span>{" "}
									<span className="font-medium text-gray-600">
										Claim Value = (NetRate - InvRate) x SaleQty ( Scheme )
									</span>
								</div>
								<div className="flex gap-4 font-bold text-[#0B2545]">
									<span className="w-20"></span>{" "}
									<span className="font-medium text-gray-600">
										Claim Value = (PTR - InvRate) x SaleQty ( No Scheme )
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
										const pClaimQty = partyData.reduce(
											(acc, curr) => acc + curr["Claim Qty"],
											0,
										);
										const pClaimVal = partyData.reduce(
											(acc, curr) => acc + curr["Claim Value"],
											0,
										);

										mfgSaleQty += pSaleQty;
										mfgFreeQty += pFreeQty;
										mfgClaimQty += pClaimQty;
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
																<Th className="text-right">Claim Qty</Th>
																<Th className="text-right">Rate Diff.</Th>
																<Th className="text-right">Claim Value</Th>
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
																		{row["Claim Qty"]}
																	</Td>
																	<Td className="text-right">
																		{row["Rate Diff."].toFixed(2)}
																	</Td>
																	<Td className="text-right">
																		{row["Claim Value"].toFixed(2)}
																	</Td>
																	<Td>{row["Item Scheme"]}</Td>
																	<Td>{row["Applied Scheme"]}</Td>
																</tr>
															))}
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
															<Td className="text-right">{s.ClaimQty}</Td>
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
															{mfgClaimQty}
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
