import React from "react";
import { and, eq, gte, lte, or } from "drizzle-orm";
import { db } from "@/server/db";
import { mrManufacturers, outstanding, user } from "@/server/db/schema";

export async function OutstandingReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
		party?: string;
	};
}) {
	// Fetch data
	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo) return <div>MR not found.</div>;

	const company = searchParams?.division || "All";
	const assigned = await db.select().from(mrManufacturers).where(eq(mrManufacturers.mrId, mrId));
	
	const selectedAssignments = company === "All" 
		? assigned 
		: assigned.filter(a => (a.division || a.manufacturer) === company);

	if (selectedAssignments.length === 0) return <div>No data assigned</div>;

	// Build Outstanding Condition
	const outstandingConditionList = selectedAssignments.map((d) => {
		const conditions = [eq(outstanding.manufacturerCode, d.manufacturer)];
		if (d.division) {
			conditions.push(eq(outstanding.division, d.division));
		}
		return and(...conditions);
	});

	let outstandingCondition = and(
		eq(outstanding.mrId, mrId),
		or(...outstandingConditionList),
	);

	if (searchParams?.from) {
		const fromDate = new Date(searchParams.from);
		if (!isNaN(fromDate.getTime())) {
			outstandingCondition = and(outstandingCondition, gte(outstanding.invDt, fromDate));
		}
	}

	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			outstandingCondition = and(outstandingCondition, lte(outstanding.invDt, toDate));
		}
	}

	const accessibleOutstanding = outstandingCondition
		? await db.select().from(outstanding).where(outstandingCondition)
		: [];

	const partyFilter = searchParams?.party;
	const filteredOutstanding = partyFilter 
		? accessibleOutstanding.filter(o => o.doctor === partyFilter)
		: accessibleOutstanding;

	const reportData = filteredOutstanding.map((out) => {
		return {
			Manufacturer: out.division || out.manufacturerCode || "Unknown",
			"Doctor / Party": out.doctor || "Unknown",
			City: out.city || "Unknown",
			"Invoice No": out.invNo || "N/A",
			"Invoice Date": out.invDt ? new Date(out.invDt).toLocaleDateString() : "N/A",
			"Amount Due": out.invAmt ? parseFloat(out.invAmt) : 0,
		};
	});

	// Grouping by Manufacturer
	const manufacturers = [...new Set(reportData.map((d) => d.Manufacturer))].sort();
	let grandTotalAmount = 0;

	return (
		<div className="space-y-8 mt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-6 overflow-hidden">
			{/* Header */}
			<div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-2 border-b-2 border-[#0B2545] pb-2">
				<div className="flex gap-4 items-center">
					<div className="text-[#0B2545] font-black italic text-5xl">A</div>
					<div>
						<h2 className="font-extrabold text-[#0B2545] text-2xl tracking-tight">ASMEE PHARMA PRIVATE LIMITED</h2>
						<p className="text-sm text-[#0B2545] font-medium mt-1 leading-relaxed">
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD,
							<br/>RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br/>Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
						</p>
					</div>
				</div>
			</div>

			<div className="flex justify-between items-end mb-4 text-[#0B2545] font-bold text-sm">
				<div>
					<p>Year : 2026-27</p>
					<p className="text-base mt-2">Party Wise Outstanding Statement for the Period of {searchParams?.from || "Start"} to {searchParams?.to || "End"}</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-t-2 border-[#0B2545] pt-1">
				<table className="w-full min-w-[800px] text-left border-collapse font-sans">
					<thead>
						<tr className="border-y-2 border-[#0B2545]">
							<th className="py-2 pl-2 text-[#0B2545] font-bold text-sm">Doctor / Party</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm">City</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm">Invoice No</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm">Invoice Date</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right pr-2">Amount Due</th>
						</tr>
					</thead>
					<tbody className="text-sm font-medium">
						{manufacturers.map((mfg, idx) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							let mfgAmount = 0;

							return (
								<React.Fragment key={idx}>
									{/* Company Header Row */}
									<tr>
										<td colSpan={5} className="py-2 font-bold text-[#000080] border-b border-gray-200 bg-gray-50/50 px-2">
											Company : {mfg.toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgAmount += row["Amount Due"];

										return (
											<tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50 text-[#0B2545]">
												<td className="py-1.5 whitespace-nowrap pl-2">{row["Doctor / Party"]}</td>
												<td className="py-1.5">{row["City"]}</td>
												<td className="py-1.5">{row["Invoice No"]}</td>
												<td className="py-1.5">{row["Invoice Date"]}</td>
												<td className="py-1.5 text-right pr-2 font-bold text-rose-600">
													{row["Amount Due"].toFixed(2)}
												</td>
											</tr>
										);
									})}
									{/* Full Company Total */}
									<tr className="border-b-2 border-gray-400 font-bold text-[#0B2545] bg-gray-50">
										<td colSpan={4} className="py-2 pl-2">Total Outstanding for {mfg.toUpperCase()} :</td>
										<td className="py-2 text-right pr-2 text-rose-700">{mfgAmount.toFixed(2)}</td>
									</tr>
									{(() => {
										grandTotalAmount += mfgAmount;
										return null;
									})()}
								</React.Fragment>
							);
						})}
						{/* Grand Total */}
						<tr className="border-b-4 border-[#0B2545] font-extrabold text-[#0B2545] bg-gray-100 text-base">
							<td colSpan={4} className="py-3 pl-2">Total Outstanding :</td>
							<td className="py-3 text-right pr-2 text-rose-700">{grandTotalAmount.toFixed(2)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
