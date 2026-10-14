import React from "react";
import { ReportStationeryHeader } from "@/components/report-stationery-header";
import { getCustomerBlockingMap } from "@/server/actions/customerBlocking";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getMRwisePeriodicalOutstanding,
	type OverduePeriodicalOutstandingRow,
} from "@/server/actions/overdueReports";

function formatDisplayDate(dateStr?: string | Date): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return String(dateStr);
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

export async function OverdueReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
		party?: string;
		q?: string;
		debug?: string;
	};
}) {
	// 1. Fetch MR Info
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo) return <div>MR not found.</div>;

	const company = searchParams?.division || "All";
	const assigned = mrInfo.company
		? [
			{
				id: `legacy-${mrId}`,
				mrId,
				manufacturer: mrInfo.company,
				firmNo: null,
				division: mrInfo.division || null,
				company: mrInfo.company,
				createdAt: new Date(),
			},
		]
		: [];

	const selectedAssignments =
		company === "All"
			? assigned
			: assigned.filter((a) => (a.division || a.manufacturer) === company);

	const targetCompanies = Array.from(
		new Set(selectedAssignments.map((a) => a.manufacturer).filter(Boolean)),
	) as string[];

	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode ||
			(targetCompanies.length > 0 ? targetCompanies : "")
			: mrInfo.companyCode &&
				(mrInfo.company === company || mrInfo.division === company)
				? mrInfo.companyCode
				: company;

	// 2. Call stored procedure `rptMRwisePeriodicalOutstanding`
	const procResult = await getMRwisePeriodicalOutstanding({
		mrId,
		fromDate: searchParams?.from,
		toDate: searchParams?.to,
		compCode: compCodeToQuery,
		locNo: mrInfo.locNo,
	});

	// Fetch live customer blocking map from ERP
	const customerBlockingMap = await getCustomerBlockingMap();

	let rowsToProcess =
		procResult.success && procResult.data ? procResult.data : [];

	if (searchParams?.party) {
		const partyFilter = searchParams.party.toLowerCase();
		rowsToProcess = rowsToProcess.filter(
			(r) => r.Customer && r.Customer.toLowerCase().includes(partyFilter),
		);
	}

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		rowsToProcess = rowsToProcess.filter(
			(r) =>
				(r.Customer && r.Customer.toLowerCase().includes(q)) ||
				(r.DocNo && r.DocNo.toLowerCase().includes(q)) ||
				(r.City && r.City.toLowerCase().includes(q)) ||
				(r.CompCode && r.CompCode.toLowerCase().includes(q)) ||
				(r.Division && r.Division.toLowerCase().includes(q)),
		);
	}

	// Filter strictly for entries where Amount - AdjAmt > 0
	const overdueFilteredRows = rowsToProcess.filter((row) => {
		const originalAmt = Number(row.Amount || 0);
		const adjAmt = Number(row.AdjAmt || 0);
		return originalAmt - adjAmt > 0;
	});

	const now = new Date();

	const reportData = overdueFilteredRows.map((row) => {
		const invDateStr = formatDisplayDate(row.DocDate) || "N/A";
		const dueDateStr = row.DueDate || "N/A";

		let purchaseDays = 0;
		if (row.DocDate) {
			const invDate = new Date(row.DocDate);
			if (!isNaN(invDate.getTime())) {
				const diffTime = Math.abs(now.getTime() - invDate.getTime());
				purchaseDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			}
		} else if (row.OverDays != null) {
			purchaseDays = Math.abs(row.OverDays);
		}

		const originalAmt = Number(row.Amount || 0);
		const adjAmt = Number(row.AdjAmt || 0);
		const amountDue = originalAmt - adjAmt;

		return {
			Manufacturer: row.Division || row.CompCode || "Unknown",
			"Doctor / Party": row.Customer || "Unknown",
			City: row.City || "Unknown",
			"Invoice No": row.DocNo || "N/A",
			"Invoice Date": invDateStr,
			"Due Date": dueDateStr,
			"Purchase Days": purchaseDays,
			"Amount Due": amountDue,
			OriginalAmount: originalAmt,
			AdjAmount: adjAmt,
		};
	});

	// Grouping by Manufacturer
	const manufacturers = [
		...new Set(reportData.map((d) => d.Manufacturer)),
	].sort();
	let grandTotalAmount = 0;

	const fromDisplay = formatDisplayDate(searchParams?.from) || "01/09/2026";
	const toDisplay = formatDisplayDate(searchParams?.to) || "30/09/2026";

	return (
		<div className="mt-4 space-y-8 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{/* Official Stationery Header */}
			<ReportStationeryHeader
				title="Overdue (Purchase Days & Outstanding) Statement"
				fromDisplay={fromDisplay}
				toDisplay={toDisplay}
				summaryRight={`Total Records: ${reportData.length}`}
			/>

			<div className="w-full overflow-x-auto border-[#0B2545] border-t-2 pt-1">
				<table className="w-full min-w-[900px] border-collapse text-left font-sans">
					<thead>
						<tr className="border-[#0B2545] border-y-2 bg-gray-50/70">
							<th className="py-2 pl-2 font-bold text-[#0B2545] text-sm">
								Invoice No.
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">
								Invoice Date
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">
								Due Date
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Purchase Days
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">
								Doctor / Party
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">City</th>
							<th className="py-2 pr-2 text-right font-bold text-[#0B2545] text-sm">
								Amount Due
							</th>
						</tr>
					</thead>
					<tbody className="font-medium text-sm">
						{manufacturers.length === 0 ? (
							<tr>
								<td
									className="py-8 text-center font-medium text-gray-500"
									colSpan={7}
								>
									No overdue records found for the selected period.
								</td>
							</tr>
						) : (
							manufacturers.map((mfg, idx) => {
								const mfgData = reportData.filter(
									(d) => d.Manufacturer === mfg,
								);
								let mfgAmount = 0;

								// Further group by Doctor/Party
								const parties = [
									...new Set(mfgData.map((d) => d["Doctor / Party"])),
								].sort();

								return (
									<React.Fragment key={idx}>
										{/* Company Header Row */}
										<tr>
											<td
												className="border-gray-200 border-b bg-gray-50/50 px-2 py-2 font-bold text-[#000080]"
												colSpan={7}
											>
												Company : {mfg.toUpperCase()}
											</td>
										</tr>

										{parties.map((party, pIdx) => {
											const partyData = mfgData.filter(
												(d) => d["Doctor / Party"] === party,
											);
											let partyTotal = 0;
											const custBlockedInfo = customerBlockingMap.get(
												party.toUpperCase(),
											);

											return (
												<React.Fragment key={pIdx}>
													{/* Party Data Rows */}
													{partyData.map((row, rowIdx) => {
														partyTotal += row["Amount Due"];
														const isOlderThan90 = row["Purchase Days"] > 90;
														return (
															<tr
																className={`border-gray-100 border-b transition-colors ${isOlderThan90
																		? "bg-red-50/70 text-red-950 hover:bg-red-100/60"
																		: "text-[#0B2545] hover:bg-gray-50"
																	}`}
																key={rowIdx}
															>
																<td className="whitespace-nowrap py-1.5 pl-2 font-semibold">
																	{row["Invoice No"]}
																</td>
																<td className="py-1.5">
																	{row["Invoice Date"]}
																</td>
																<td className="py-1.5">{row["Due Date"]}</td>
																<td
																	className={`py-1.5 text-right font-bold ${isOlderThan90
																			? "font-extrabold text-red-700"
																			: "text-amber-600"
																		}`}
																>
																	{row["Purchase Days"]}
																</td>
																<td className="flex items-center gap-2 py-1.5 font-bold">
																	<span>{row["Doctor / Party"]}</span>
																	{custBlockedInfo?.isBlocked && (
																		<span
																			className="inline-block rounded bg-red-100 px-1.5 py-0.5 font-black text-[10px] text-red-800 uppercase tracking-wider"
																			title={
																				custBlockedInfo.blockReason ||
																				"Party Blocked in ERP"
																			}
																		>
																			{custBlockedInfo.blackList
																				? "BLACKLISTED"
																				: "BLOCKED"}
																		</span>
																	)}
																</td>
																<td className="py-1.5">{row.City}</td>
																<td
																	className={`py-1.5 pr-2 text-right font-bold ${isOlderThan90
																			? "font-black text-red-700"
																			: "text-rose-600"
																		}`}
																>
																	{row["Amount Due"].toFixed(2)}
																</td>
															</tr>
														);
													})}
													{/* Party Total */}
													<tr className="border-gray-200 border-y bg-gray-50 font-bold text-[#0B2545]">
														<td
															className="py-1.5 pl-2 text-right text-gray-500"
															colSpan={6}
														>
															Total for {party}
														</td>
														<td className="py-1.5 pr-2 text-right text-rose-700">
															{partyTotal.toFixed(2)}
														</td>
													</tr>
													{(() => {
														mfgAmount += partyTotal;
														return null;
													})()}
												</React.Fragment>
											);
										})}

										{/* Full Company Total */}
										<tr className="border-gray-400 border-b-2 bg-gray-100 font-bold text-[#0B2545]">
											<td className="py-2 pl-2 text-right" colSpan={6}>
												Total for {mfg.toUpperCase()} :
											</td>
											<td className="py-2 pr-2 text-right text-rose-700">
												{mfgAmount.toFixed(2)}
											</td>
										</tr>
										{(() => {
											grandTotalAmount += mfgAmount;
											return null;
										})()}
									</React.Fragment>
								);
							})
						)}
						{/* Grand Total */}
						{manufacturers.length > 0 && (
							<tr className="border-[#0B2545] border-b-4 bg-gray-200 font-extrabold text-[#0B2545] text-base">
								<td
									className="py-3 pl-2 text-right uppercase tracking-wider"
									colSpan={6}
								>
									Grand Total :
								</td>
								<td className="py-3 pr-2 text-right text-rose-700">
									{grandTotalAmount.toFixed(2)}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
