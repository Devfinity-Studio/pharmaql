import React from "react";
import { ReportStationeryHeader } from "@/components/report-stationery-header";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getStockMovement,
	type StockMovementRow,
} from "@/server/actions/stockreports";

interface StockReportItem {
	ItemId: number;
	Manufacturer: string;
	Division: string;
	"Item Name": string;
	Packing: string;
	"Purc Days": number;
	"Is Dead Stock": boolean;
	"Opening Qty.": number;
	"Purchase Qty": number;
	"S.Ret Qty.": number;
	"Stk Adj Add": number;
	"Total In Qty": number;
	"Sales Qty.": number;
	"P.Ret Qty.": number;
	"Stk Adj Less": number;
	"Balance Qty.": number;
	"Stock Value": number;
	"Opening Value": number;
	"Purchase Value": number;
	"Sales Value": number;
	prate: number;
	ptr: number;
}

export async function StockReportView({
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
	// Fetch MR Info & permissions from legacy schema
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo?.canViewStock) return <div>No access to stock data.</div>;

	const effectiveLocNo = mrInfo.locNo || "11";
	const company = searchParams?.division || "All";

	const assignments = mrInfo.company
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

	if (assignments.length === 0) return <div>No data assigned</div>;

	const selectedAssignments =
		company === "All"
			? assignments
			: assignments.filter((a) => (a.division || a.manufacturer) === company);

	if (selectedAssignments.length === 0) return <div>No data assigned</div>;

	const targetCompanies = Array.from(
		new Set(selectedAssignments.map((a) => a.manufacturer).filter(Boolean)),
	) as string[];

	if (targetCompanies.length === 0) return <div>No data assigned</div>;

	const finYearStart = "2026-04-01";
	const fromDate = searchParams?.from || finYearStart;
	const toDate = searchParams?.to || new Date().toISOString().slice(0, 10);

	const response = await getStockMovement(
		targetCompanies,
		fromDate,
		toDate,
		effectiveLocNo,
	);

	if (!response.success || !response.data) {
		return (
			<div className="mt-4 space-y-4">
				<div className="p-4 font-semibold text-red-500">
					Failed to load stock report: {response.error || "Unknown error"}
				</div>
			</div>
		);
	}

	// Filter rows by assigned divisions/companies
	const matchingRows = response.data.filter((row: StockMovementRow) => {
		return selectedAssignments.some((a) => {
			const mfgName = a.manufacturer?.trim().toUpperCase();
			const mfgFirstWord = mfgName ? mfgName.split(/\s+/)[0] : "";
			const divName = a.division?.trim().toUpperCase();
			const divFirstWord = divName ? divName.split(/\s+/)[0] : "";
			const rowMake = (row.Make || "").toString().trim().toUpperCase();
			const rowDiv = (row.Division || "").toString().trim().toUpperCase();

			const matchesMfg =
				!mfgName ||
				rowMake === mfgName ||
				rowMake.includes(mfgName) ||
				mfgName.includes(rowMake) ||
				Boolean(mfgFirstWord && rowMake.includes(mfgFirstWord)) ||
				(a.company && rowMake === a.company.trim().toUpperCase());

			const matchesDiv =
				!divName ||
				divName === mfgName ||
				rowDiv === divName ||
				rowDiv.includes(divName) ||
				divName.includes(rowDiv) ||
				Boolean(divFirstWord && rowDiv.includes(divFirstWord));

			return matchesMfg && matchesDiv;
		});
	});

	const reportData: StockReportItem[] = [];

	for (const row of matchingRows) {
		const opening = Number(row.Opening || 0);
		const purchase = Number(row.Purchase || 0);
		const sRet = Number(row.SReturn || 0);
		const stkAdjAdd = Number(row.StkAdjAdd || 0);
		const salesQty = Number(row.SalesQty || 0);
		const pRet = Number(row.PReturn || 0);
		const stkAdjLess = Number(row.StkAdjLess || 0);
		const currQty = Number(row.Qty || 0);
		const prate = Number(row.Prate || 0);
		const ptr = Number(row.PTR || 0);
		const purcDays = Number(row.Days || 0);

		if (
			opening !== 0 ||
			purchase !== 0 ||
			currQty !== 0 ||
			salesQty !== 0 ||
			sRet !== 0 ||
			stkAdjAdd !== 0 ||
			stkAdjLess !== 0 ||
			pRet !== 0
		) {
			const totalIn = opening + purchase + sRet + stkAdjAdd;
			const stockValue = currQty * prate;
			const openingValue = opening * prate;
			const purchaseValue = purchase * prate;
			const salesValue = salesQty * prate;
			const isDeadStock = purcDays > 90 && salesQty === 0;

			reportData.push({
				ItemId: row.ItemId,
				Manufacturer: row.Make || "",
				Division: (row.Division || row.Make || "General").toString().trim(),
				"Item Name": row.ItemName || "",
				Packing: row.Packing || "-",
				"Purc Days": purcDays,
				"Is Dead Stock": isDeadStock,
				"Opening Qty.": opening,
				"Purchase Qty": purchase,
				"S.Ret Qty.": sRet,
				"Stk Adj Add": stkAdjAdd,
				"Total In Qty": totalIn,
				"Sales Qty.": salesQty,
				"P.Ret Qty.": pRet,
				"Stk Adj Less": stkAdjLess,
				"Balance Qty.": currQty,
				"Stock Value": stockValue,
				"Opening Value": openingValue,
				"Purchase Value": purchaseValue,
				"Sales Value": salesValue,
				prate,
				ptr,
			});
		}
	}

	reportData.sort((a, b) => a["Item Name"].localeCompare(b["Item Name"]));

	// Grouping by Division
	const divisions = [...new Set(reportData.map((d) => d.Division))].sort();
	let grandTotalOpeningValue = 0;
	let grandTotalPurchaseValue = 0;
	let grandTotalSalesValue = 0;
	let grandTotalStockValue = 0;

	return (
		<div className="mt-4 space-y-8 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{/* Official Stationery Header */}
			<ReportStationeryHeader
				title="Stock Movement Statement"
				fromDisplay={fromDate ? fromDate.split("-").reverse().join("/") : undefined}
				toDisplay={toDate ? toDate.split("-").reverse().join("/") : undefined}
				summaryRight={
					<div className="flex flex-col items-end gap-0.5 text-right">
						<span>Total Items: {reportData.length}</span>
						<span className="font-semibold text-gray-500 text-[10px]">Value Calc. on: PRate</span>
					</div>
				}
			/>

			<div className="w-full overflow-x-auto border-[#0B2545] border-t-2 pt-1">
				<table className="w-full min-w-[1200px] border-collapse text-left font-sans">
					<thead>
						<tr className="border-[#0B2545] border-y-2">
							<th className="w-64 py-2 font-bold text-[#0B2545] text-sm">
								Item Name
							</th>
							<th className="py-2 text-center font-bold text-[#0B2545] text-sm">
								Packing
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Purc
								<br />
								Days
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Opening
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Purchase
								<br />
								Qty
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								S.Ret
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Stk Adj
								<br />
								Add
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Total
								<br />
								In Qty
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Sales
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								P.Ret
								<br />
								Qty.
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Stk Adj
								<br />
								Less
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Balance
								<br />
								Qty.
							</th>
							<th className="py-2 pr-2 text-right font-bold text-[#0B2545] text-sm">
								Stock
								<br />
								Value
							</th>
						</tr>
					</thead>
					<tbody className="font-medium text-sm">
						{divisions.map((div) => {
							const divData = reportData.filter((d) => d.Division === div);
							let divOpeningValue = 0;
							let divPurchaseValue = 0;
							let divSalesValue = 0;
							let divStockValue = 0;

							return (
								<React.Fragment key={div}>
									{/* Company/Division Header Row */}
									<tr>
										<td
											className="border-gray-200 border-b bg-gray-50/50 px-2 py-2 font-bold text-[#000080]"
											colSpan={13}
										>
											Division : {div.toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{divData.map((row) => {
										divOpeningValue += row["Opening Value"];
										divPurchaseValue += row["Purchase Value"];
										divSalesValue += row["Sales Value"];
										divStockValue += row["Stock Value"];

										return (
											<tr
												className={`border-gray-100 border-b ${
													row["Is Dead Stock"]
														? "bg-red-50 font-bold text-red-900 hover:bg-red-100"
														: "text-[#0B2545] hover:bg-gray-50"
												}`}
												key={`${div}-${row.ItemId}`}
												title={
													row["Is Dead Stock"]
														? "Dead Stock: Purchased >90 days ago with 0 sales."
														: ""
												}
											>
												<td className="whitespace-nowrap py-1.5 pl-2">
													{row["Item Name"]}
												</td>
												<td className="py-1.5 text-center text-gray-500">
													{row["Packing"] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Purc Days"]}
												</td>
												<td className="py-1.5 text-right">
													{row["Opening Qty."] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Purchase Qty"] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["S.Ret Qty."] !== 0 ? row["S.Ret Qty."] : "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Stk Adj Add"] !== 0 ? row["Stk Adj Add"] : "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Total In Qty"] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Sales Qty."] || "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["P.Ret Qty."] !== 0 ? row["P.Ret Qty."] : "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Stk Adj Less"] !== 0
														? row["Stk Adj Less"]
														: "-"}
												</td>
												<td className="py-1.5 text-right">
													{row["Balance Qty."] || "-"}
												</td>
												<td className="py-1.5 pr-2 text-right">
													{row["Stock Value"]
														? row["Stock Value"].toFixed(2)
														: "0.00"}
												</td>
											</tr>
										);
									})}
									{/* Division Total */}
									{(() => {
										grandTotalOpeningValue += divOpeningValue;
										grandTotalPurchaseValue += divPurchaseValue;
										grandTotalSalesValue += divSalesValue;
										grandTotalStockValue += divStockValue;
										return (
											<tr className="border-gray-300 border-y bg-gray-50/50 font-bold text-[#0B2545]">
												<td className="py-2 pl-2" colSpan={3}>
													Total value of {div.toUpperCase()} :
												</td>
												<td className="py-2 text-right">
													{divOpeningValue.toFixed(2)}
												</td>
												<td className="py-2 text-right">
													{divPurchaseValue.toFixed(2)}
												</td>
												<td colSpan={3}></td>
												<td className="py-2 text-right">
													{divSalesValue.toFixed(2)}
												</td>
												<td colSpan={3}></td>
												<td className="py-2 pr-2 text-right">
													{divStockValue.toFixed(2)}
												</td>
											</tr>
										);
									})()}
								</React.Fragment>
							);
						})}
						{/* Division Summaries Before Grand Total */}
						{divisions.length > 1 && reportData.length > 0 && (
							<>
								<tr>
									<td className="py-4" colSpan={13}></td>
								</tr>
								{divisions.map((div) => {
									const divData = reportData.filter((d) => d.Division === div);
									let summaryOpening = 0;
									let summaryPurchase = 0;
									let summarySales = 0;
									let summaryStock = 0;
									divData.forEach((row) => {
										summaryOpening += row["Opening Value"];
										summaryPurchase += row["Purchase Value"];
										summarySales += row["Sales Value"];
										summaryStock += row["Stock Value"];
									});
									return (
										<tr
											className="border-gray-300 border-y-2 bg-[#f0f4f8] font-bold text-[#0B2545] text-sm"
											key={`summary-${div}`}
										>
											<td className="py-2 pl-2" colSpan={3}>
												Total value of {div.toUpperCase()} :
											</td>
											<td className="py-2 text-right">
												{summaryOpening.toFixed(2)}
											</td>
											<td className="py-2 text-right">
												{summaryPurchase.toFixed(2)}
											</td>
											<td colSpan={3}></td>
											<td className="py-2 text-right">
												{summarySales.toFixed(2)}
											</td>
											<td colSpan={3}></td>
											<td className="py-2 pr-2 text-right text-[#0056b3]">
												{summaryStock.toFixed(2)}
											</td>
										</tr>
									);
								})}
							</>
						)}

						{/* Grand Total */}
						<tr className="border-[#0B2545] border-b-4 bg-gray-100 font-extrabold text-[#0B2545] text-base">
							<td className="py-3 pl-2" colSpan={3}>
								Total Value :
							</td>
							<td className="py-3 text-right">
								{grandTotalOpeningValue.toFixed(2)}
							</td>
							<td className="py-3 text-right">
								{grandTotalPurchaseValue.toFixed(2)}
							</td>
							<td colSpan={3}></td>
							<td className="py-3 text-right">
								{grandTotalSalesValue.toFixed(2)}
							</td>
							<td colSpan={3}></td>
							<td className="py-3 pr-2 text-right">
								{grandTotalStockValue.toFixed(2)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
