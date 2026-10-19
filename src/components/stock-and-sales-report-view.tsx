import React from "react";
import { OfflineReportSync } from "@/components/offline-report-sync";
import { ReportStationeryHeader } from "@/components/report-stationery-header";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getStockAndSales,
	type StockAndSalesRow,
} from "@/server/actions/stockAndSales";

interface StockAndSalesDisplayItem {
	ItemId: number | string;
	ItemCode: string;
	ItemName: string;
	Packing: string;
	Division: string;
	Company: string;
	BatchNo: string;
	OpeningQty: number;
	PurchaseQty: number;
	SalesQty: number;
	FreeQty: number;
	SalesReturnQty: number;
	ClosingQty: number;
	PTR: number;
	Rate: number;
	SalesValue: number;
	ClosingValue: number;
	raw: Record<string, any>;
}

export async function StockAndSalesReportView({
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
	// 1. Fetch MR Info & permissions
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo?.canViewStockAndSales && !mrInfo?.canViewStock) {
		return <div className="p-4 font-semibold text-gray-500">No access to Stock & Sales report.</div>;
	}

	const effectiveLocNo = mrInfo.locNo || "11";
	const company = searchParams?.division || "All";

	const assignments =
		mrInfo.assignments && mrInfo.assignments.length > 0
			? mrInfo.assignments
			: mrInfo.company
				? [
						{
							id: `legacy-${mrId}`,
							mrId,
							manufacturer: mrInfo.company,
							firmNo: null,
							division: mrInfo.division || null,
							company: mrInfo.company,
							companyCode: mrInfo.companyCode,
							createdAt: new Date(),
						},
					]
				: [];

	if (assignments.length === 0) {
		return <div className="p-4 text-gray-500">No company assignments found for this MR.</div>;
	}

	const selectedAssignments =
		company === "All"
			? assignments
			: assignments.filter((a) => (a.division || a.manufacturer || a.company) === company);

	if (selectedAssignments.length === 0) {
		return <div className="p-4 text-gray-500">No data assigned for selected division.</div>;
	}

	// Resolve target company codes directly without string cutting
	const targetCodes = Array.from(
		new Set(
			selectedAssignments
				.map((a: any) => a.companyCode || mrInfo.companyCode)
				.filter(Boolean),
		),
	) as string[];

	const fromDate = searchParams?.from || "2026-10-01";
	const toDate = searchParams?.to || new Date().toISOString().slice(0, 10);
	const divFilter = company !== "All" ? company : undefined;

	// Execute stored procedure: CALL `rptStockandSalesStatementReport`(...)
	const response = await getStockAndSales({
		compCode: targetCodes.length > 0 ? targetCodes : mrInfo.companyCode || undefined,
		fromDate,
		toDate,
		locNo: effectiveLocNo,
		div: divFilter,
	});

	if (!response.success || !response.data) {
		return (
			<div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-6">
				<div className="font-semibold text-red-600 text-sm">
					Failed to load Stock & Sales report: {response.error || "Unknown error"}
				</div>
				{response.debugSql && (
					<div className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-gray-300 text-xs">
						<code>{response.debugSql}</code>
					</div>
				)}
			</div>
		);
	}

	// Filter rows by assigned divisions/companies to ensure clean data isolation
	const rawData = response.data;
	const matchingRows = rawData.filter((row: StockAndSalesRow) => {
		if (company !== "All") {
			const sel = company.trim().toUpperCase();
			const rowDiv = (row.Division || "").toString().trim().toUpperCase();
			const rowMake = (row.Make || row.Company || row.CompanyName || "").toString().trim().toUpperCase();
			if (rowDiv) {
				return rowDiv === sel || rowDiv.includes(sel) || sel.includes(rowDiv);
			}
			return rowMake === sel || rowMake.includes(sel) || sel.includes(rowMake);
		}
		return selectedAssignments.some((a) => {
			const mfgName = a.manufacturer?.trim().toUpperCase();
			const divName = a.division?.trim().toUpperCase();
			const rowMake = (row.Make || row.Company || row.CompanyName || "").toString().trim().toUpperCase();
			const rowDiv = (row.Division || "").toString().trim().toUpperCase();

			const matchesMfg =
				!mfgName ||
				rowMake === mfgName ||
				rowMake.includes(mfgName) ||
				mfgName.includes(rowMake) ||
				(a.company && rowMake === a.company.trim().toUpperCase());

			const matchesDiv =
				!divName ||
				rowDiv === divName ||
				rowDiv.includes(divName) ||
				divName.includes(rowDiv);

			return matchesMfg && matchesDiv;
		});
	});

	// Normalize data columns
	const reportData: StockAndSalesDisplayItem[] = matchingRows.map((r: StockAndSalesRow) => {
		const opQty = Number(r.OpQty ?? r.OpeningQty ?? r.Opening ?? 0);
		const purQty = Number(r.PurQty ?? r.PurchaseQty ?? r.Purchase ?? r.RecQty ?? 0);
		const saleQty = Number(r.SaleQty ?? r.SalesQty ?? r.Sales ?? 0);
		const freeQty = Number(r.FreeQty ?? r.Free ?? r.FQty ?? 0);
		const sRetQty = Number(r.SRetQty ?? r.SReturn ?? r.SalesReturn ?? 0);
		const closingQty = Number(r.BalQty ?? r.ClosingQty ?? r.Balance ?? r.Closing ?? (opQty + purQty + sRetQty - saleQty));
		const ptr = Number(r.PTR ?? r.Ptr ?? 0);
		const rate = Number(r.Rate ?? r.PRate ?? ptr);
		const salesValue = Number(r.SaleVal ?? r.SalesValue ?? (saleQty * (ptr || rate)));
		const closingValue = Number(r.BalVal ?? r.ClosingValue ?? (closingQty * (rate || ptr)));

		return {
			ItemId: r.ItemId || r.ItemID || r.ItemCode || "-",
			ItemCode: (r.ItemCode || "").toString().trim() || "-",
			ItemName: (r.ItemName || r.Iname || r.ProductName || "Unknown Item").toString().trim(),
			Packing: (r.Packing || "-").toString().trim(),
			Division: (r.Division || r.Make || company !== "All" ? company : "General").toString().trim(),
			Company: (r.CompanyName || r.Company || r.Make || mrInfo.company || "").toString().trim(),
			BatchNo: (r.BatchNo || r.Batch || "-").toString().trim(),
			OpeningQty: opQty,
			PurchaseQty: purQty,
			SalesQty: saleQty,
			FreeQty: freeQty,
			SalesReturnQty: sRetQty,
			ClosingQty: closingQty,
			PTR: ptr,
			Rate: rate,
			SalesValue: salesValue,
			ClosingValue: closingValue,
			raw: r,
		};
	});

	// Totals
	const totals = reportData.reduce(
		(acc, curr) => {
			acc.OpeningQty += curr.OpeningQty;
			acc.PurchaseQty += curr.PurchaseQty;
			acc.SalesQty += curr.SalesQty;
			acc.FreeQty += curr.FreeQty;
			acc.SalesReturnQty += curr.SalesReturnQty;
			acc.ClosingQty += curr.ClosingQty;
			acc.SalesValue += curr.SalesValue;
			acc.ClosingValue += curr.ClosingValue;
			return acc;
		},
		{
			OpeningQty: 0,
			PurchaseQty: 0,
			SalesQty: 0,
			FreeQty: 0,
			SalesReturnQty: 0,
			ClosingQty: 0,
			SalesValue: 0,
			ClosingValue: 0,
		},
	);

	const Th = ({
		children,
		className = "",
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<th
			className={`border-gray-300 border-b bg-[#F0F4F8] px-3 py-2.5 font-bold text-[#0B2545] text-xs ${className}`}
		>
			{children}
		</th>
	);

	const Td = ({
		children,
		className = "",
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<td
			className={`border-gray-200 border-b px-3 py-2 text-gray-700 text-xs ${className}`}
		>
			{children}
		</td>
	);

	return (
		<div className="mt-4 rounded-xl border border-gray-300 bg-white p-6 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none">
			<OfflineReportSync
				data={reportData}
				mrId={mrId}
				params={searchParams}
				tab="stock-and-sales"
			/>

			{/* Official Stationery Header */}
			<ReportStationeryHeader
				fromDisplay={fromDate.split("-").reverse().join("/")}
				summaryRight={
					<div className="text-right font-medium text-[10px] text-gray-600">
						<div>
							<span className="font-bold text-[#0B2545]">Report:</span> Stock & Sales Statement
						</div>
						<div>
							<span className="font-bold text-[#0B2545]">Division:</span> {company}
						</div>
					</div>
				}
				title="Stock & Sales Statement Report"
				toDisplay={toDate.split("-").reverse().join("/")}
			/>

			{/* Live Procedure Execution Debug Banner */}
			{searchParams?.debug === "true" && response.debugSql && (
				<div className="my-3 overflow-x-auto rounded-lg bg-gray-950 p-3 font-mono text-emerald-400 text-xs shadow-inner">
					<div className="mb-1 font-bold text-gray-400 text-[10px] uppercase tracking-wider">
						Executed Backend Procedure (MySQL):
					</div>
					<code>{response.debugSql}</code>
				</div>
			)}

			<div className="mt-4 w-full overflow-x-auto border-gray-300 border-t border-b">
				<table className="w-full min-w-[1200px] border-collapse text-left">
					<thead>
						<tr>
							<Th className="w-[100px]">Item Code</Th>
							<Th>Product Name</Th>
							<Th className="w-[80px] text-center">Packing</Th>
							<Th className="w-[110px]">Division</Th>
							<Th className="w-[100px]">Batch No</Th>
							<Th className="w-[90px] text-right">Opening</Th>
							<Th className="w-[90px] text-right">Inward / Pur</Th>
							<Th className="w-[90px] text-right">Sales Qty</Th>
							<Th className="w-[80px] text-right">Free Qty</Th>
							<Th className="w-[80px] text-right">S.Ret Qty</Th>
							<Th className="w-[90px] text-right">Closing Qty</Th>
							<Th className="w-[90px] text-right">PTR (₹)</Th>
							<Th className="w-[110px] text-right">Sales Val (₹)</Th>
							<Th className="w-[110px] text-right">Closing Val (₹)</Th>
						</tr>
					</thead>
					<tbody>
						{reportData.length === 0 ? (
							<tr>
								<td
									className="px-4 py-12 text-center text-gray-500 text-sm"
									colSpan={14}
								>
									No stock & sales records found for the selected filters.
								</td>
							</tr>
						) : (
							reportData.map((item, idx) => (
								<tr
									className="transition-colors hover:bg-sky-50/40"
									key={`${item.ItemId}_${item.BatchNo}_${idx}`}
								>
									<Td className="font-mono text-gray-600">{item.ItemCode}</Td>
									<Td className="font-semibold text-gray-900">{item.ItemName}</Td>
									<Td className="text-center">{item.Packing}</Td>
									<Td>
										<span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-medium text-[11px] text-gray-700">
											{item.Division}
										</span>
									</Td>
									<Td className="font-mono text-gray-600">{item.BatchNo}</Td>
									<Td className="text-right font-medium">
										{item.OpeningQty !== 0 ? item.OpeningQty.toLocaleString("en-IN") : "-"}
									</Td>
									<Td className="text-right font-medium">
										{item.PurchaseQty !== 0 ? item.PurchaseQty.toLocaleString("en-IN") : "-"}
									</Td>
									<Td className="text-right font-bold text-[#0071BC]">
										{item.SalesQty !== 0 ? item.SalesQty.toLocaleString("en-IN") : "-"}
									</Td>
									<Td className="text-right">
										{item.FreeQty !== 0 ? item.FreeQty.toLocaleString("en-IN") : "-"}
									</Td>
									<Td className="text-right">
										{item.SalesReturnQty !== 0 ? item.SalesReturnQty.toLocaleString("en-IN") : "-"}
									</Td>
									<Td className="text-right font-bold text-gray-900">
										{item.ClosingQty !== 0 ? item.ClosingQty.toLocaleString("en-IN") : "-"}
									</Td>
									<Td className="text-right font-mono">
										{item.PTR > 0 ? item.PTR.toFixed(2) : "-"}
									</Td>
									<Td className="text-right font-mono font-semibold text-[#0071BC]">
										{item.SalesValue > 0 ? item.SalesValue.toFixed(2) : "-"}
									</Td>
									<Td className="text-right font-mono font-semibold text-gray-900">
										{item.ClosingValue > 0 ? item.ClosingValue.toFixed(2) : "-"}
									</Td>
								</tr>
							))
						)}

						{/* Grand Total Row */}
						{reportData.length > 0 && (
							<tr className="border-gray-400 border-t-2 bg-[#F0F4F8] font-bold text-gray-900">
								<td className="px-3 py-2.5 text-xs" colSpan={5}>
									GRAND TOTAL :
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs">
									{totals.OpeningQty.toLocaleString("en-IN")}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs">
									{totals.PurchaseQty.toLocaleString("en-IN")}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs text-[#0071BC]">
									{totals.SalesQty.toLocaleString("en-IN")}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs">
									{totals.FreeQty.toLocaleString("en-IN")}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs">
									{totals.SalesReturnQty.toLocaleString("en-IN")}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs">
									{totals.ClosingQty.toLocaleString("en-IN")}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs">-</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs text-[#0071BC]">
									{totals.SalesValue.toFixed(2)}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs">
									{totals.ClosingValue.toFixed(2)}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
