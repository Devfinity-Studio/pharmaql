import React from "react";
import { headers } from "next/headers";
import { OfflineReportSync } from "@/components/offline-report-sync";
import { ReportStationeryHeader } from "@/components/report-stationery-header";
import { getMRInfo, type MRAssignment } from "@/server/actions/mrInfo";
import {
	getExpiryStockStatement,
	type ExpiryStockRow,
} from "@/server/actions/expiryReports";

function formatDisplayDate(dateStr?: string | Date | null): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return String(dateStr);
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

export async function ExpiryReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		company?: string;
		to?: string;
		asOn?: string;
		q?: string;
		rateType?: "PRate" | "PTR" | "MRP";
	};
}) {
	// 1. Fetch MR Info & Tenant Limits
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo) return <div>MR not found.</div>;

	const company = searchParams?.division || searchParams?.company || "All";
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

	const asOnDateStr =
		searchParams?.asOn ||
		searchParams?.to ||
		new Date().toISOString().slice(0, 10);
	const rateType = searchParams?.rateType || "PRate";

	// 2. Execute rptExpiryStockStatement
	const procResult = await getExpiryStockStatement({
		asOnDate: asOnDateStr,
		compCode: compCodeToQuery,
		locNo: mrInfo.locNo,
		rateType,
	});

	let rowsToProcess = procResult.success && procResult.data ? procResult.data : [];

	if (company !== "All") {
		const sel = company.trim().toUpperCase();
		rowsToProcess = rowsToProcess.filter((r) => {
			const rowDiv = (r.Division || "").toString().trim().toUpperCase();
			const rowMkt = (r.MktBy || "").toString().trim().toUpperCase();
			return (
				rowDiv === sel ||
				rowDiv.includes(sel) ||
				sel.includes(rowDiv) ||
				rowMkt === sel ||
				rowMkt.includes(sel) ||
				sel.includes(rowMkt)
			);
		});
	}

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase().trim();
		rowsToProcess = rowsToProcess.filter(
			(r) =>
				(r.ItemName && r.ItemName.toLowerCase().includes(q)) ||
				(r.ItemCode && r.ItemCode.toLowerCase().includes(q)) ||
				(r.BatchNo && r.BatchNo.toLowerCase().includes(q)),
		);
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	interface NormalizedExpiryRow {
		id: number;
		company: string;
		division: string;
		companyDivKey: string;
		itemCode: string;
		itemName: string;
		packing: string;
		batchNo: string;
		godown: string;
		expDate: string;
		daysToExpiry: number;
		qty: number;
		pRate: number;
		ptr: number;
		mrp: number;
		rate: number;
		stockValue: number;
		urgency: "EXPIRED" | "CRITICAL" | "WARNING" | "NORMAL";
	}

	const normalizedRows: NormalizedExpiryRow[] = rowsToProcess.map((r) => {
		const qty = Number(r.Qty || 0);
		const pRate = Number(r.PRate || 0);
		const ptr = Number(r.PTR || 0);
		const mrp = Number(r.MRP || 0);
		const rate = Number(r.Rate || pRate);
		const stockValue = Number((qty * rate).toFixed(2));

		const expDateObj = r.ExpDt ? new Date(r.ExpDt) : null;
		let daysToExpiry = 0;
		if (expDateObj && !isNaN(expDateObj.getTime())) {
			const diffTime = expDateObj.getTime() - today.getTime();
			daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		}

		let urgency: "EXPIRED" | "CRITICAL" | "WARNING" | "NORMAL" = "NORMAL";
		if (daysToExpiry <= 0) {
			urgency = "EXPIRED";
		} else if (daysToExpiry <= 30) {
			urgency = "CRITICAL";
		} else if (daysToExpiry <= 90) {
			urgency = "WARNING";
		}

		const comp = (r.MktBy || mrInfo.company || "General").trim();
		const div = (r.Division || "General").trim();

		return {
			id: r.ID,
			company: comp,
			division: div,
			companyDivKey: `${comp} - ${div}`.toUpperCase(),
			itemCode: r.ItemCode || "",
			itemName: r.ItemName || "Unknown",
			packing: r.Packing || "",
			batchNo: r.BatchNo || "",
			godown: String(r.Godown ?? ""),
			expDate: formatDisplayDate(r.ExpDt) || "N/A",
			daysToExpiry,
			qty,
			pRate,
			ptr,
			mrp,
			rate,
			stockValue,
			urgency,
		};
	});

	// Grouping by Company/Division
	const groupKeys = Array.from(new Set(normalizedRows.map((r) => r.companyDivKey))).sort();

	let grandTotalQty = 0;
	let grandTotalValue = 0;

	const asOnDisplay = formatDisplayDate(asOnDateStr) || formatDisplayDate(new Date());

	return (
		<div className="mt-4 space-y-8 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
			<OfflineReportSync
				data={normalizedRows}
				mrId={mrId}
				params={searchParams}
				tab="expiry"
			/>
			{/* Official Stationery Header */}
			<ReportStationeryHeader
				asOnDate={asOnDisplay}
				summaryRight={`Total Records: ${normalizedRows.length}`}
				title="Expiry Stock Statement"
			/>

			<div className="flex flex-wrap items-center justify-between border-b border-gray-200 pb-3 text-xs text-gray-500">
				<div>
					<span className="font-semibold text-gray-700">AsOn Date (Cutoff):</span> {asOnDisplay}
				</div>
				<div>
					<span className="font-semibold text-gray-700">Valuation:</span>{" "}
					{rateType === "MRP" ? "MRP" : rateType === "PTR" ? "PTR" : "Purchase Rate (PRate)"}
				</div>
				<div>
					<span className="font-semibold text-gray-700">Year:</span> 2026-27
				</div>
			</div>

			<div className="w-full overflow-x-auto border-t-2 border-[#0B2545] pt-1">
				<table className="w-full min-w-[1050px] border-collapse text-left font-sans text-xs">
					<thead>
						<tr className="border-y-2 border-[#0B2545] bg-gray-50/80 font-bold text-[#0B2545]">
							<th className="py-2.5 pl-2">Item Code</th>
							<th className="py-2.5">Product Name</th>
							<th className="py-2.5">Packing</th>
							<th className="py-2.5">Batch No.</th>
							<th className="py-2.5">Godown</th>
							<th className="py-2.5">Exp. Date</th>
							<th className="py-2.5 text-center">Status</th>
							<th className="py-2.5 text-right font-black">Stock Qty</th>
							<th className="py-2.5 text-right">PRate</th>
							<th className="py-2.5 text-right">PTR</th>
							<th className="py-2.5 text-right">MRP</th>
							<th className="py-2.5 pr-2 text-right font-black">Stock Value</th>
						</tr>
					</thead>
					<tbody className="font-medium text-slate-800">
						{groupKeys.length === 0 ? (
							<tr>
								<td
									className="py-8 text-center font-medium text-gray-500"
									colSpan={12}
								>
									No expiry stock records found on or before {asOnDisplay}.
								</td>
							</tr>
						) : (
							groupKeys.map((groupKey, gIdx) => {
								const gRows = normalizedRows.filter((r) => r.companyDivKey === groupKey);
								let groupTotalQty = 0;
								let groupTotalValue = 0;

								return (
									<React.Fragment key={gIdx}>
										{/* Company/Division Header Row */}
										<tr className="border-b border-gray-300 bg-slate-100 font-extrabold text-sm text-[#000080]">
											<td className="py-2.5 pl-2" colSpan={12}>
												Company : {groupKey}
											</td>
										</tr>

										{gRows.map((row, rIdx) => {
											groupTotalQty += row.qty;
											groupTotalValue += row.stockValue;

											return (
												<tr
													className={`border-b border-gray-200 transition-colors ${
														row.urgency === "EXPIRED"
															? "bg-rose-50/70 hover:bg-rose-100/70 text-rose-950"
															: row.urgency === "CRITICAL"
																? "bg-amber-50/80 hover:bg-amber-100/70 text-amber-950"
																: "text-slate-800 hover:bg-slate-50"
													}`}
													key={rIdx}
												>
													<td className="py-2 pl-2 font-mono text-slate-700">
														{row.itemCode}
													</td>
													<td className="py-2 font-bold text-slate-900">
														{row.itemName}
													</td>
													<td className="py-2 text-slate-600">
														{row.packing}
													</td>
													<td className="py-2 font-mono font-semibold text-slate-900">
														{row.batchNo}
													</td>
													<td className="py-2 text-slate-600">
														{row.godown}
													</td>
													<td className="py-2 whitespace-nowrap font-mono font-bold text-slate-900">
														{row.expDate}
													</td>
													<td className="py-2 text-center">
														{row.urgency === "EXPIRED" ? (
															<span className="inline-block rounded bg-red-100 px-2 py-0.5 font-black text-[10px] text-red-800 tracking-wider">
																EXPIRED
															</span>
														) : row.urgency === "CRITICAL" ? (
															<span className="inline-block rounded bg-amber-100 px-2 py-0.5 font-bold text-[10px] text-amber-800 tracking-wider">
																&lt;30 DAYS
															</span>
														) : row.urgency === "WARNING" ? (
															<span className="inline-block rounded bg-yellow-100 px-2 py-0.5 font-bold text-[10px] text-yellow-800 tracking-wider">
																&lt;90 DAYS
															</span>
														) : (
															<span className="inline-block rounded bg-emerald-100 px-2 py-0.5 font-medium text-[10px] text-emerald-800 tracking-wider">
																NORMAL
															</span>
														)}
													</td>
													<td className="py-2 text-right font-mono font-bold text-slate-900">
														{row.qty.toLocaleString()}
													</td>
													<td className="py-2 text-right font-mono text-slate-700">
														{row.pRate.toFixed(2)}
													</td>
													<td className="py-2 text-right font-mono text-slate-700">
														{row.ptr.toFixed(2)}
													</td>
													<td className="py-2 text-right font-mono text-slate-700">
														{row.mrp.toFixed(2)}
													</td>
													<td className="py-2 pr-2 text-right font-mono font-black text-rose-700">
														{row.stockValue.toFixed(2)}
													</td>
												</tr>
											);
										})}

										{/* Division Subtotal Row */}
										<tr className="border-b-2 border-slate-400 bg-slate-200/90 font-black text-xs text-[#000080]">
											<td className="py-2.5 pl-4 uppercase" colSpan={7}>
												Total for {groupKey} :
											</td>
											<td className="py-2.5 text-right font-mono font-black">
												{groupTotalQty.toLocaleString()}
											</td>
											<td className="py-2.5" colSpan={3} />
											<td className="py-2.5 pr-2 text-right font-mono font-black text-[#000080]">
												{groupTotalValue.toFixed(2)}
											</td>
										</tr>

										{(() => {
											grandTotalQty += groupTotalQty;
											grandTotalValue += groupTotalValue;
											return null;
										})()}
									</React.Fragment>
								);
							})
						)}

						{/* Grand Total Row */}
						{groupKeys.length > 0 && (
							<tr className="border-b-4 border-[#0B2545] bg-slate-300 font-black text-sm text-[#0B2545]">
								<td
									className="py-3 pl-2 uppercase tracking-wider"
									colSpan={7}
								>
									Grand Total :
								</td>
								<td className="py-3 text-right font-mono font-black">
									{grandTotalQty.toLocaleString()}
								</td>
								<td className="py-3" colSpan={3} />
								<td className="py-3 pr-2 text-right font-mono font-black text-[#0B2545]">
									{grandTotalValue.toFixed(2)}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
