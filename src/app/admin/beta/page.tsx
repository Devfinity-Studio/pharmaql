"use client";

import { useState } from "react";
import { getStockMovement } from "@/server/actions/stockreports"; // Make sure this path matches your setup

export default function StockReportForm() {
	const [companyCode, setCompanyCode] = useState("1");
	const [fromDate, setFromDate] = useState("2026-10-01");
	const [toDate, setToDate] = useState("2026-10-11");
	const [results, setResults] = useState<any[] | null>(null);

	async function handleGenerateReport(e: React.FormEvent) {
		e.preventDefault();

		const response = await getStockMovement(companyCode, fromDate, toDate);

		if (response.success) {
			setResults(response.data);
		} else {
			alert("Failed to load report. Check console.");
		}
	}

	return (
		<div className="flex flex-col gap-8 p-4">
			<form
				className="flex max-w-sm flex-col gap-4"
				onSubmit={handleGenerateReport}
			>
				<label>
					Company Code:
					<input
						className="w-full border p-1 text-black"
						onChange={(e) => setCompanyCode(e.target.value)}
						type="text"
						value={companyCode}
					/>
				</label>

				<label>
					From Date:
					<input
						className="w-full border p-1 text-black"
						onChange={(e) => setFromDate(e.target.value)}
						type="date"
						value={fromDate}
					/>
				</label>

				<label>
					To Date:
					<input
						className="w-full border p-1 text-black"
						onChange={(e) => setToDate(e.target.value)}
						type="date"
						value={toDate}
					/>
				</label>

				<button
					className="rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
					type="submit"
				>
					Generate Report
				</button>

				{results && (
					<p className="font-semibold text-green-600">
						Loaded {results.length} rows successfully!
					</p>
				)}
			</form>

			{/* --- RAW DATABASE OUTPUT TABLE --- */}
			{results && results.length > 0 && (
				<div className="w-full overflow-x-auto rounded border-2 border-red-500 bg-white p-4">
					<p className="mb-2 font-bold text-red-600">
						Raw Database Columns & Values (Check the exact capitalization of the
						headers!):
					</p>
					<table className="min-w-full border-collapse border border-gray-300 text-black text-xs">
						<thead className="bg-gray-100">
							<tr>
								{Object.keys(results[0]).map((key) => (
									<th
										className="whitespace-nowrap border border-gray-300 px-2 py-1 text-left font-bold"
										key={key}
									>
										{key}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{results.map((row: any, rowIndex: number) => (
								<tr className="hover:bg-gray-50" key={rowIndex}>
									{Object.values(row).map((val: any, colIndex: number) => (
										<td
											className="whitespace-nowrap border border-gray-300 px-2 py-1"
											key={colIndex}
										>
											{val !== null ? String(val) : "null"}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{results && results.length === 0 && (
				<p className="font-medium text-red-500">
					The procedure returned an empty array (0 rows) for these filters.
				</p>
			)}
		</div>
	);
}
