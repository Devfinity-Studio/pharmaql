import React from "react";
import { ReportStationeryHeader } from "@/components/report-stationery-header";
import { OfflineReportSync } from "@/components/offline-report-sync";
import { getClaimData } from "@/server/actions/claimData";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getMROverrides } from "@/server/actions/mrs";

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
	const defaultFrom = searchParams?.from || "2026-04-01";
	const defaultTo = searchParams?.to || "2026-09-30";

	const mrOverrides = await getMROverrides();
	const currentOverrides = mrOverrides[mrId] || {};
	const assigned = currentOverrides.assignedManufacturers || [];

	// Collect all registered company and division names for this MR
	const registeredCompanies = new Set<string>();
	const registeredCodes = new Set<string>();

	if (mrInfo.company) registeredCompanies.add(mrInfo.company.toLowerCase().trim());
	if (mrInfo.companyCode) registeredCodes.add(mrInfo.companyCode.toLowerCase().trim());
	if (mrInfo.division) registeredCompanies.add(mrInfo.division.toLowerCase().trim());

	for (const a of (mrInfo.assignments || [])) {
		if (a.company) registeredCompanies.add(a.company.toLowerCase().trim());
		if (a.manufacturer) registeredCompanies.add(a.manufacturer.toLowerCase().trim());
		if (a.division) registeredCompanies.add(a.division.toLowerCase().trim());
		if (a.companyCode) registeredCodes.add(a.companyCode.toLowerCase().trim());
	}

	for (const a of assigned) {
		if (a.manufacturer) registeredCompanies.add(a.manufacturer.toLowerCase().trim());
		if (a.division) registeredCompanies.add(a.division.toLowerCase().trim());
	}

	const compCodeToQuery = (() => {
		if (company === "All") {
			const allCodes = Array.from(
				new Set(
					(mrInfo.assignments || [])
						.map((a) => a.companyCode)
						.filter(Boolean),
				),
			);
			return allCodes.length > 0
				? allCodes.join(",")
				: mrInfo.companyCode || mrInfo.company || "";
		}
		const matchingAssignment = (mrInfo.assignments || []).find(
			(a) =>
				a.division === company ||
				a.manufacturer === company ||
				a.company === company,
		);
		if (matchingAssignment?.companyCode) return matchingAssignment.companyCode;
		return mrInfo.companyCode || company;
	})();

	const claimResult = await getClaimData({
		uniqueCode: `claim-${mrId}-${Date.now()}`,
		fromDate: defaultFrom,
		toDate: defaultTo,
		compCode: compCodeToQuery,
		locNo: mrInfo.locNo,
	});

	const rawRows = claimResult.success && claimResult.data ? claimResult.data : [];

	// Filter rows so only companies the MR is registered for are ever displayed
	const filteredRows = rawRows.filter((row) => {
		const rowComp = (row.Company || "").toLowerCase().trim();
		const rowDiv = (row.Division || "").toLowerCase().trim();
		const rowCode = (row.Code || "").toLowerCase().trim();

		// If a specific division was chosen from the division selector:
		if (company !== "All") {
			const sel = company.toLowerCase().trim();
			return (
				(rowComp !== "" && (rowComp.includes(sel) || sel.includes(rowComp))) ||
				(rowDiv !== "" && (rowDiv.includes(sel) || sel.includes(rowDiv))) ||
				(rowCode !== "" && rowCode === sel)
			);
		}

		// When "All" is selected, only permit registered companies/divisions for this MR
		if (registeredCompanies.size === 0 && registeredCodes.size === 0) return true;

		for (const reg of registeredCompanies) {
			if (!reg) continue;
			if (
				(rowComp !== "" && (rowComp.includes(reg) || reg.includes(rowComp))) ||
				(rowDiv !== "" && (rowDiv.includes(reg) || reg.includes(rowDiv)))
			) {
				return true;
			}
		}

		for (const code of registeredCodes) {
			if (!code) continue;
			if (
				(rowCode !== "" && rowCode === code) ||
				(rowComp !== "" && (rowComp.includes(code) || code.includes(rowComp)))
			) {
				return true;
			}
		}

		return false;
	});

	const reportData: any[] = [];

	if (filteredRows.length > 0) {
		filteredRows.forEach((row) => {
			const ptr = Number(row.PTR || 0);
			const sRate = Number(row.SRate || 0);
			const pRate = Number(row.PRate || 0);
			const mrp = Number(row.MRP || 0);
			const qty = Number(row.Qty || 0);
			const free = Number(row.Free || row.FQty || 0);
			const fQty = Number(row.FQty || 0);
			const schemeStr = (row.Scheme || "").toString().trim();

			// Calculate NetRate from Scheme if present
			let netRate = ptr;
			if (schemeStr && schemeStr.includes("+")) {
				const parts = schemeStr.split("+");
				const a = parseFloat(parts[0] || "");
				const b = parseFloat(parts[1] || "");
				if (!isNaN(a) && !isNaN(b) && a > 0 && a + b > 0) {
					netRate = Number(((ptr * a) / (a + b)).toFixed(2));
				}
			} else if (schemeStr && schemeStr.endsWith("%")) {
				const disc = parseFloat(schemeStr);
				if (!isNaN(disc) && disc > 0) {
					netRate = Number((ptr * (1 - disc / 100)).toFixed(2));
				}
			}

			// Qty Claim if free goods given (or returned), otherwise Rate Claim
			const isQtyClaim = free !== 0;
			const schemeType = isQtyClaim ? "Qty" : "Rate";

			// Apply Exact User Formulae:
			// Qty Claim: Claim Value = PTR x ClaimQty
			// Rate Claim (Scheme): Claim Value = (NetRate - InvRate) x SaleQty
			// Rate Claim (No Scheme): Claim Value = (PTR - InvRate) x SaleQty
			let claimVal = 0;
			if (isQtyClaim) {
				claimVal = Number((ptr * free).toFixed(2));
			} else {
				const diff = netRate - sRate;
				claimVal = diff > 0 ? Number((diff * qty).toFixed(2)) : 0;
			}

			const rawDiff = Number((netRate - sRate).toFixed(2));
			const rateDiff = rawDiff > 0 ? rawDiff : "-";

			reportData.push({
				Company:
					row.Company || mrInfo.company || (company !== "All" ? company : "All"),
				Division:
					row.Division || mrInfo.division || (company !== "All" ? company : "General"),
				Manufacturer:
					row.Company || row.Division || (company !== "All" ? company : "All"),
				SchemeType: schemeType,
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
				"Net Rate": netRate,
				"Inv. Rate": sRate,
				"Sale Qty": qty,
				"Free Qty": free,
				"Actual FQty": fQty,
				"Claim Qty": free,
				"Rate Diff.": rateDiff,
				"Claim Value": claimVal,
				"Item Scheme": schemeStr || "-",
				"Applied Scheme": schemeStr || "-",
			});
		});
	}

	if (reportData.length === 0) {
		return (
			<div className="mt-4 space-y-4">
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
		<div className="mt-4 rounded-xl border border-gray-300 bg-white p-6 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none">
			<OfflineReportSync
				data={reportData}
				mrId={mrId}
				params={searchParams}
				tab="free-schemes"
			/>
			{/* Official Stationery Header */}
			<ReportStationeryHeader
				title="Claim Quantity Statement"
				fromDisplay={defaultFrom ? defaultFrom.split("-").reverse().join("/") : undefined}
				toDisplay={defaultTo ? defaultTo.split("-").reverse().join("/") : undefined}
				summaryRight={
					<div className="text-right font-medium text-[10px] text-gray-700">
						<div><span className="font-bold text-[#0B2545]">Qty Claim:</span> PTR × ClaimQty</div>
						<div><span className="font-bold text-[#0B2545]">Rate Claim:</span> (NetRate - InvRate) × SaleQty</div>
					</div>
				}
			/>

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
							const compName = (
								mfgData[0]?.Company ||
								mfgData[0]?.Manufacturer ||
								mfg
							).toUpperCase();
							const divName = (
								mfgData[0]?.Division ||
								mfg
							).toUpperCase();
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
											Company:{compName} - {divName}
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
													let partySaleQty = 0;
													let partyFreeQty = 0;
													let partyActualFQty = 0;
													let partyClaimQty = 0;
													let partyClaimVal = 0;

													return (
														<React.Fragment key={party}>
															<tr>
																<td
																	className="px-2 pt-2 pb-1 font-bold text-[11px] italic"
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

																partySaleQty += row["Sale Qty"];
																partyFreeQty += row["Free Qty"];
																partyActualFQty += row["Actual FQty"];
																partyClaimQty += row["Claim Qty"];
																partyClaimVal += row["Claim Value"];

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
																			{row["Sale Qty"] !== 0
																				? row["Sale Qty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Free Qty"] !== 0
																				? row["Free Qty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Actual FQty"] !== 0
																				? row["Actual FQty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{row["Claim Qty"] !== 0
																				? row["Claim Qty"]
																				: "-"}
																		</Td>
																		<Td className="border-none pt-0.5 pb-0 text-right">
																			{typeof row["Rate Diff."] === "number" &&
																				row["Rate Diff."] > 0
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
															{/* Customer Subtotal Row */}
															<tr className="border-gray-200 border-t">
																<td
																	className="px-2 pt-1 pb-1 text-right font-bold text-[10px] text-gray-700 italic"
																	colSpan={11}
																>
																	Total of {party} :
																</td>
																<td className="px-2 pt-1 pb-1 text-right font-bold text-[10px] text-gray-900">
																	{partySaleQty !== 0 ? partySaleQty : "-"}
																</td>
																<td className="px-2 pt-1 pb-1 text-right font-bold text-[10px] text-gray-900">
																	{partyFreeQty !== 0 ? partyFreeQty : "-"}
																</td>
																<td className="px-2 pt-1 pb-1 text-right font-bold text-[10px] text-gray-900">
																	{partyActualFQty > 0 ? partyActualFQty : "-"}
																</td>
																<td className="px-2 pt-1 pb-1 text-right font-bold text-[10px] text-gray-900">
																	{partyClaimQty !== 0 ? partyClaimQty : "-"}
																</td>
																<td className="px-2 pt-1 pb-1"></td>
																<td className="px-2 pt-1 pb-1 text-right font-bold text-[10px] text-gray-900">
																	{partyClaimVal > 0
																		? partyClaimVal.toFixed(2)
																		: "-"}
																</td>
																<td colSpan={2}></td>
															</tr>
														</React.Fragment>
													);
												})}
												{/* Claim Type Total Row */}
												<tr>
													<td colSpan={11}></td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeSaleQty !== 0 ? typeSaleQty : "-"}
													</td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeFreeQty !== 0 ? typeFreeQty : "-"}
													</td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeActualFQty > 0 ? typeActualFQty : "-"}
													</td>
													<td className="border-gray-400 border-y px-2 py-1 text-right font-bold text-[11px]">
														{typeClaimQty !== 0 ? typeClaimQty : "-"}
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
										ActualFQty: 0,
										ClaimQty: 0,
										ClaimValue: 0,
									});
								}
								const agg = summaryMap.get(key);
								agg.SaleQty += item["Sale Qty"];
								agg.FreeQty += item["Free Qty"];
								agg.ActualFQty += item["Actual FQty"];
								agg.ClaimQty += item["Claim Qty"];
								agg.ClaimValue += item["Claim Value"];
							});

							const summaries = Array.from(summaryMap.values());
							const totals = summaries.reduce(
								(acc, curr) => {
									acc.SaleQty += curr.SaleQty;
									acc.FreeQty += curr.FreeQty;
									acc.ActualFQty += curr.ActualFQty;
									acc.ClaimQty += curr.ClaimQty;
									acc.ClaimValue += curr.ClaimValue;
									return acc;
								},
								{ SaleQty: 0, FreeQty: 0, ActualFQty: 0, ClaimQty: 0, ClaimValue: 0 },
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
												{s.ActualFQty > 0 ? s.ActualFQty : "-"}
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
											{totals.ActualFQty > 0 ? totals.ActualFQty : "-"}
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
						<table className="w-full min-w-[1200px] border-collapse text-left">
							<tbody>
								<tr>
									<td className="px-2" colSpan={11}>
										Total of {mfg} :
									</td>
									<td className="px-2 text-right">{mfgTotals.SaleQty}</td>
									<td className="px-2 text-right">{mfgTotals.FreeQty}</td>
									<td className="px-2 text-right">-</td>
									<td className="px-2 text-right">{mfgTotals.ClaimQty}</td>
									<td className="px-2"></td>
									<td className="px-2 text-right">
										{mfgTotals.ClaimValue.toFixed(2)}
									</td>
									<td className="px-2" colSpan={2}></td>
								</tr>
							</tbody>
						</table>
					</div>
				);
			})}
		</div>
	);
}
