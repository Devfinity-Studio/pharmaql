import React from "react";
import { headers } from "next/headers";
import { OfflineReportSync } from "@/components/offline-report-sync";
import { ReportStationeryHeader } from "@/components/report-stationery-header";
import { getCustomerBlockingMap } from "@/server/actions/customerBlocking";
import { getMRInfo, type MRAssignment } from "@/server/actions/mrInfo";
import {
	getMRwisePeriodicalOutstanding,
	type OverduePeriodicalOutstandingRow,
} from "@/server/actions/overdueReports";

function formatDisplayDate(dateStr?: string | Date | null): string {
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
		asOn?: string;
		party?: string;
		q?: string;
		debug?: string;
		mr?: string;
	};
}) {
	// 1. Fetch MR Info & Tenant Limits
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo) return <div>MR not found.</div>;

	let directBlockDays = 90;
	let tenantName = "ASMEE PHARMA PRIVATE LIMITED";
	let tenantAddress = "BASEMENT-GF, 11/2 ASHOK HOUSE, PRATAP ROAD, RAOPURA, VADODARA";
	let tenantPhone = "9409789800";
	let tenantEmail = "asmeepharma2022@gmail.com";

	try {
		const h = await headers();
		const limitH = Number(h.get("x-tenant-overdue-direct"));
		if (!isNaN(limitH) && limitH > 0) directBlockDays = limitH;
		if (h.get("x-tenant-name")) tenantName = h.get("x-tenant-name")!;
		if (h.get("x-tenant-address")) tenantAddress = h.get("x-tenant-address")!;
		if (h.get("x-tenant-phone")) tenantPhone = h.get("x-tenant-phone")!;
		if (h.get("x-tenant-email")) tenantEmail = h.get("x-tenant-email")!;
	} catch {}

	const company = searchParams?.division || "All";
	const assigned: MRAssignment[] =
		mrInfo.assignments && mrInfo.assignments.length > 0
			? mrInfo.assignments
			: mrInfo.company
				? [
						{
							id: mrId,
							manufacturer: mrInfo.company,
							division: mrInfo.division || null,
							company: mrInfo.company,
							companyCode: mrInfo.companyCode || undefined,
						},
					]
				: [];

	const selectedAssignments =
		company === "All"
			? assigned
			: assigned.filter(
					(a) =>
						(a.division && a.division.toLowerCase() === company.toLowerCase()) ||
						(a.manufacturer && a.manufacturer.toLowerCase() === company.toLowerCase()) ||
						(a.company && a.company.toLowerCase() === company.toLowerCase()) ||
						(a.companyCode && a.companyCode.toLowerCase() === company.toLowerCase()),
				);

	const targetCompanies = Array.from(
		new Set(selectedAssignments.map((a) => a.companyCode || a.manufacturer || a.company).filter(Boolean)),
	) as string[];

	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || (targetCompanies.length > 0 ? targetCompanies[0] : "")
			: selectedAssignments[0]?.companyCode ||
				(mrInfo.companyCode && (mrInfo.company === company || mrInfo.division === company)
					? mrInfo.companyCode
					: company);

	// In Technomax ERP, the Overdue Report (rptMRwisePeriodicalOutstanding) is an MR-wise listing of ALL MRs
	// of that company-division. By default, p_MRId is '' (empty string) so all MRs are returned and grouped MR-wise.
	// If a specific MR filter is explicitly requested via searchParams.mr, that specific single MR ID is used.
	const targetMrId = searchParams?.mr && searchParams.mr.toLowerCase() !== "all"
		? String(searchParams.mr).replace(/[()]/g, "").trim()
		: "";

	const asOnDateStr = searchParams?.asOn || searchParams?.to || new Date().toISOString().slice(0, 10);
	const toDateStr = asOnDateStr;
	const fromDateStr = asOnDateStr;

	// 2. Call stored procedure `rptMRwisePeriodicalOutstanding`
	const procResult = await getMRwisePeriodicalOutstanding({
		mrId: targetMrId,
		fromDate: fromDateStr,
		toDate: toDateStr,
		recDate: "2026-04-01",
		compCode: compCodeToQuery,
		locNo: mrInfo.locNo,
	});

	// Fetch live customer blocking map from ERP
	const customerBlockingMap = await getCustomerBlockingMap();

	if (!procResult.success) {
		console.error("[OverdueReportView] Failed to fetch outstanding report:", procResult.error);
	}

	let rowsToProcess =
		procResult.success && procResult.data ? procResult.data : [];

	if (company !== "All") {
		const sel = company.trim().toUpperCase();
		rowsToProcess = rowsToProcess.filter((r) => {
			const rowDiv = (r.Division || "").toString().trim().toUpperCase();
			const rowComp = (r.CompCode || "").toString().trim().toUpperCase();
			if (rowDiv) {
				return rowDiv === sel || rowDiv.includes(sel) || sel.includes(rowDiv);
			}
			return rowComp === sel || rowComp.includes(sel) || sel.includes(rowComp);
		});
	}

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
				(r.Area && r.Area.toLowerCase().includes(q)) ||
				(r.CustCode && r.CustCode.toLowerCase().includes(q)) ||
				(r.CompCode && r.CompCode.toLowerCase().includes(q)) ||
				(r.Division && r.Division.toLowerCase().includes(q)),
		);
	}

	// Filter strictly for entries where Amount - AdjAmt > 0 (pending balance)
	const overdueFilteredRows = rowsToProcess.filter((row) => {
		const originalAmt = Number(row.Amount || 0);
		const adjAmt = Number(row.AdjAmt || 0);
		return originalAmt - adjAmt > 0;
	});

	// Map and group according to Technomax ERP statement structure:
	// MR -> City/Area -> Party -> Invoices
	interface NormalizedOverdueRow {
		id: number;
		docType: string;
		invDate: string;
		invoiceNo: string;
		dueDate: string;
		dueDays: number;
		invoiceAmount: number;
		receivedAmount: number;
		receivedDate: string;
		pendingAmount: number;
		mrName: string;
		city: string;
		area: string;
		cityAreaKey: string;
		custCode: string;
		customer: string;
		address: string;
		partyKey: string;
		company: string;
		division: string;
	}

	const normalizedRows: NormalizedOverdueRow[] = overdueFilteredRows.map((row) => {
		const originalAmt = Number(row.Amount || 0);
		const adjAmt = Number(row.AdjAmt || 0);
		const pendingAmt = originalAmt - adjAmt;

		const city = (row.City || "UNKNOWN").trim();
		const area = (row.Area || "GENERAL").trim();
		const cityAreaKey = `${city} - ${area}`.toUpperCase();

		const custCode = (row.CustCode || "").trim();
		const customer = (row.Customer || "Unknown Party").trim();
		const address = (row.Address1 || "").trim();
		const partyKey = `${custCode} - ${customer}${address ? `, ${address}` : ""}`.toUpperCase();

		const rawDueDays = Number(row.OverDays || 0);
		const recDateStr = row.RecDate ? formatDisplayDate(row.RecDate) : "";

		return {
			id: row.ID,
			docType: row.DocType || "SALE",
			invDate: formatDisplayDate(row.DocDate) || "N/A",
			invoiceNo: row.DocNo || row.AgainstNo || "N/A",
			dueDate: row.DueDate || formatDisplayDate(row.DocDate) || "N/A",
			dueDays: rawDueDays,
			invoiceAmount: originalAmt,
			receivedAmount: adjAmt,
			receivedDate: recDateStr,
			pendingAmount: pendingAmt,
			mrName: (row.MRName || mrInfo.name || "Unknown MR").trim(),
			city,
			area,
			cityAreaKey,
			custCode,
			customer,
			address,
			partyKey,
			company: row.CompCode || "Unknown",
			division: row.Division || "General",
		};
	});

	// Grouping: MR -> City/Area -> Party
	const mrGroups = Array.from(new Set(normalizedRows.map((r) => r.mrName))).sort();

	let grandTotalInvoiceAmt = 0;
	let grandTotalReceivedAmt = 0;
	let grandTotalPendingAmt = 0;

	const asOnDisplay = formatDisplayDate(asOnDateStr) || formatDisplayDate(new Date());

	return (
		<div className="mt-4 space-y-8 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
			<OfflineReportSync
				data={normalizedRows}
				mrId={mrId}
				params={searchParams}
				tab="overdue"
			/>
			{/* Official Stationery Header */}
			<ReportStationeryHeader
				asOnDate={asOnDisplay}
				summaryRight={`Total Records: ${normalizedRows.length}`}
				title="MRwise Periodical Outstanding"
			/>

			<div className="flex flex-wrap items-center justify-between border-b border-gray-200 pb-3 text-xs text-gray-500">
				<div>
					<span className="font-semibold text-gray-700">AsOn Date:</span> {asOnDisplay}
				</div>
				<div>
					<span className="font-semibold text-gray-700">Year:</span> 2026-27
				</div>
			</div>

			<div className="w-full overflow-x-auto border-t-2 border-[#0B2545] pt-1">
				<table className="w-full min-w-[1050px] border-collapse text-left font-sans text-xs">
					<thead>
						<tr className="border-y-2 border-[#0B2545] bg-gray-50/80 font-bold text-[#0B2545]">
							<th className="py-2.5 pl-2">Doc Type</th>
							<th className="py-2.5">Inv. Date</th>
							<th className="py-2.5">Invoice No.</th>
							<th className="py-2.5">Due Date</th>
							<th className="py-2.5 text-right">Due Days</th>
							<th className="py-2.5 text-right">Invoice Amount</th>
							<th className="py-2.5 text-right">Received Amount</th>
							<th className="py-2.5 text-center">Received Date</th>
							<th className="py-2.5 text-right font-black">Pending Amount</th>
							<th className="py-2.5 pr-2 text-right font-black">Cumm. Total</th>
						</tr>
					</thead>
					<tbody className="font-medium text-slate-800">
						{mrGroups.length === 0 ? (
							<tr>
								<td
									className="py-8 text-center font-medium text-gray-500"
									colSpan={10}
								>
									No overdue records found for the selected period.
								</td>
							</tr>
						) : (
							mrGroups.map((mr, mrIdx) => {
								const mrRows = normalizedRows.filter((r) => r.mrName === mr);
								let mrTotalInv = 0;
								let mrTotalRec = 0;
								let mrTotalPending = 0;

								const cityAreas = Array.from(
									new Set(mrRows.map((r) => r.cityAreaKey)),
								).sort();

								return (
									<React.Fragment key={mrIdx}>
										{/* MR Header Row */}
										<tr className="border-b border-gray-300 bg-slate-100 font-extrabold text-sm text-[#000080]">
											<td className="py-2.5 pl-2" colSpan={10}>
												MR : {mr}
											</td>
										</tr>

										{cityAreas.map((caKey, caIdx) => {
											const caRows = mrRows.filter(
												(r) => r.cityAreaKey === caKey,
											);
											const parties = Array.from(
												new Set(caRows.map((r) => r.partyKey)),
											).sort();

											return (
												<React.Fragment key={caIdx}>
													{/* City/Area Header Row */}
													<tr className="border-b border-slate-200 bg-slate-50/90 font-bold text-slate-700">
														<td className="py-2 pl-4 italic" colSpan={10}>
															City/Area: {caKey}
														</td>
													</tr>

													{parties.map((partyKey, pIdx) => {
														const pRows = caRows.filter(
															(r) => r.partyKey === partyKey,
														);
														let partyTotalInv = 0;
														let partyTotalRec = 0;
														let partyTotalPending = 0;
														let runningCumm = 0;

														const sampleRow = pRows[0]!;
														const custBlockedInfo = customerBlockingMap.get(
															sampleRow.customer.toUpperCase(),
														);

														return (
															<React.Fragment key={pIdx}>
																{/* Party Header Row */}
																<tr className="border-b border-slate-200 bg-white font-bold text-slate-900">
																	<td className="py-2 pl-6" colSpan={8}>
																		<div className="flex items-center gap-2">
																			<span>{partyKey}</span>
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
																		</div>
																	</td>
																	<td
																		className="py-2 pr-2 text-right text-xs text-gray-500 font-normal italic"
																		colSpan={2}
																	>
																		Opening :
																	</td>
																</tr>

																{/* Invoices per Party */}
																{pRows.map((row, rIdx) => {
																	partyTotalInv += row.invoiceAmount;
																	partyTotalRec += row.receivedAmount;
																	partyTotalPending += row.pendingAmount;
																	runningCumm += row.pendingAmount;

																	// Due Days:
																	// Negative = past due date
																	// If overdue exceeds tenant's directBlockDays (e.g. DueDays <= -90), highlight in red
																	const isOverdueBlocked =
																		row.dueDays <= -directBlockDays;
																	const isWarningNearing =
																		row.dueDays < 0 &&
																		Math.abs(row.dueDays) >=
																			directBlockDays - 10 &&
																		!isOverdueBlocked;

																	return (
																		<tr
																			className={`border-b border-gray-200 transition-colors ${
																				isOverdueBlocked
																					? "bg-red-50 text-red-950 hover:bg-red-100/70"
																					: isWarningNearing
																						? "bg-amber-50/80 text-amber-950 hover:bg-amber-100/70"
																						: "text-slate-800 hover:bg-slate-50"
																			}`}
																			key={rIdx}
																		>
																			<td className="py-1.5 pl-8 font-mono">
																				{row.docType}
																			</td>
																			<td className="py-1.5 whitespace-nowrap">
																				{row.invDate}
																			</td>
																			<td className="py-1.5 font-semibold font-mono">
																				{row.invoiceNo}
																			</td>
																			<td className="py-1.5 whitespace-nowrap">
																				{row.dueDate}
																			</td>
																			<td
																				className={`py-1.5 text-right font-bold font-mono ${
																					row.dueDays < 0
																						? "text-red-700"
																						: "text-emerald-700"
																				}`}
																			>
																				{row.dueDays}
																			</td>
																			<td className="py-1.5 text-right font-mono">
																				{row.invoiceAmount.toFixed(2)}
																			</td>
																			<td className="py-1.5 text-right font-mono text-emerald-800">
																				{row.receivedAmount > 0
																					? row.receivedAmount.toFixed(2)
																					: ""}
																			</td>
																			<td className="py-1.5 text-center whitespace-nowrap text-gray-600">
																				{row.receivedDate}
																			</td>
																			<td className="py-1.5 text-right font-black font-mono text-rose-700">
																				{row.pendingAmount.toFixed(2)}
																			</td>
																			<td className="py-1.5 pr-2 text-right font-bold font-mono text-slate-700">
																				{runningCumm.toFixed(2)}
																			</td>
																		</tr>
																	);
																})}

																{/* Party Subtotal */}
																<tr className="border-b border-slate-300 bg-slate-50 font-bold text-xs text-[#0B2545]">
																	<td
																		className="py-2 pl-6 font-semibold text-gray-700"
																		colSpan={5}
																	>
																		Outstanding of {sampleRow.customer} :
																	</td>
																	<td className="py-2 text-right font-mono">
																		{partyTotalInv.toFixed(2)}
																	</td>
																	<td className="py-2 text-right font-mono text-emerald-800">
																		{partyTotalRec.toFixed(2)}
																	</td>
																	<td className="py-2" />
																	<td className="py-2 text-right font-mono font-black text-rose-700">
																		{partyTotalPending.toFixed(2)}
																	</td>
																	<td className="py-2 pr-2 text-right font-mono font-bold text-slate-900">
																		{partyTotalPending.toFixed(2)}
																	</td>
																</tr>

																{(() => {
																	mrTotalInv += partyTotalInv;
																	mrTotalRec += partyTotalRec;
																	mrTotalPending += partyTotalPending;
																	return null;
																})()}
															</React.Fragment>
														);
													})}
												</React.Fragment>
											);
										})}

										{/* MR Subtotal */}
										<tr className="border-b-2 border-slate-400 bg-slate-200/90 font-black text-xs text-[#000080]">
											<td className="py-2.5 pl-4 uppercase" colSpan={5}>
												Outstanding of {mr} :
											</td>
											<td className="py-2.5 text-right font-mono">
												{mrTotalInv.toFixed(2)}
											</td>
											<td className="py-2.5 text-right font-mono text-emerald-900">
												{mrTotalRec.toFixed(2)}
											</td>
											<td className="py-2.5" />
											<td className="py-2.5 text-right font-mono text-rose-800">
												{mrTotalPending.toFixed(2)}
											</td>
											<td className="py-2.5 pr-2 text-right font-mono text-[#000080]">
												{mrTotalPending.toFixed(2)}
											</td>
										</tr>

										{(() => {
											grandTotalInvoiceAmt += mrTotalInv;
											grandTotalReceivedAmt += mrTotalRec;
											grandTotalPendingAmt += mrTotalPending;
											return null;
										})()}
									</React.Fragment>
								);
							})
						)}

						{/* Grand Total Row */}
						{mrGroups.length > 0 && (
							<tr className="border-b-4 border-[#0B2545] bg-slate-300 font-black text-sm text-[#0B2545]">
								<td
									className="py-3 pl-2 uppercase tracking-wider"
									colSpan={5}
								>
									Grand Total :
								</td>
								<td className="py-3 text-right font-mono">
									{grandTotalInvoiceAmt.toFixed(2)}
								</td>
								<td className="py-3 text-right font-mono text-emerald-900">
									{grandTotalReceivedAmt.toFixed(2)}
								</td>
								<td className="py-3" />
								<td className="py-3 text-right font-mono font-black text-rose-900">
									{grandTotalPendingAmt.toFixed(2)}
								</td>
								<td className="py-3 pr-2 text-right font-mono font-black text-[#0B2545]">
									{grandTotalPendingAmt.toFixed(2)}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
