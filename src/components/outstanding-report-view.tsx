import { and, eq, gte, lte, or } from "drizzle-orm";
import React from "react";
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
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo) return <div>MR not found.</div>;

	const company = searchParams?.division || "All";
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	const selectedAssignments =
		company === "All"
			? assigned
			: assigned.filter((a) => (a.division || a.manufacturer) === company);

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
			outstandingCondition = and(
				outstandingCondition,
				gte(outstanding.invDt, fromDate),
			);
		}
	}

	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			outstandingCondition = and(
				outstandingCondition,
				lte(outstanding.invDt, toDate),
			);
		}
	}

	const accessibleOutstanding = outstandingCondition
		? await db.select().from(outstanding).where(outstandingCondition)
		: [];

	const partyFilter = searchParams?.party;
	const filteredOutstanding = partyFilter
		? accessibleOutstanding.filter((o) => o.doctor === partyFilter)
		: accessibleOutstanding;

	const reportData = filteredOutstanding.map((out) => {
		return {
			Manufacturer: out.division || out.manufacturerCode || "Unknown",
			"Doctor / Party": out.doctor || "Unknown",
			City: out.city || "Unknown",
			"Invoice No": out.invNo || "N/A",
			"Invoice Date": out.invDt
				? new Date(out.invDt).toLocaleDateString()
				: "N/A",
			"Amount Due": out.invAmt ? parseFloat(out.invAmt) : 0,
		};
	});

	// Grouping by Manufacturer
	const manufacturers = [
		...new Set(reportData.map((d) => d.Manufacturer)),
	].sort();
	let grandTotalAmount = 0;

	return (
		<div className="mt-4 space-y-8 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{/* Header */}
			<div className="mb-2 flex flex-col items-start justify-between gap-4 border-[#0B2545] border-b-2 pb-2 md:flex-row">
				<div className="flex items-center gap-4">
					<div className="font-black text-5xl text-[#0B2545] italic">A</div>
					<div>
						<h2 className="font-extrabold text-2xl text-[#0B2545] tracking-tight">
							ASMEE PHARMA PRIVATE LIMITED
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
						Party Wise Outstanding Statement for the Period of{" "}
						{searchParams?.from || "Start"} to {searchParams?.to || "End"}
					</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-[#0B2545] border-t-2 pt-1">
				<table className="w-full min-w-[800px] border-collapse text-left font-sans">
					<thead>
						<tr className="border-[#0B2545] border-y-2">
							<th className="py-2 pl-2 font-bold text-[#0B2545] text-sm">
								Doctor / Party
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">City</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">
								Invoice No
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">
								Invoice Date
							</th>
							<th className="py-2 pr-2 text-right font-bold text-[#0B2545] text-sm">
								Amount Due
							</th>
						</tr>
					</thead>
					<tbody className="font-medium text-sm">
						{manufacturers.map((mfg, idx) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							let mfgAmount = 0;

							return (
								<React.Fragment key={idx}>
									{/* Company Header Row */}
									<tr>
										<td
											className="border-gray-200 border-b bg-gray-50/50 px-2 py-2 font-bold text-[#000080]"
											colSpan={5}
										>
											Company : {mfg.toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgAmount += row["Amount Due"];

										return (
											<tr
												className="border-gray-100 border-b text-[#0B2545] hover:bg-gray-50"
												key={rowIdx}
											>
												<td className="whitespace-nowrap py-1.5 pl-2">
													{row["Doctor / Party"]}
												</td>
												<td className="py-1.5">{row["City"]}</td>
												<td className="py-1.5">{row["Invoice No"]}</td>
												<td className="py-1.5">{row["Invoice Date"]}</td>
												<td className="py-1.5 pr-2 text-right font-bold text-rose-600">
													{row["Amount Due"].toFixed(2)}
												</td>
											</tr>
										);
									})}
									{/* Full Company Total */}
									<tr className="border-gray-400 border-b-2 bg-gray-50 font-bold text-[#0B2545]">
										<td className="py-2 pl-2" colSpan={4}>
											Total Outstanding for {mfg.toUpperCase()} :
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
						})}
						{/* Grand Total */}
						<tr className="border-[#0B2545] border-b-4 bg-gray-100 font-extrabold text-[#0B2545] text-base">
							<td className="py-3 pl-2" colSpan={4}>
								Total Outstanding :
							</td>
							<td className="py-3 pr-2 text-right text-rose-700">
								{grandTotalAmount.toFixed(2)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
