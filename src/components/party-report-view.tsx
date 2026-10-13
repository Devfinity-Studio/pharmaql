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
		debug?: string;
	};
}) {
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo || !mrInfo.canViewPartyWise) {
		return <div>No access to party wise data.</div>;
	}

	const company = searchParams?.division || "All";
	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || mrInfo.company || ""
			: mrInfo.companyCode &&
				(mrInfo.company === company || mrInfo.division === company)
				? mrInfo.companyCode
				: company;

	const defaultFrom = searchParams?.from || "2026-04-01";
	const defaultTo = searchParams?.to || "2026-09-30";

	const partySalesResult: PartyCustomerItemSaleResult = mrInfo.canViewSales
		? await getPartyCustomerItemSale({
			fromDate: defaultFrom,
			toDate: defaultTo,
			compCode: compCodeToQuery,
			locNo: mrInfo.locNo,
		})
		: {
			success: false,
			error: "MR does not have sales view permissions",
			data: null,
			debugSql: undefined,
		};

	const fromDisplay = formatDisplayDate(defaultFrom);
	const toDisplay = formatDisplayDate(defaultTo);

	if (
		partySalesResult.success &&
		partySalesResult.data &&
		partySalesResult.data.length > 0
	) {
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
			<div className="mt-4 space-y-4 rounded-xl border border-gray-300 bg-white p-6 font-sans text-gray-900 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none">
				{/* REPORT HEADER */}
				<div className="border-gray-900 border-b-2 pb-2">
					<div className="flex flex-col items-start justify-between gap-3 md:flex-row">
						<div className="flex items-start gap-4">
							<Image
								alt="Asmee Pharma Logo"
								className="object-contain pt-0.5"
								height={45}
								priority
								src="/logo.png"
								width={140}
							/>
							<div>
								<h1 className="font-extrabold text-base text-gray-900 uppercase tracking-tight">
									ASMEE PHARMA PRIVATE LIMITED
								</h1>
								<p className="mt-0.5 text-[11px] text-gray-700 leading-tight">
									BASEMENT-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,,
									PRATAP ROAD,
									<br />
									RAOPURA, VADODARA - 390001, GUJARAT - 24
									<br />
									Contact: 9409789800, 9409789700 Mobile: 9409789700 Email:
									asmeepharma2022@gmail.com
								</p>
							</div>
						</div>
					</div>

					<div className="mt-3 flex items-center justify-between border-gray-300 border-t pt-1.5 font-bold text-gray-900 text-xs">
						<div>Year : 2026-27</div>
						<div className="text-center font-extrabold text-[#0B2545] text-xs">
							Partywise/Itemwise Sales for Period of {fromDisplay} to{" "}
							{toDisplay}
						</div>
						<div className="text-right font-medium text-[11px] text-gray-600">
							Total Parties: {customerGroups.length}
						</div>
					</div>
				</div>

				{/* REPORT DATA TABLE */}
				<div className="w-full overflow-x-auto">
					<table className="w-full min-w-[1100px] border-collapse text-left font-sans text-[11px] leading-tight">
						<thead>
							<tr className="border-gray-900 border-y-2 bg-gray-50 font-bold text-[11px] text-gray-900">
								<th className="w-[35px] px-1 py-1 text-center">SNo.</th>
								<th className="w-[70px] px-1.5 py-1">InvNo</th>
								<th className="w-[75px] px-1.5 py-1">InvDt</th>
								<th className="w-[80px] px-1.5 py-1">ItemCode</th>
								<th className="w-[220px] px-2 py-1">Item Name</th>
								<th className="w-[65px] px-1.5 py-1">Packing</th>
								<th className="w-[75px] px-1.5 py-1">BatchNo</th>
								<th className="w-[75px] px-1.5 py-1">Exp.</th>
								<th className="w-[45px] px-1.5 py-1 text-right">Qty.</th>
								<th className="w-[40px] px-1 py-1 text-right">Free</th>
								<th className="w-[55px] px-1.5 py-1 text-right">Rate</th>
								<th className="w-[75px] px-2 py-1 text-right">Amount</th>
								<th className="w-[85px] px-2 py-1">Series</th>
								<th className="w-[70px] px-1.5 py-1">Remarks</th>
							</tr>
						</thead>
						<tbody>
							{customerGroups.map((group, cIdx) => (
								<React.Fragment key={`cust-${cIdx}-${group.custId}`}>
									{/* Customer Party Header Banner */}
									<tr className="border-[#b8d7f5] border-y bg-[#eef6fc]">
										<td
											className="px-2 py-1 font-bold text-[#002b66] text-xs"
											colSpan={14}
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
											className="border-gray-100 border-b text-[11px] text-gray-800 hover:bg-gray-50/80"
											key={`party-row-${rIdx}-${row.InvNo}`}
										>
											<td className="px-1 py-0.5 text-center text-gray-600">
												{rIdx + 1}
											</td>
											<td className="whitespace-nowrap px-1.5 py-0.5 font-medium">
												{row.InvNo}
											</td>
											<td className="whitespace-nowrap px-1.5 py-0.5">
												{formatDisplayDate(row.InvDt)}
											</td>
											<td className="px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
												{row.ItemCode}
											</td>
											<td className="px-2 py-0.5 font-medium leading-tight">
												{row.ItemName}
											</td>
											<td className="px-1.5 py-0.5 text-gray-600">
												{row.Packing}
											</td>
											<td className="whitespace-nowrap px-1.5 py-0.5">
												{row.BatchNo}
											</td>
											<td className="whitespace-nowrap px-1.5 py-0.5">
												{formatExpDate(row.ExpDt)}
											</td>
											<td className="px-1.5 py-0.5 text-right font-semibold">
												{row.Qty}
											</td>
											<td className="px-1 py-0.5 text-right text-gray-600">
												{row.FQty ? row.FQty : ""}
											</td>
											<td className="px-1.5 py-0.5 text-right">
												{Number(row.Srate || 0).toFixed(2)}
											</td>
											<td className="px-2 py-0.5 text-right font-medium">
												{Number(row.Amt || 0).toFixed(2)}
											</td>
											<td className="whitespace-nowrap px-2 py-0.5 text-gray-700">
												{row.Series || ""}
											</td>
											<td className="max-w-[70px] truncate px-1.5 py-0.5 text-gray-600">
												{row.Remarks || ""}
											</td>
										</tr>
									))}

									{/* Subtotal for this Party */}
									<tr className="border-gray-400 border-y bg-gray-50/50 font-bold text-[11px] text-gray-900">
										<td className="px-2 py-1 text-left" colSpan={8}>
											Total for {group.customer}
										</td>
										<td className="px-1.5 py-1 text-right text-blue-800">
											{group.totalQty}
										</td>
										<td className="px-1 py-1 text-right">
											{group.totalFree || ""}
										</td>
										<td></td>
										<td className="px-2 py-1 text-right text-blue-800">
											{group.totalAmount.toFixed(2)}
										</td>
										<td colSpan={2}></td>
									</tr>
								</React.Fragment>
							))}

							{/* REPORT GRAND TOTALS */}
							<tr className="border-gray-900 border-t-2 border-b-2 bg-gray-100 font-extrabold text-gray-900 text-xs">
								<td className="px-2 py-2.5 text-left" colSpan={8}>
									Grand Total Sales :
								</td>
								<td className="px-1.5 py-2.5 text-right text-blue-800">
									{grandQty}
								</td>
								<td className="px-1 py-2.5 text-right">{grandFree || ""}</td>
								<td></td>
								<td className="px-2 py-2.5 text-right text-blue-800">
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
			<div className="border-gray-900 border-b-2 pb-2">
				<div className="flex items-start gap-4">
					<Image
						alt="Asmee Pharma Logo"
						className="object-contain"
						height={45}
						priority
						src="/logo.png"
						width={140}
					/>
					<div>
						<h2 className="font-extrabold text-base text-gray-900 uppercase tracking-tight">
							ASMEE PHARMA PRIVATE LIMITED
						</h2>
						<p className="mt-0.5 text-[11px] text-gray-700 leading-tight">
							BASEMENT-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP
							ROAD,
							<br />
							RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br />
							Contact: 9409789800, 9409789700 Mobile: 9409789700 Email:
							asmeepharma2022@gmail.com
						</p>
					</div>
				</div>

				<div className="mt-3 flex items-center justify-between border-gray-300 border-t pt-1.5 font-bold text-gray-900 text-xs">
					<div>Year : 2026-27</div>
					<div className="text-center font-extrabold text-[#0B2545] text-xs">
						Partywise/Itemwise Sales for Period of {fromDisplay} to {toDisplay}
					</div>
					<div>No records found</div>
				</div>
			</div>

			<div className="py-12 text-center font-medium text-gray-500 text-sm">
				No party sales records found for the selected period and division.
			</div>
		</div>
	);
}
