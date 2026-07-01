import React from "react";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
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
	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || !mrInfo.canViewSales) return <div>No access to sales data.</div>;

	const company = searchParams?.division || "All";
	const assigned = await db.select().from(mrManufacturers).where(eq(mrManufacturers.mrId, mrId));
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
	let salesCondition = and(inArray(sales.productId, productIds), eq(sales.mrId, mrId));
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
			date: sales.date
		})
		.from(sales)
		.where(salesCondition);

	const reportData: any[] = [];
	
	accessibleSales.forEach(s => {
		const p = accessibleProducts.find(prod => prod.id === s.productId);
		if (p) {
			reportData.push({
				Manufacturer: p.manufacturer,
				"Doctor / Party": s.dealer || "Unknown Party",
				"Product Name": p.name,
				"Sale Qty": s.quantity || 0,
				"Free Qty": s.freeQty || 0,
				"Amount": s.amount ? parseFloat(s.amount.toString()) : 0,
				"Date": s.date ? new Date(s.date).toLocaleDateString() : "-",
			});
		}
	});

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		for (let i = reportData.length - 1; i >= 0; i--) {
			const d = reportData[i];
			if (!d["Product Name"].toLowerCase().includes(q) && !d["Doctor / Party"].toLowerCase().includes(q) && !d["Manufacturer"].toLowerCase().includes(q)) {
				reportData.splice(i, 1);
			}
		}
	}

	// Grouping by Manufacturer
	const manufacturers = [...new Set(reportData.map((d) => d.Manufacturer))].sort();
	let grandTotalAmount = 0;
	let grandTotalSales = 0;

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
					<p className="text-base mt-2">Sales Movement Statement for the Period of {searchParams?.from || "Start"} to {searchParams?.to || "End"}</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-t-2 border-[#0B2545] pt-1">
				<table className="w-full min-w-[1000px] text-left border-collapse font-sans">
					<thead>
						<tr className="border-y-2 border-[#0B2545]">
							<th className="py-2 pl-2 text-[#0B2545] font-bold text-sm">Doctor / Party</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm">Product Name</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm">Date</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Sale Qty</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right">Free Qty</th>
							<th className="py-2 text-[#0B2545] font-bold text-sm text-right pr-2">Amount</th>
						</tr>
					</thead>
					<tbody className="text-sm font-medium">
						{manufacturers.map((mfg, idx) => {
							const mfgData = reportData.filter((d) => d.Manufacturer === mfg);
							let mfgAmount = 0;
							let mfgSales = 0;

							return (
								<React.Fragment key={idx}>
									{/* Company Header Row */}
									<tr>
										<td colSpan={6} className="py-2 font-bold text-[#000080] border-b border-gray-200 bg-gray-50/50 px-2">
											Company : {mfg.toUpperCase()}
										</td>
									</tr>
									{/* Items */}
									{mfgData.map((row, rowIdx) => {
										mfgAmount += row["Amount"];
										mfgSales += row["Sale Qty"];

										return (
											<tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50 text-[#0B2545]">
												<td className="py-1.5 whitespace-nowrap pl-2">{row["Doctor / Party"]}</td>
												<td className="py-1.5">{row["Product Name"]}</td>
												<td className="py-1.5">{row["Date"]}</td>
												<td className="py-1.5 text-right font-bold text-[#0071BC]">
													{row["Sale Qty"]}
												</td>
												<td className="py-1.5 text-right">
													{row["Free Qty"]}
												</td>
												<td className="py-1.5 text-right pr-2 font-bold text-rose-600">
													{row["Amount"].toFixed(2)}
												</td>
											</tr>
										);
									})}
									{/* Full Company Total */}
									<tr className="border-b-2 border-gray-400 font-bold text-[#0B2545] bg-gray-50">
										<td colSpan={3} className="py-2 pl-2">Total Sales for {mfg.toUpperCase()} :</td>
										<td className="py-2 text-right text-[#0071BC]">{mfgSales}</td>
										<td className="py-2"></td>
										<td className="py-2 text-right pr-2 text-rose-700">{mfgAmount.toFixed(2)}</td>
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
						<tr className="border-b-4 border-[#0B2545] font-extrabold text-[#0B2545] bg-gray-100 text-base">
							<td colSpan={3} className="py-3 pl-2">Total Sales :</td>
							<td className="py-3 text-right text-[#0071BC]">{grandTotalSales}</td>
							<td className="py-3"></td>
							<td className="py-3 text-right pr-2 text-rose-700">{grandTotalAmount.toFixed(2)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
