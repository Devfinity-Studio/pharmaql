import Image from "next/image";
import React from "react";
import { getClaimData } from "@/server/actions/claimData";
import { getMRInfo } from "@/server/actions/mrInfo";

export async function FreeSchemeReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
		debug?: string;
	};
}) {
	// 1. Fetch data similar to the PDF API
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo) return <div>MR not found</div>;

	const company = searchParams?.division || "All";
	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || mrInfo.company || ""
			: mrInfo.companyCode &&
					(mrInfo.company === company || mrInfo.division === company)
				? mrInfo.companyCode
				: company;

	const claimResult = await getClaimData({
		uniqueCode: "c9510231-4a58-4cb0-b40e-8fd18ff5f4ef",
		fromDate: searchParams?.from,
		toDate: searchParams?.to,
		compCode: compCodeToQuery,
		locNo: mrInfo.locNo,
	});

	const reportData: any[] = [];

	if (claimResult.success && claimResult.data.length > 0) {
		claimResult.data.forEach((row) => {
			const ptr = Number(row.PTR || 0);
			const sRate = Number(row.SRate || 0);
			const pRate = Number(row.PRate || 0);
			const mrp = Number(row.MRP || 0);
			const qty = Number(row.Qty || 0);
			const free = Number(row.Free || row.FQty || 0);
			const fQty = Number(row.FQty || 0);
			const claimVal = Number(row.FreeIAmt || 0);

			reportData.push({
				Manufacturer:
					row.Company || row.Division || (company !== "All" ? company : "All"),
				SchemeType: row.Scheme ? "Rate" : "Qty",
				Party: `${row.CustCode ? `[${row.CustCode}] ` : ""}${row.Customer || "Unknown Party"}${row.City ? ` , ${row.City}` : ""}`,
				Code: row.ItemCode || "-",
				"Product Name": row.ItemName || "Unknown Item",
				Packing: row.Packing || "-",
				"Batch No.": row.BatchNo || "-",
				"Inv. No.": row.InvNo || "-",
				"Inv. Dt.": row.InvDt
					? new Date(row.InvDt).toLocaleDateString("en-GB").replace(/\//g, "-")
					: "-",
				MRP: mrp,
				PRate: pRate,
				PTR: ptr,
				"Net Rate": sRate,
				"Inv. Rate": sRate,
				"Sale Qty": qty,
				"Free Qty": free,
				"Actual FQty": fQty,
				"Claim Qty": free,
				"Rate Diff.": ptr - sRate,
				"Claim Value": claimVal,
				"Item Scheme": row.Scheme || "-",
				"Applied Scheme": row.Scheme || "-",
			});
		});
	}

	if (reportData.length === 0) {
		return (
			<div className="mt-4 space-y-4">
				{/* DEBUG QUERY BANNER */}
				{(searchParams?.debug === "1" || searchParams?.debug === "true") && (
					<div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-mono text-amber-950 text-xs shadow-sm print:hidden">
						<div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-amber-200 border-b pb-2 font-bold text-amber-900 text-xs">
							<span>
								[DEBUG QUERY] Stored Procedure Execution Status (Claim Qty)
							</span>
							<span className="rounded bg-amber-200 px-2 py-0.5 font-semibold text-[11px]">
								{claimResult.success
									? `${claimResult.data?.length ?? 0} rows returned`
									: claimResult.error || "Query Failed"}
							</span>
						</div>
						<div className="space-y-1.5">
							<p className="font-bold text-[11px] text-amber-900">
								Final SQL Query being run:
							</p>
							<pre className="select-all overflow-x-auto whitespace-pre-wrap break-all rounded border border-amber-200 bg-amber-100 p-2.5 font-mono text-[11px] text-amber-950">
								{claimResult.debugSql || "-- No SQL available"}
							</pre>
							<div className="mt-2 grid grid-cols-2 gap-2 border-amber-200 border-t pt-1.5 text-[11px] text-amber-800 md:grid-cols-4">
								<div>
									<span className="font-semibold">Company Code Query:</span>{" "}
									{JSON.stringify(compCodeToQuery)}
								</div>
								<div>
									<span className="font-semibold">MR Company:</span>{" "}
									{mrInfo.company || "N/A"}
								</div>
								<div>
									<span className="font-semibold">MR Code:</span>{" "}
									{mrInfo.companyCode || "N/A"}
								</div>
								<div>
									<span className="font-semibold">LocNo:</span>{" "}
									{mrInfo.locNo || "11"}
								</div>
							</div>
						</div>
					</div>
				)}

				<div className="rounded-xl border bg-white p-8 text-center font-medium text-gray-500">
					No free scheme data available for the selected filters.
				</div>
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
			className={`border-gray-300 border-y bg-white px-2 py-2 font-bold text-[#0B2545] text-[10px] uppercase leading-tight ${className}`}
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
			className={`border-gray-200 border-b px-2 py-1.5 text-gray-700 text-xs ${className}`}
		>
			{children}
		</td>
	);

	const currentYear = new Date().getFullYear();

	return (
		<div className="mt-4 bg-white p-8 shadow-sm print:p-0 print:shadow-none">
			{/* DEBUG QUERY BANNER */}
			{(searchParams?.debug === "1" || searchParams?.debug === "true") && (
				<div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-mono text-amber-950 text-xs shadow-sm print:hidden">
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-amber-200 border-b pb-2 font-bold text-amber-900 text-xs">
						<span>
							[DEBUG QUERY] Stored Procedure Execution Status (Claim Qty)
						</span>
						<span className="rounded bg-amber-200 px-2 py-0.5 font-semibold text-[11px]">
							{claimResult.success
								? `${claimResult.data?.length ?? 0} rows returned`
								: claimResult.error || "Query Failed"}
						</span>
					</div>
					<div className="space-y-1.5">
						<p className="font-bold text-[11px] text-amber-900">
							Final SQL Query being run:
						</p>
						<pre className="select-all overflow-x-auto whitespace-pre-wrap break-all rounded border border-amber-200 bg-amber-100 p-2.5 font-mono text-[11px] text-amber-950">
							{claimResult.debugSql || "-- No SQL available"}
						</pre>
						<div className="mt-2 grid grid-cols-2 gap-2 border-amber-200 border-t pt-1.5 text-[11px] text-amber-800 md:grid-cols-4">
							<div>
								<span className="font-semibold">Company Code Query:</span>{" "}
								{JSON.stringify(compCodeToQuery)}
							</div>
							<div>
								<span className="font-semibold">MR Company:</span>{" "}
								{mrInfo.company || "N/A"}
							</div>
							<div>
								<span className="font-semibold">MR Code:</span>{" "}
								{mrInfo.companyCode || "N/A"}
							</div>
							<div>
								<span className="font-semibold">LocNo:</span>{" "}
								{mrInfo.locNo || "11"}
							</div>
						</div>
					</div>
				</div>
			)}

			<div className="mb-4 flex flex-col justify-between md:flex-row">
				<div>
					<h2 className="font-bold text-[#0B2545] text-xl">
						<Image
							alt="Asmee Pharma Logo"
							className="object-contain"
							height={50}
							priority
							src="/logo.png"
							width={180}
						/>
					</h2>
					<p className="mt-1 text-black text-xs">
						BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP
						ROAD,
						<br />
						RAOPURA, VADODARA - 390001, GUJARAT - 24
						<br />
						Contact: 9409789800,9409789700 Mobile: 9409789700 Email:
						asmeepharma2022@gmail.com
					</p>
				</div>
				<div className="text-right font-bold text-[10px] text-black">
					<div className="flex justify-end gap-2">
						<span className="underline">Qty Claim :</span>
						<span>Claim Value = PTR x ClaimQty</span>
					</div>
					<div className="mt-1 flex justify-end gap-2">
						<span className="underline">Rate Claim :</span>
						<span>Claim Value = (NetRate - InvRate) x SaleQty ( Scheme )</span>
					</div>
					<div className="mt-1 flex justify-end gap-2">
						<span className="opacity-0">Rate Claim :</span>
						<span>Claim Value = (PTR - InvRate) x SaleQty ( No Scheme )</span>
					</div>
				</div>
			</div>

			<div className="mb-1 font-bold text-[11px] text-black">
				Year : {currentYear}-{String(currentYear + 1).slice(2)}
			</div>
			<div className="mb-2 font-bold text-[11px] text-black">
				Qty / Special Rate Claim Report for the period of{" "}
				{searchParams?.from
					? new Date(searchParams.from)
							.toLocaleDateString("en-GB")
							.replace(/\//g, "-")
					: "Start"}{" "}
				to{" "}
				{searchParams?.to
					? new Date(searchParams.to)
							.toLocaleDateString("en-GB")
							.replace(/\//g, "-")
					: "End"}
			</div>

			<div className="mt-4 w-full overflow-x-auto border-gray-300 border-t border-b">
				<table className="w-full min-w-[1200px] border-collapse text-left">
					<thead>
						<tr>
							<Th className="border-none">Code</Th>
							<Th className="border-none">Product Name</Th>
							<Th className="border-none">Packing</Th>
							<Th className="border-none">Batch No.</Th>
							<Th className="whitespace-nowrap border-none">Inv. No.</Th>
							<Th className="whitespace-nowrap border-none">Inv. Dt.</Th>
							<Th className="border-none text-right">MRP</Th>
							<Th className="border-none text-right">PRate</Th>
							<Th className="border-none text-right">PTR</Th>
							<Th className="border-none text-right">Net Rate</Th>
							<Th className="border-none text-right">Inv. Rate</Th>
							<Th className="border-none text-right">Sale Qty</Th>
							<Th className="border-none text-right">Free Qty</Th>
							<Th className="border-none text-right">Actual FQty</Th>
							<Th className="border-none text-right">Claim Qty</Th>
							<Th className="border-none text-right">Rate Diff.</Th>
							<Th className="border-none text-right">Claim Value</Th>
							<Th className="border-none text-center">Item Scheme</Th>
							<Th className="border-none text-center">Applied Scheme</Th>
						</tr>
					</thead>
					<tbody className="border-gray-300 border-t">
						{manufacturers.map((mfg) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							const claimTypes = [
								...new Set(mfgData.map((d) => d.SchemeType)),
							].sort();

							return (
								<React.Fragment key={mfg}>
									<tr>
										<td
											className="px-2 pt-4 pb-2 font-bold text-[#0071BC] text-sm uppercase"
											colSpan={19}
										>
											{mfg} - {mfg}
										</td>
									</tr>
									{claimTypes.map((cType) => {
										const cTypeData = mfgData.filter(
											(d) => d.SchemeType === cType,
										);
										const parties = [
											...new Set(cTypeData.map((d) => d.Party)),
										].sort();

										let typeSaleQty = 0;
										let typeFreeQty = 0;
										let typeActualFQty = 0;
										let typeClaimQty = 0;
										let typeClaimVal = 0;

										return (
											<React.Fragment key={cType}>
												<tr>
													<td
														className="px-2 pt-2 pb-1 font-bold text-[11px] italic underline"
														colSpan={19}
													>
														Claim Type : {cType}
													</td>
												</tr>
												{parties.map((party) => {
													const partyData = cTypeData.filter(
														(d) => d.Party === party,
													);
													return (
														<React.Fragment key={party}>
															<tr>
																<td
																	className="px-2 pt-1 pb-1 font-bold text-[11px] italic"
																	colSpan={19}
																>
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
																		<Td className="border-none pt-0.5 pb-0">
																			{row.Code}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0">
																			{row["Product Name"]}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0">
																			{row.Packing}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0">
																			{row["Batch No."]}
																		</Td>
																		<Td className="whitespace-nowrap border-none pt-0.5 pb-0">
																			{row["Inv. No."]}
																		</Td>
																		<Td className="whitespace-nowrap border-none pt-0.5 pb-0">
																			{row["Inv. Dt."]}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row.MRP.toFixed(2)}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row.PRate.toFixed(2)}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row.PTR.toFixed(2)}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Net Rate"].toFixed(2)}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Inv. Rate"].toFixed(2)}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Sale Qty"] > 0
																				? row["Sale Qty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Free Qty"] > 0
																				? row["Free Qty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Actual FQty"] > 0
																				? row["Actual FQty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Claim Qty"] > 0
																				? row["Claim Qty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Rate Diff."] > 0
																				? row["Rate Diff."].toFixed(2)
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Claim Value"] > 0
																				? row["Claim Value"].toFixed(2)
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-center">
																			{row["Item Scheme"]}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-center">
																			{row["Applied Scheme"]}
																		</Td>
																	</tr>
																);
															})}
														</React.Fragment>
													);
												})}
												{/* Claim Type Total Row */}
												<tr>
													<td colSpan={11}></td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeSaleQty > 0 ? typeSaleQty : "-"}
													</td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeFreeQty > 0 ? typeFreeQty : "-"}
													</td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeActualFQty > 0 ? typeActualFQty : "-"}
													</td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeClaimQty > 0 ? typeClaimQty : "-"}
													</td>
													<td className="px-2 py-1"></td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeClaimVal > 0 ? typeClaimVal.toFixed(2) : "-"}
													</td>
													<td colSpan={2}></td>
												</tr>
												<tr>
													<td className="h-4" colSpan={19}></td>
												</tr>
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
				<div className="w-32 self-start rounded-t-sm bg-gray-100 px-4 py-1 font-bold text-[10px] uppercase">
					Summary :
				</div>
				<table className="mt-6 -ml-32 w-full max-w-[800px] border-collapse text-left">
					<thead>
						<tr>
							<th className="border-gray-300 border-y px-2 py-1 font-bold text-[10px] text-black uppercase">
								ItemName
							</th>
							<th className="border-gray-300 border-y px-2 py-1 text-center font-bold text-[10px] text-black uppercase">
								Packing
							</th>
							<th className="border-gray-300 border-y px-2 py-1 text-right font-bold text-[10px] text-black uppercase">
								Sale Qty
							</th>
							<th className="border-gray-300 border-y px-2 py-1 text-right font-bold text-[10px] text-black uppercase">
								Free Qty
							</th>
							<th className="border-gray-300 border-y px-2 py-1 text-right font-bold text-[10px] text-black uppercase">
								Actual FQty
							</th>
							<th className="border-gray-300 border-y px-2 py-1 text-right font-bold text-[10px] text-black uppercase">
								Claim Qty
							</th>
							<th className="border-gray-300 border-y px-2 py-1 text-right font-bold text-[10px] text-black uppercase">
								Claim Value
							</th>
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
							const totals = summaries.reduce(
								(acc, curr) => {
									acc.SaleQty += curr.SaleQty;
									acc.FreeQty += curr.FreeQty;
									acc.ClaimQty += curr.ClaimQty;
									acc.ClaimValue += curr.ClaimValue;
									return acc;
								},
								{ SaleQty: 0, FreeQty: 0, ClaimQty: 0, ClaimValue: 0 },
							);

							return (
								<>
									{summaries.map((s, i) => (
										<tr key={i}>
											<Td className="border-none pb-0 font-bold">
												{s.ItemName}
											</Td>
											<Td className="border-none pb-0 text-center">
												{s.Packing}
											</Td>
											<Td className="border-none pb-0 text-right">
												{s.SaleQty}
											</Td>
											<Td className="border-none pb-0 text-right">
												{s.FreeQty}
											</Td>
											<Td className="border-none pb-0 text-right">
												{s.FreeQty > 0 ? s.FreeQty : "-"}
											</Td>
											<Td className="border-none pb-0 text-right">
												{s.ClaimQty}
											</Td>
											<Td className="border-none pb-0 text-right">
												{s.ClaimValue.toFixed(2)}
											</Td>
										</tr>
									))}
									<tr>
										<td
											className="mt-2 border-gray-300 border-y px-2 py-1 font-bold text-[11px]"
											colSpan={2}
										>
											Total :
										</td>
										<td className="mt-2 border-gray-300 border-y px-2 py-1 text-right font-bold text-[11px]">
											{totals.SaleQty}
										</td>
										<td className="mt-2 border-gray-300 border-y px-2 py-1 text-right font-bold text-[11px]">
											{totals.FreeQty}
										</td>
										<td className="mt-2 border-gray-300 border-y px-2 py-1 text-right font-bold text-[11px]">
											{totals.FreeQty > 0 ? totals.FreeQty : "-"}
										</td>
										<td className="mt-2 border-gray-300 border-y px-2 py-1 text-right font-bold text-[11px]">
											{totals.ClaimQty}
										</td>
										<td className="mt-2 border-gray-300 border-y px-2 py-1 text-right font-bold text-[11px]">
											{totals.ClaimValue.toFixed(2)}
										</td>
									</tr>
								</>
							);
						})()}
					</tbody>
				</table>
			</div>

			{manufacturers.map((mfg) => {
				const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
				const mfgTotals = mfgData.reduce(
					(acc, curr) => {
						acc.SaleQty += curr["Sale Qty"];
						acc.FreeQty += curr["Free Qty"];
						acc.ClaimQty += curr["Claim Qty"];
						acc.ClaimValue += curr["Claim Value"];
						return acc;
					},
					{ SaleQty: 0, FreeQty: 0, ClaimQty: 0, ClaimValue: 0 },
				);

				return (
					<div
						className="mt-8 w-full border-gray-300 border-y py-2 font-bold text-[11px] text-black"
						key={mfg}
					>
						<table className="w-full min-w-[1200px] text-left">
							<tbody>
								<tr>
									<td className="w-[60%]" colSpan={11}>
										Total of {mfg} :
									</td>
									<td className="text-right">{mfgTotals.SaleQty}</td>
									<td className="text-right">{mfgTotals.FreeQty}</td>
									<td className="text-right">-</td>
									<td className="text-right">{mfgTotals.ClaimQty}</td>
									<td></td>
									<td className="text-right">
										{mfgTotals.ClaimValue.toFixed(2)}
									</td>
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
