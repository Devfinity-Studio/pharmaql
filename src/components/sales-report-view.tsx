import { and, eq, gte, inArray, lte } from "drizzle-orm";
import React from "react";
import { db } from "@/server/db";
import { mrManufacturers, products, sales, user } from "@/server/db/schema";

export async function SalesReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
		q?: string;
	};
}) {
	// Fetch data
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || !mrInfo.canViewSales)
		return <div>No access to sales data.</div>;

	const company = searchParams?.division || "All";
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));
	const manufacturerNames = assigned.map((a) => a.manufacturer);
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0) return <div>No data assigned</div>;

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) return <div>No products found</div>;

	// Fetch Sales with dealer (Party)
	let salesCondition = and(
		inArray(sales.productId, productIds),
		eq(sales.mrId, mrId),
	);
	if (searchParams?.from) {
		const fromDate = new Date(searchParams.from);
		if (!isNaN(fromDate.getTime())) {
			salesCondition = and(salesCondition, gte(sales.date, fromDate));
		}
	}
	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			salesCondition = and(salesCondition, lte(sales.date, toDate));
		}
	}

	const accessibleSales = await db
		.select({
			productId: sales.productId,
			quantity: sales.quantity,
			freeQty: sales.freeQty,
			dealer: sales.dealer,
			amount: sales.amount,
			date: sales.date,
		})
		.from(sales)
		.where(salesCondition);

	const reportData: any[] = [];

	accessibleSales.forEach((s) => {
		const p = accessibleProducts.find((prod) => prod.id === s.productId);
		if (p) {
			reportData.push({
				Manufacturer: p.manufacturer,
				"Doctor / Party": s.dealer || "Unknown Party",
				"Product Name": p.name,
				"Sale Qty": s.quantity || 0,
				"Free Qty": s.freeQty || 0,
				Amount: s.amount ? parseFloat(s.amount.toString()) : 0,
				Date: s.date ? new Date(s.date).toLocaleDateString() : "-",
			});
		}
	});

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		for (let i = reportData.length - 1; i >= 0; i--) {
			const d = reportData[i];
			if (
				!d["Product Name"].toLowerCase().includes(q) &&
				!d["Doctor / Party"].toLowerCase().includes(q) &&
				!d["Manufacturer"].toLowerCase().includes(q)
			) {
				reportData.splice(i, 1);
			}
		}
	}

	// Grouping by Manufacturer
	const manufacturers = [
		...new Set(reportData.map((d) => d.Manufacturer)),
	].sort();
	let grandTotalAmount = 0;
	let grandTotalSales = 0;

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
						Sales Movement Statement for the Period of{" "}
						{searchParams?.from || "Start"} to {searchParams?.to || "End"}
					</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-[#0B2545] border-t-2 pt-1">
				<table className="w-full min-w-[1000px] border-collapse text-left font-sans">
					<thead>
						<tr className="border-[#0B2545] border-y-2">
							<th className="py-2 pl-2 font-bold text-[#0B2545] text-sm">
								Doctor / Party
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">
								Product Name
							</th>
							<th className="py-2 font-bold text-[#0B2545] text-sm">Date</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Sale Qty
							</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-sm">
								Free Qty
							</th>
							<th className="py-2 pr-2 text-right font-bold text-[#0B2545] text-sm">
								Amount
							</th>
						</tr>
					</thead>
					<tbody className="font-medium text-sm">
						{manufacturers.map((mfg, idx) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							let mfgAmount = 0;
							let mfgSales = 0;

							return (
								<React.Fragment key={idx}>
									{/* Company Header Row */}
									<tr>
										<td
											className="border-gray-200 border-b bg-gray-50/50 px-2 py-2 font-bold text-[#000080]"
											colSpan={6}
										>
											Company : {mfg.toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgAmount += row["Amount"];
										mfgSales += row["Sale Qty"];

										return (
											<tr
												className="border-gray-100 border-b text-[#0B2545] hover:bg-gray-50"
												key={rowIdx}
											>
												<td className="whitespace-nowrap py-1.5 pl-2">
													{row["Doctor / Party"]}
												</td>
												<td className="py-1.5">{row["Product Name"]}</td>
												<td className="py-1.5">{row["Date"]}</td>
												<td className="py-1.5 text-right font-bold text-[#0071BC]">
													{row["Sale Qty"]}
												</td>
												<td className="py-1.5 text-right">{row["Free Qty"]}</td>
												<td className="py-1.5 pr-2 text-right font-bold text-rose-600">
													{row["Amount"].toFixed(2)}
												</td>
											</tr>
										);
									})}
									{/* Full Company Total */}
									<tr className="border-gray-400 border-b-2 bg-gray-50 font-bold text-[#0B2545]">
										<td className="py-2 pl-2" colSpan={3}>
											Total Sales for {mfg.toUpperCase()} :
										</td>
										<td className="py-2 text-right text-[#0071BC]">
											{mfgSales}
										</td>
										<td className="py-2"></td>
										<td className="py-2 pr-2 text-right text-rose-700">
											{mfgAmount.toFixed(2)}
										</td>
									</tr>
									{(() => {
										grandTotalAmount += mfgAmount;
										grandTotalSales += mfgSales;
										return null;
									})()}
								</React.Fragment>
							);
						})}
						{/* Grand Total */}
						<tr className="border-[#0B2545] border-b-4 bg-gray-100 font-extrabold text-[#0B2545] text-base">
							<td className="py-3 pl-2" colSpan={3}>
								Total Sales :
							</td>
							<td className="py-3 text-right text-[#0071BC]">
								{grandTotalSales}
							</td>
							<td className="py-3"></td>
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
