import Image from "next/image";
import React from "react";
import {
	getMRwisePeriodicalOutstanding,
	type OverduePeriodicalOutstandingRow,
} from "@/server/actions/overdueReports";
import { getMRInfo } from "@/server/actions/mrInfo";
import { db } from "@/server/db";
import { mrManufacturers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

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
	const dbAssignments = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	const assigned =
		dbAssignments.length > 0
			? dbAssignments
			: mrInfo.company
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
			? mrInfo.companyCode || (targetCompanies.length > 0 ? targetCompanies : "")
			: mrInfo.companyCode && (mrInfo.company === company || mrInfo.division === company)
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

	let rowsToProcess = procResult.success && procResult.data ? procResult.data : [];

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
			{/* DEBUG QUERY BANNER */}
			{(searchParams?.debug === "1" || searchParams?.debug === "true") && (
				<div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-mono text-xs text-amber-950 shadow-sm print:hidden">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2 mb-2 font-bold text-amber-900 text-xs">
						<span>[DEBUG QUERY] Stored Procedure Execution Status (Overdue / Periodical Outstanding)</span>
						<span className="rounded bg-amber-200 px-2 py-0.5 text-[11px] font-semibold">
							{procResult.success
								? `${procResult.data?.length ?? 0} total rows (${reportData.length} pending overdue)`
								: procResult.error || "Query Failed"}
						</span>
					</div>
					<div className="space-y-1.5">
						<p className="font-bold text-amber-900 text-[11px]">Final SQL Query being run:</p>
						<pre className="overflow-x-auto rounded border border-amber-200 bg-amber-100 p-2.5 text-[11px] font-mono select-all whitespace-pre-wrap break-all text-amber-950">
							{procResult.debugSql || "-- No SQL available"}
						</pre>
						<div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-amber-800 pt-1.5 border-t border-amber-200">
							<div><span className="font-semibold">Company Code Query:</span> {JSON.stringify(compCodeToQuery)}</div>
							<div><span className="font-semibold">MR Company:</span> {mrInfo.company || "N/A"}</div>
							<div><span className="font-semibold">MR ID Param:</span> {`(${mrId})`}</div>
							<div><span className="font-semibold">LocNo:</span> {mrInfo.locNo || "11"}</div>
						</div>
					</div>
				</div>
			)}

			{/* Header */}
			<div className="mb-2 flex flex-col items-start justify-between gap-4 border-[#0B2545] border-b-2 pb-2 md:flex-row">
				<div className="flex items-center gap-4">
					<div>
						<h2 className="font-extrabold text-2xl text-[#0B2545] tracking-tight">
							<Image src="/logo.png" alt="Asmee Pharma Logo" width={180} height={50} className="object-contain" priority />
						</h2>
						<p className="mt-1 font-medium text-[#0B2545] text-sm leading-relaxed">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP
							ROAD,
							<br />
							RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br />
							Contact: 9409789800, 9409789700 Mobile: 9409789700 Email:
							asmeepharma2022@gmail.com
						</p>
					</div>
				</div>
			</div>

			<div className="mb-4 flex items-end justify-between font-bold text-[#0B2545] text-sm">
				<div>
					<p>Year : 2026-27</p>
					<p className="mt-2 text-base">
						Overdue (Purchase Days & Outstanding) Statement for {fromDisplay} to {toDisplay}
					</p>
				</div>
				<div>Total Records: {reportData.length}</div>
			</div>

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
								<td colSpan={7} className="py-8 text-center text-gray-500 font-medium">
									No overdue records found for the selected period.
								</td>
							</tr>
						) : (
							manufacturers.map((mfg, idx) => {
								const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
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

											return (
												<React.Fragment key={pIdx}>
													{/* Party Data Rows */}
													{partyData.map((row, rowIdx) => {
														partyTotal += row["Amount Due"];
														return (
															<tr
																className="border-gray-100 border-b text-[#0B2545] hover:bg-gray-50"
																key={rowIdx}
															>
																<td className="whitespace-nowrap py-1.5 pl-2 font-semibold">
																	{row["Invoice No"]}
																</td>
																<td className="py-1.5">{row["Invoice Date"]}</td>
																<td className="py-1.5">{row["Due Date"]}</td>
																<td
																	className={`py-1.5 text-right font-bold ${
																		row["Purchase Days"] > 90
																			? "text-red-600 font-extrabold"
																			: "text-amber-600"
																	}`}
																>
																	{row["Purchase Days"]}
																</td>
																<td className="py-1.5 font-bold">
																	{row["Doctor / Party"]}
																</td>
																<td className="py-1.5">{row.City}</td>
																<td className="py-1.5 pr-2 text-right font-bold text-rose-600">
																	{row["Amount Due"].toFixed(2)}
																</td>
															</tr>
														);
													})}
													{/* Party Total */}
													<tr className="border-gray-200 border-y bg-gray-50 font-bold text-[#0B2545]">
														<td className="py-1.5 pl-2 text-right text-gray-500" colSpan={6}>
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
								<td className="py-3 pl-2 text-right uppercase tracking-wider" colSpan={6}>
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
