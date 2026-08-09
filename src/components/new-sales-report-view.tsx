import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import React from "react";
import { db } from "@/server/db";
import { mrManufacturers, products, user } from "@/server/db/schema";
import { sql } from "drizzle-orm";

export async function NewSalesReportView({
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
	// Fetch MR and assignments
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || !mrInfo.canViewSales)
		return <div>No access to sales data.</div>;

	const company = searchParams?.division || "All";
	const selectedAssignments = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	let validAssignments = selectedAssignments;
	if (company !== "All") {
		validAssignments = selectedAssignments.filter(
			(a) => a.division === company || a.manufacturer === company,
		);
	}

	if (validAssignments.length === 0) return <div>No data assigned</div>;

	const productConditionList = validAssignments.map((d) => {
		const conditions = [eq(products.manufacturer, d.manufacturer)];
		if (d.division) {
			conditions.push(eq(products.division, d.division));
		}
		return and(...conditions);
	});

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(or(...productConditionList));

	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) return <div>No products found</div>;

	// Query raw SQL for legacy tables
	let dateCondition = ``;
	if (searchParams?.from) {
		dateCondition += ` AND h.inv_dt >= '${searchParams.from}'`;
	}
	if (searchParams?.to) {
		dateCondition += ` AND h.inv_dt <= '${searchParams.to}'`;
	}

	const legacyDataResult = await db.execute(sql.raw(`
		SELECT 
			h.inv_no as "InvNo",
			h.inv_dt as "InvDt",
			CONCAT(h.cust_id, ' ', COALESCE(c.name, 'Unknown Party'), ' , ', COALESCE(c.city, '')) as "Customer",
			l.item_id as "ItemID",
			l.batch_no as "BatchNo",
			l.mrp as "MRP",
			l.exp_dt as "ExpDt",
			l.qty as "Qty",
			l.f_qty as "FQty",
			l.rate as "Rate",
			l.taxable_amt as "TaxableAmt",
			l.vat_amt as "GSTAmt",
			l.line_amt as "Amount"
		FROM "pg-drizzle_legacy_h_sale" h
		JOIN "pg-drizzle_legacy_l_sale" l ON l.rid = h.id
		LEFT JOIN "pg-drizzle_legacy_customers" c ON c.id = h.cust_id
		WHERE l.item_id IN (${productIds.map(id => `'${id}'`).join(",")})
		${dateCondition}
	`));

	const legacyRows = legacyDataResult as any[];
	
	const reportData: any[] = [];
	legacyRows.forEach((row: any) => {
		const p = accessibleProducts.find(
			(prod) => prod.id === String(row.ItemID),
		);
		if (p) {
			reportData.push({
				Division: p.division || p.manufacturer,
				Customer: row.Customer || "Unknown Party",
				InvNo: row.InvNo,
				InvDate: row.InvDt ? new Date(row.InvDt).toLocaleDateString() : "-",
				Code: p.code || "-",
				ItemName: p.name,
				Packing: "10 Tablets", // Hardcoded placeholder per request context, or could be p.packing if available
				BatchNo: row.BatchNo,
				MRP: Number(row.MRP).toFixed(2),
				ExpDt: row.ExpDt,
				Qty: Number(row.Qty),
				FQty: Number(row.FQty),
				Rate: Number(row.Rate).toFixed(2),
				TaxableAmt: Number(row.TaxableAmt),
				GSTAmt: Number(row.GSTAmt),
				Amount: Number(row.TaxableAmt) + Number(row.GSTAmt),
			});
		}
	});

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		for (let i = reportData.length - 1; i >= 0; i--) {
			const d = reportData[i];
			if (
				!d.ItemName.toLowerCase().includes(q) &&
				!d.Customer.toLowerCase().includes(q) &&
				!d.Division.toLowerCase().includes(q)
			) {
				reportData.splice(i, 1);
			}
		}
	}

	// Grouping by Division -> Customer
	const divisions = [...new Set(reportData.map((d) => d.Division))].sort();

	let grandTotalAmount = 0;
	let grandTotalTaxable = 0;
	let grandTotalGST = 0;
	let grandTotalQty = 0;

	reportData.forEach((row) => {
		grandTotalQty += row.Qty;
		grandTotalTaxable += row.TaxableAmt;
		grandTotalGST += row.GSTAmt;
		grandTotalAmount += row.Amount;
	});

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
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD,
							<br />
							RAOPURA, VADODARA - 390001, GUJARAT - 24
							<br />
							Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com
						</p>
					</div>
				</div>
			</div>

			<div className="mb-4 flex items-end justify-between font-bold text-[#0B2545] text-sm">
				<div>
					<p>Year : 2026-27</p>
					<p className="mt-2 text-base">
						Company / Customer / Itemwise Sales for period of{" "}
						{searchParams?.from || "Start"} to {searchParams?.to || "End"}
					</p>
				</div>
				<div className="text-right">
					<p>Page 1 of 1</p>
				</div>
			</div>

			<div className="w-full overflow-x-auto border-[#0B2545] border-t-2 pt-1">
				<table className="w-full min-w-[1200px] border-collapse text-left font-sans">
					<thead>
						<tr className="border-[#0B2545] border-y-2">
							<th className="py-2 pl-2 font-bold text-[#0B2545] text-xs">Sr.</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs">Inv. No.</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs">Inv. Date</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs">Code</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs">Item Name</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs">Packing</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs">Batch No.</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs text-right">MRP</th>
							<th className="py-2 font-bold text-[#0B2545] text-xs text-center">Exp. Dt.</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-xs">Qty.</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-xs">FQty.</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-xs">Rate</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-xs">Taxable Amount</th>
							<th className="py-2 text-right font-bold text-[#0B2545] text-xs">GST Amount</th>
							<th className="py-2 pr-2 text-right font-bold text-[#0B2545] text-xs">Amount</th>
						</tr>
					</thead>
					<tbody className="font-medium text-xs">
						{divisions.map((div, divIdx) => {
							const divData = reportData.filter((d) => d.Division === div);
							const customers = [...new Set(divData.map((d) => d.Customer))].sort();
							
							let divQty = 0;
							let divTaxable = 0;
							let divGST = 0;
							let divAmt = 0;
							divData.forEach((row) => {
								divQty += row.Qty;
								divTaxable += row.TaxableAmt;
								divGST += row.GSTAmt;
								divAmt += row.Amount;
							});

							return (
								<React.Fragment key={divIdx}>
									{/* Division Header Row */}
									<tr>
										<td
											className="border-gray-200 border-b bg-[#fdf5e6] px-2 py-1.5 font-bold text-[#6b4c2a]"
											colSpan={15}
										>
											{div.toUpperCase()}
										</td>
									</tr>

									{customers.map((cust, custIdx) => {
										const custData = divData.filter((d) => d.Customer === cust);
										let custQty = 0;
										let custTaxable = 0;
										let custGST = 0;
										let custAmt = 0;

										return (
											<React.Fragment key={custIdx}>
												{/* Customer Header Row */}
												<tr>
													<td
														className="border-[#cce5ff] border-y-2 bg-[#d4edda] px-3 py-2 font-extrabold text-[#155724] text-sm uppercase tracking-wide"
														colSpan={15}
													>
														{cust}
													</td>
												</tr>
												{/* Items */}
												{custData.map((row, rowIdx) => {
													custQty += row.Qty;
													custTaxable += row.TaxableAmt;
													custGST += row.GSTAmt;
													custAmt += row.Amount;

													return (
														<tr
															className="border-gray-100 border-b text-[#0B2545] hover:bg-gray-50"
															key={rowIdx}
														>
															<td className="whitespace-nowrap py-1.5 pl-2">
																{rowIdx + 1}
															</td>
															<td className="py-1.5">{row.InvNo}</td>
															<td className="py-1.5">{row.InvDate}</td>
															<td className="py-1.5">{row.Code}</td>
															<td className="py-1.5">{row.ItemName}</td>
															<td className="py-1.5">{row.Packing}</td>
															<td className="py-1.5">{row.BatchNo}</td>
															<td className="py-1.5 text-right">{row.MRP}</td>
															<td className="py-1.5 text-center">{row.ExpDt}</td>
															<td className="py-1.5 text-right font-bold text-[#0B2545]">
																{row.Qty}
															</td>
															<td className="py-1.5 text-right">{row.FQty}</td>
															<td className="py-1.5 text-right">{row.Rate}</td>
															<td className="py-1.5 text-right">{row.TaxableAmt.toFixed(2)}</td>
															<td className="py-1.5 text-right">{row.GSTAmt.toFixed(2)}</td>
															<td className="py-1.5 pr-2 text-right font-bold text-[#0B2545]">
																{row.Amount.toFixed(2)}
															</td>
														</tr>
													);
												})}
												{/* Customer Subtotal */}
												<tr className="border-gray-300 border-y bg-white font-bold text-[#0B2545]">
													<td className="py-1.5 pl-2 text-right text-gray-500" colSpan={9}>Party Total</td>
													<td className="py-1.5 text-right border-t border-[#0B2545]">{custQty}</td>
													<td className="py-1.5 text-right" colSpan={2}></td>
													<td className="py-1.5 text-right border-t border-[#0B2545]">{custTaxable.toFixed(2)}</td>
													<td className="py-1.5 text-right border-t border-[#0B2545]">{custGST.toFixed(2)}</td>
													<td className="py-1.5 pr-2 text-right border-t border-[#0B2545] text-[#0056b3]">{custAmt.toFixed(2)}</td>
												</tr>
											</React.Fragment>
										);
									})}
									
									{/* Division Subtotal */}
									<tr className="border-[#6b4c2a] border-y-2 bg-[#fdf5e6] font-bold text-[#6b4c2a] text-sm">
										<td className="py-2 pl-2 text-right" colSpan={9}>{div.toUpperCase()} TOTAL</td>
										<td className="py-2 text-right">{divQty}</td>
										<td className="py-2 text-right" colSpan={2}></td>
										<td className="py-2 text-right">{divTaxable.toFixed(2)}</td>
										<td className="py-2 text-right">{divGST.toFixed(2)}</td>
										<td className="py-2 pr-2 text-right">{divAmt.toFixed(2)}</td>
									</tr>
								</React.Fragment>
							);
						})}

						{/* Division Summaries Before Grand Total */}
						{divisions.length > 1 && reportData.length > 0 && (
							<>
								<tr>
									<td colSpan={15} className="py-4"></td>
								</tr>
								{divisions.map((div, divIdx) => {
									const divData = reportData.filter((d) => d.Division === div);
									let divQty = 0;
									let divTaxable = 0;
									let divGST = 0;
									let divAmt = 0;
									divData.forEach((row) => {
										divQty += row.Qty;
										divTaxable += row.TaxableAmt;
										divGST += row.GSTAmt;
										divAmt += row.Amount;
									});
									return (
										<tr
											key={`summary-${divIdx}`}
											className="border-gray-300 border-y-2 bg-[#f0f4f8] font-bold text-[#0B2545] text-sm"
										>
											<td className="py-2 pl-2 text-right" colSpan={9}>
												{div.toUpperCase()} SUMMARY
											</td>
											<td className="py-2 text-right">{divQty}</td>
											<td className="py-2 text-right" colSpan={2}></td>
											<td className="py-2 text-right">{divTaxable.toFixed(2)}</td>
											<td className="py-2 text-right">{divGST.toFixed(2)}</td>
											<td className="py-2 pr-2 text-right text-[#0056b3]">
												{divAmt.toFixed(2)}
											</td>
										</tr>
									);
								})}
							</>
						)}

						{/* Grand Total Row */}
						{reportData.length > 0 && (
							<tr className="border-[#0B2545] border-y-4 bg-[#e6f0fa] font-black text-[#0B2545] text-sm">
								<td className="py-3 pl-2 text-right uppercase" colSpan={9}>Grand Total</td>
								<td className="py-3 text-right">{grandTotalQty}</td>
								<td className="py-3 text-right" colSpan={2}></td>
								<td className="py-3 text-right">{grandTotalTaxable.toFixed(2)}</td>
								<td className="py-3 text-right">{grandTotalGST.toFixed(2)}</td>
								<td className="py-3 pr-2 text-right">{grandTotalAmount.toFixed(2)}</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
