import Image from "next/image";
import React from "react";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getItemCustomerSale } from "@/server/actions/customerItemSale";

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
	// Fetch MR and permissions from legacy schema
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo || !mrInfo.canViewSales)
		return <div>No access to sales data.</div>;

	const company = searchParams?.division || "All";
	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || ""
			: mrInfo.companyCode && (mrInfo.company === company || mrInfo.division === company)
				? mrInfo.companyCode
				: company;

	const defaultFrom = searchParams?.from || "2026-04-01";
	const defaultTo = searchParams?.to || "2026-09-30";

	const salesResult = await getItemCustomerSale({
		fromDate: defaultFrom,
		toDate: defaultTo,
		locNo: mrInfo.locNo || "11",
		compCode: compCodeToQuery,
	});

	const rawRows = salesResult.success && salesResult.data ? salesResult.data : [];

	let reportData = rawRows.map((row) => ({
		Division: mrInfo.division || mrInfo.company || "General",
		Customer: row.Customer || "Unknown Party",
		InvNo: row.InvNo,
		InvDate: formatDisplayDate(row.InvDt),
		Code: row.ItemCode || "-",
		ItemName: row.ItemName,
		Packing: row.Packing || "-",
		BatchNo: row.BatchNo,
		MRP: Number(row.PTR || 0).toFixed(2),
		ExpDt: row.ExpDt ? String(row.ExpDt).split("T")[0] : "-",
		Qty: Number(row.Qty || 0),
		FQty: Number(row.FQty || 0),
		Rate: Number(row.Srate || row.PTR || 0).toFixed(2),
		TaxableAmt: Number(row.IAmt || 0),
		GSTAmt: 0,
		Amount: Number(row.IAmt || 0),
	}));

	if (searchParams?.q) {
		const q = searchParams.q.toLowerCase();
		reportData = reportData.filter(
			(d) =>
				d.ItemName.toLowerCase().includes(q) ||
				d.Customer.toLowerCase().includes(q) ||
				d.InvNo.toLowerCase().includes(q) ||
				d.Code.toLowerCase().includes(q),
		);
	}

	const divisions = [...new Set(reportData.map((d) => d.Division))].sort();

	let grandQty = 0;
	let grandFQty = 0;
	let grandTaxable = 0;
	let grandGST = 0;
	let grandAmt = 0;

	reportData.forEach((row) => {
		grandQty += row.Qty;
		grandFQty += row.FQty;
		grandTaxable += row.TaxableAmt;
		grandGST += row.GSTAmt;
		grandAmt += row.Amount;
	});

	return (
		<div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{/* HEADER */}
			<div className="border-[#0B2545] border-b-2 pb-2">
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
							BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD,
							<br />
							RAOPURA, VADODARA - 390001, GUJARAT - 24
						</p>
					</div>
				</div>

				<div className="mt-3 flex items-center justify-between border-gray-300 border-t pt-1.5 font-bold text-gray-900 text-xs">
					<div>Year : 2026-27</div>
					<div className="font-extrabold text-[#0B2545] text-xs">
						Sales Statement for Period of {formatDisplayDate(defaultFrom)} to {formatDisplayDate(defaultTo)}
					</div>
					<div>Total Items: {reportData.length}</div>
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
							<th className="py-2 text-right font-bold text-[#0B2545] text-xs">MRP</th>
							<th className="py-2 text-center font-bold text-[#0B2545] text-xs">Exp. Dt.</th>
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
												<tr>
													<td
														className="border-[#cce5ff] border-y-2 bg-[#d4edda] px-3 py-2 font-extrabold text-[#155724] text-sm uppercase tracking-wide"
														colSpan={15}
													>
														Customer : {cust}
													</td>
												</tr>

												{custData.map((row, rowIdx) => {
													custQty += row.Qty;
													custTaxable += row.TaxableAmt;
													custGST += row.GSTAmt;
													custAmt += row.Amount;

													return (
														<tr
															className="border-gray-200 border-b hover:bg-gray-50"
															key={rowIdx}
														>
															<td className="py-1.5 pl-2">{rowIdx + 1}</td>
															<td className="py-1.5 font-bold">{row.InvNo}</td>
															<td className="py-1.5">{row.InvDate}</td>
															<td className="py-1.5">{row.Code}</td>
															<td className="py-1.5 font-bold text-gray-900">{row.ItemName}</td>
															<td className="py-1.5">{row.Packing}</td>
															<td className="py-1.5">{row.BatchNo}</td>
															<td className="py-1.5 text-right">{row.MRP}</td>
															<td className="py-1.5 text-center">{row.ExpDt}</td>
															<td className="py-1.5 text-right font-bold">{row.Qty}</td>
															<td className="py-1.5 text-right">{row.FQty}</td>
															<td className="py-1.5 text-right">{row.Rate}</td>
															<td className="py-1.5 text-right">{row.TaxableAmt.toFixed(2)}</td>
															<td className="py-1.5 text-right">{row.GSTAmt.toFixed(2)}</td>
															<td className="py-1.5 pr-2 text-right font-bold">{row.Amount.toFixed(2)}</td>
														</tr>
													);
												})}

												{/* Customer Subtotal */}
												<tr className="border-gray-300 border-t bg-[#f0fff4] font-bold text-[#155724]">
													<td className="py-1.5 pl-2" colSpan={9}>
														Party Total :
													</td>
													<td className="py-1.5 text-right">{custQty}</td>
													<td className="py-1.5 text-right"></td>
													<td className="py-1.5 text-right"></td>
													<td className="py-1.5 text-right">{custTaxable.toFixed(2)}</td>
													<td className="py-1.5 text-right">{custGST.toFixed(2)}</td>
													<td className="py-1.5 pr-2 text-right">{custAmt.toFixed(2)}</td>
												</tr>
											</React.Fragment>
										);
									})}

									{/* Division Subtotal */}
									<tr className="border-[#0B2545] border-y bg-[#fff9db] font-bold text-[#0B2545]">
										<td className="py-2 pl-2" colSpan={9}>
											Division Total ({div.toUpperCase()}) :
										</td>
										<td className="py-2 text-right">{divQty}</td>
										<td className="py-2 text-right"></td>
										<td className="py-2 text-right"></td>
										<td className="py-2 text-right">{divTaxable.toFixed(2)}</td>
										<td className="py-2 text-right">{divGST.toFixed(2)}</td>
										<td className="py-2 pr-2 text-right">{divAmt.toFixed(2)}</td>
									</tr>
								</React.Fragment>
							);
						})}

						{/* Grand Total */}
						<tr className="border-[#0B2545] border-b-2 bg-[#e6f0fa] font-extrabold text-[#0B2545]">
							<td className="py-2 pl-2" colSpan={9}>
								Grand Total :
							</td>
							<td className="py-2 text-right">{grandQty}</td>
							<td className="py-2 text-right">{grandFQty}</td>
							<td className="py-2 text-right"></td>
							<td className="py-2 text-right">{grandTaxable.toFixed(2)}</td>
							<td className="py-2 text-right">{grandGST.toFixed(2)}</td>
							<td className="py-2 pr-2 text-right">{grandAmt.toFixed(2)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
