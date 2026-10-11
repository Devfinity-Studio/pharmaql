import Image from "next/image";
import React from "react";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getPartyCustomerItemSale,
	type PartyCustomerItemSaleResult,
	type PartyCustomerItemSaleRow,
} from "@/server/actions/partyItemSale";

function formatDisplayDate(val?: string | Date | null): string {
	if (!val) return "";
	if (typeof val === "string") {
		const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (match) return `${match[3]}/${match[2]}/${match[1]}`;
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return String(val);
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

function formatExpDate(val?: string | Date | null): string {
	if (!val) return "";
	if (typeof val === "string") {
		const match = val.match(/\d{4}-\d{2}(-\d{2})?/);
		if (match) return match[0];
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return String(val);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

interface CustomerGroup {
	custId: number;
	custCode: string;
	customer: string;
	address: string;
	area: string;
	city: string;
	rows: PartyCustomerItemSaleRow[];
	totalQty: number;
	totalFree: number;
	totalAmount: number;
}

export async function PartyReportView({
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
	};
}) {
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo || !mrInfo.canViewPartyWise) {
		return <div>No access to party wise data.</div>;
	}

	const company = searchParams?.division || "All";
	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || ""
			: mrInfo.companyCode && (mrInfo.company === company || mrInfo.division === company)
				? mrInfo.companyCode
				: company;

	const partySalesResult: PartyCustomerItemSaleResult =
		mrInfo.canViewSales && searchParams?.from && searchParams?.to
			? await getPartyCustomerItemSale({
					fromDate: searchParams.from,
					toDate: searchParams.to,
					compCode: compCodeToQuery,
					locNo: mrInfo.locNo,
				})
			: {
					success: false,
					error: !mrInfo.canViewSales
						? "MR does not have sales view permissions"
						: "Missing 'from' or 'to' date parameters in URL",
					data: null,
					debugSql: undefined,
				};

	const fromDisplay = formatDisplayDate(searchParams?.from) || "01/09/2026";
	const toDisplay = formatDisplayDate(searchParams?.to) || "29/09/2026";

	if (partySalesResult.success && partySalesResult.data && partySalesResult.data.length > 0) {
		let rowsToProcess = partySalesResult.data;

		if (searchParams?.party) {
			const filterParty = searchParams.party.toLowerCase();
			rowsToProcess = rowsToProcess.filter(
				(r) => r.Customer && r.Customer.toLowerCase().includes(filterParty),
			);
		}

		if (searchParams?.q) {
			const q = searchParams.q.toLowerCase();
			rowsToProcess = rowsToProcess.filter(
				(r) =>
					(r.Customer && r.Customer.toLowerCase().includes(q)) ||
					(r.ItemName && r.ItemName.toLowerCase().includes(q)) ||
					(r.ItemCode && r.ItemCode.toLowerCase().includes(q)) ||
					(r.City && r.City.toLowerCase().includes(q)) ||
					(r.InvNo && r.InvNo.toLowerCase().includes(q)),
			);
		}

		// Group rows by Customer
		const customerMap = new Map<string, CustomerGroup>();

		for (const row of rowsToProcess) {
			const key = `${row.CustID}_${row.Customer}`;
			let group = customerMap.get(key);
			if (!group) {
				group = {
					custId: row.CustID,
					custCode: row.CustCode || "",
					customer: row.Customer || "Unknown Customer",
					address: row.Address || "",
					area: row.Area || "",
					city: row.City || "",
					rows: [],
					totalQty: 0,
					totalFree: 0,
					totalAmount: 0,
				};
				customerMap.set(key, group);
			}

			group.rows.push(row);
			group.totalQty += Number(row.Qty || 0);
			group.totalFree += Number(row.FQty || 0);
			group.totalAmount += Number(row.Amt || 0);
		}

		const customerGroups = Array.from(customerMap.values());

		// Grand totals
		let grandQty = 0;
		let grandFree = 0;
		let grandAmount = 0;

		for (const g of customerGroups) {
			grandQty += g.totalQty;
			grandFree += g.totalFree;
			grandAmount += g.totalAmount;
		}

		return (
			<div className="mt-4 space-y-4 rounded-xl border border-gray-300 bg-white p-6 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none font-sans text-gray-900">
				{/* REPORT HEADER */}
				<div className="border-b-2 border-gray-900 pb-2">
					<div className="flex flex-col md:flex-row items-start justify-between gap-3">
						<div className="flex items-start gap-4">
							<Image
								src="/logo.png"
								alt="Asmee Pharma Logo"
								width={140}
								height={45}
								className="object-contain pt-0.5"
								priority
							/>
							<div>
								<h1 className="font-extrabold text-base tracking-tight text-gray-900 uppercase">
									ASMEE PHARMA PRIVATE LIMITED
								</h1>
								<p className="mt-0.5 text-[11px] leading-tight text-gray-700">
									BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,
									<br />
									RAOPURA, VADODARA - 390001, GUJARAT - 24
									<br />
									Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
								</p>
							</div>
						</div>
					</div>

					<div className="mt-3 flex items-center justify-between border-t border-gray-300 pt-1.5 text-xs font-bold text-gray-900">
						<div>Year : 2026-27</div>
						<div className="text-center font-extrabold text-xs text-[#0B2545]">
							Partywise/Itemwise Sales for Period of {fromDisplay} to {toDisplay}
						</div>
						<div className="text-right text-[11px] font-medium text-gray-600">
							Total Parties: {customerGroups.length}
						</div>
					</div>
				</div>

				{/* REPORT DATA TABLE */}
				<div className="w-full overflow-x-auto">
					<table className="w-full min-w-[1100px] border-collapse text-left font-sans text-[11px] leading-tight">
						<thead>
							<tr className="border-y-2 border-gray-900 bg-gray-50 text-[11px] font-bold text-gray-900">
								<th className="py-1 px-1 text-center w-[35px]">SNo.</th>
								<th className="py-1 px-1.5 w-[70px]">InvNo</th>
								<th className="py-1 px-1.5 w-[75px]">InvDt</th>
								<th className="py-1 px-1.5 w-[80px]">ItemCode</th>
								<th className="py-1 px-2 w-[220px]">Item Name</th>
								<th className="py-1 px-1.5 w-[65px]">Packing</th>
								<th className="py-1 px-1.5 w-[75px]">BatchNo</th>
								<th className="py-1 px-1.5 w-[75px]">Exp.</th>
								<th className="py-1 px-1.5 text-right w-[45px]">Qty.</th>
								<th className="py-1 px-1 text-right w-[40px]">Free</th>
								<th className="py-1 px-1.5 text-right w-[55px]">Rate</th>
								<th className="py-1 px-2 text-right w-[75px]">Amount</th>
								<th className="py-1 px-2 w-[85px]">Series</th>
								<th className="py-1 px-1.5 w-[70px]">Remarks</th>
							</tr>
						</thead>
						<tbody>
							{customerGroups.map((group, cIdx) => (
								<React.Fragment key={`cust-${cIdx}-${group.custId}`}>
									{/* Customer Party Header Banner */}
									<tr className="border-y border-[#b8d7f5] bg-[#eef6fc]">
										<td
											colSpan={14}
											className="py-1 px-2 font-bold text-[#002b66] text-xs"
										>
											{group.customer}{" "}
											{group.custCode ? `[ ${group.custCode} ]` : ""}{" "}
											{group.area ? `- ${group.area}` : ""}{" "}
											{group.city ? `, ${group.city}` : ""}
										</td>
									</tr>

									{/* Item Rows for this Party */}
									{group.rows.map((row, rIdx) => (
										<tr
											key={`party-row-${rIdx}-${row.InvNo}`}
											className="border-b border-gray-100 hover:bg-gray-50/80 text-[11px] text-gray-800"
										>
											<td className="py-0.5 px-1 text-center text-gray-600">
												{rIdx + 1}
											</td>
											<td className="py-0.5 px-1.5 font-medium whitespace-nowrap">
												{row.InvNo}
											</td>
											<td className="py-0.5 px-1.5 whitespace-nowrap">
												{formatDisplayDate(row.InvDt)}
											</td>
											<td className="py-0.5 px-1.5 font-mono text-[10px] text-gray-700">
												{row.ItemCode}
											</td>
											<td className="py-0.5 px-2 font-medium leading-tight">
												{row.ItemName}
											</td>
											<td className="py-0.5 px-1.5 text-gray-600">
												{row.Packing}
											</td>
											<td className="py-0.5 px-1.5 whitespace-nowrap">
												{row.BatchNo}
											</td>
											<td className="py-0.5 px-1.5 whitespace-nowrap">
												{formatExpDate(row.ExpDt)}
											</td>
											<td className="py-0.5 px-1.5 text-right font-semibold">
												{row.Qty}
											</td>
											<td className="py-0.5 px-1 text-right text-gray-600">
												{row.FQty ? row.FQty : ""}
											</td>
											<td className="py-0.5 px-1.5 text-right">
												{Number(row.Srate || 0).toFixed(2)}
											</td>
											<td className="py-0.5 px-2 text-right font-medium">
												{Number(row.Amt || 0).toFixed(2)}
											</td>
											<td className="py-0.5 px-2 text-gray-700 whitespace-nowrap">
												{row.Series || ""}
											</td>
											<td className="py-0.5 px-1.5 text-gray-600 truncate max-w-[70px]">
												{row.Remarks || ""}
											</td>
										</tr>
									))}

									{/* Subtotal for this Party */}
									<tr className="border-y border-gray-400 bg-gray-50/50 text-[11px] font-bold text-gray-900">
										<td colSpan={8} className="py-1 px-2 text-left">
											Total for {group.customer}
										</td>
										<td className="py-1 px-1.5 text-right text-blue-800">
											{group.totalQty}
										</td>
										<td className="py-1 px-1 text-right">
											{group.totalFree || ""}
										</td>
										<td></td>
										<td className="py-1 px-2 text-right text-blue-800">
											{group.totalAmount.toFixed(2)}
										</td>
										<td colSpan={2}></td>
									</tr>
								</React.Fragment>
							))}

							{/* REPORT GRAND TOTALS */}
							<tr className="border-t-2 border-b-2 border-gray-900 bg-gray-100 font-extrabold text-xs text-gray-900">
								<td colSpan={8} className="py-2.5 px-2 text-left">
									Grand Total Sales :
								</td>
								<td className="py-2.5 px-1.5 text-right text-blue-800">
									{grandQty}
								</td>
								<td className="py-2.5 px-1 text-right">
									{grandFree || ""}
								</td>
								<td></td>
								<td className="py-2.5 px-2 text-right text-blue-800">
									{grandAmount.toFixed(2)}
								</td>
								<td colSpan={2}></td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		);
	}

	return (
		<div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div className="border-b-2 border-gray-900 pb-2">
				<div className="flex items-start gap-4">
					<Image
						src="/logo.png"
						alt="Asmee Pharma Logo"
						width={140}
						height={45}
						className="object-contain"
						priority
					/>
					<div>
						<h2 className="font-extrabold text-base tracking-tight text-gray-900 uppercase">
							ASMEE PHARMA PRIVATE LIMITED
						</h2>
						<p className="mt-0.5 text-[11px] leading-tight text-gray-700">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,
							<br />
							RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br />
							Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
						</p>
					</div>
				</div>

				<div className="mt-3 flex items-center justify-between border-t border-gray-300 pt-1.5 text-xs font-bold text-gray-900">
					<div>Year : 2026-27</div>
					<div className="text-center font-extrabold text-xs text-[#0B2545]">
						Partywise/Itemwise Sales for Period of {fromDisplay} to {toDisplay}
					</div>
					<div>No records found</div>
				</div>
			</div>

			<div className="py-12 text-center text-gray-500 font-medium text-sm">
				No party sales records found for the selected period and division.
			</div>
		</div>
	);
}
