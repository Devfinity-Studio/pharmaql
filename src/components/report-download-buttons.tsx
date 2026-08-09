"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { generatePdfReport, generateStockPdfReport } from "@/lib/pdf";

export function ReportDownloadButtons({ mrId }: { mrId: string }) {
	const searchParams = useSearchParams();
	const division = searchParams.get("division") || "All";
	const defaultFrom = searchParams.get("from") || "";
	const defaultTo = searchParams.get("to") || "";
	const product = searchParams.get("product") || "";
	const currentTab = searchParams.get("tab");

	const [isOpen, setIsOpen] = useState(false);
	const [format, setFormat] = useState<"csv" | "excel" | "pdf">("csv");
	const [from, setFrom] = useState(defaultFrom);
	const [to, setTo] = useState(defaultTo);
	const [isDownloading, setIsDownloading] = useState(false);

	const openModal = (fmt: "csv" | "excel" | "pdf") => {
		setFormat(fmt);
		setFrom(defaultFrom);
		setTo(defaultTo);
		setIsOpen(true);
	};

	const handleDownload = async () => {
		setIsDownloading(true);
		const params = new URLSearchParams();
		params.set("mrId", mrId);
		params.set("company", division);
		if (from) params.set("from", from);
		if (to) params.set("to", to);
		if (product) params.set("product", product);

		const isFreeScheme = currentTab === "free-schemes";

		if (format === "pdf") {
			params.set("format", "json");
			try {
				let endpoint = "/api/reports/download"; // free schemes
				if (currentTab === "stock") endpoint = "/api/reports/download-stock";
				else if (currentTab === "sales" || currentTab === "products") {
					endpoint = "/api/reports/download-sales";
					params.set("tab", currentTab);
				}

				const res = await fetch(`${endpoint}?${params.toString()}`);
				if (!res.ok) throw new Error("Failed to fetch data");
				const data = await res.json();

				if (currentTab === "stock") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";
					generateStockPdfReport(
						`Stock_Report_${division}_${new Date().toISOString().split("T")[0]}.pdf`,
						data,
						mrName,
						from,
						to,
					);
				} else if (currentTab === "sales") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";

					const columns = [
						{ header: "Doctor / Party", dataKey: "Doctor / Party" },
						{ header: "Product Name", dataKey: "Product Name" },
						{ header: "Date", dataKey: "Date" },
						{ header: "Sale Qty", dataKey: "Sale Qty" },
						{ header: "Free Qty", dataKey: "Free Qty" },
						{ header: "Amount", dataKey: "Amount" },
					];

					import("@/lib/pdf").then(({ generateGroupedPdfReport }) => {
						generateGroupedPdfReport(
							`Sales Movement Statement`,
							`Sales_Report_${division}_${new Date().toISOString().split("T")[0]}.pdf`,
							data,
							columns as any,
							mrName,
							from,
							to,
						);
					});
				} else if (currentTab === "products") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";

					const columns = [
						{ header: "Product Name", dataKey: "Product Name" },
						{ header: "Free Scheme", dataKey: "Free Scheme" },
						{ header: "Current Stock", dataKey: "Current Stock" },
						{ header: "Total Sales Qty", dataKey: "Total Sales Qty" },
						{ header: "Total Sales Amt", dataKey: "Total Sales Amt" },
					];

					import("@/lib/pdf").then(({ generateGroupedPdfReport }) => {
						generateGroupedPdfReport(
							`Product Wise Statement`,
							`Product_Report_${division}_${new Date().toISOString().split("T")[0]}.pdf`,
							data,
							columns as any,
							mrName,
							from,
							to,
						);
					});
				} else {
					// Free Scheme (default)
					const filteredData = product
						? data.filter((row: any) => row["Product Name"] === product)
						: data;

					const mrName =
						filteredData.length > 0 ? filteredData[0]["MR Name"] : "Unknown";

					const cleanDataForPdf = filteredData.map((row: any) => {
						const { "MR Name": _, "Generated At": __, ...rest } = row;
						return rest;
					});

					generatePdfReport(
						`Free Scheme Report (${division})`,
						`Free_Scheme_${division}_${new Date().toISOString().split("T")[0]}.pdf`,
						cleanDataForPdf,
						mrName,
					);
				}
			} catch (e) {
				console.error(e);
				alert("Failed to generate PDF");
			}
		} else {
			params.set("format", format);
			let endpoint = "/api/reports/download"; // free schemes
			if (currentTab === "sales" || currentTab === "products") {
				endpoint = "/api/reports/download-sales";
				params.set("tab", currentTab);
			} else if (currentTab === "stock") {
				endpoint = "/api/reports/download-stock";
			}
			window.location.href = `${endpoint}?${params.toString()}`;
		}

		setIsDownloading(false);
		setIsOpen(false);
	};

	return (
		<>
			{/* Unified Corporate Blue Tonal Export Button Family */}
			<div className="flex gap-2">
				<button
					className="flex h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#BAE6FD] bg-[#E0F2FE] px-4 py-2 font-bold text-[#0071BC] text-sm transition-colors hover:bg-[#BAE6FD]"
					onClick={() => openModal("csv")}
					title="Download Product Report (CSV)"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2.5"
						></path>
					</svg>
					CSV
				</button>

				<button
					className="flex h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#0071BC] px-4 py-2 font-bold text-sm text-white shadow-sm transition-colors hover:bg-[#134074]"
					onClick={() => openModal("excel")}
					title="Download Product Report (Excel)"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2.5"
						></path>
					</svg>
					Excel
				</button>

				<button
					className="flex h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#0B2545] px-4 py-2 font-bold text-sm text-white shadow-sm transition-colors hover:bg-[#1E293B]"
					onClick={() => openModal("pdf")}
					title="Download Product Report (PDF)"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2.5"
						></path>
					</svg>
					PDF
				</button>
			</div>

			{/* Prompt Dialog Window */}
			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
					<div className="fade-in zoom-in-95 w-full max-w-sm animate-in rounded-xl border border-gray-200/80 bg-white p-6 shadow-xl duration-200">
						<h3 className="mb-2 font-extrabold text-[#0B2545] text-xl">
							Download {format.toUpperCase()} Report
						</h3>
						<p className="mb-6 font-medium text-gray-500 text-sm">
							Select the date range for your report. Leave blank to download all
							available data.
						</p>

						<div className="space-y-4">
							<div>
								<label className="mb-2 block font-bold text-[#0B2545] text-sm">
									From Date
								</label>
								<input
									className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 font-medium text-[#0B2545] text-base outline-none transition-colors focus:border-[#0071BC]"
									onChange={(e) => setFrom(e.target.value)}
									type="date"
									value={from}
								/>
							</div>
							<div>
								<label className="mb-2 block font-bold text-[#0B2545] text-sm">
									To Date
								</label>
								<input
									className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 font-medium text-[#0B2545] text-base outline-none transition-colors focus:border-[#0071BC]"
									onChange={(e) => setTo(e.target.value)}
									type="date"
									value={to}
								/>
							</div>
						</div>

						<div className="mt-8 flex gap-3">
							<button
								className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
								disabled={isDownloading}
								onClick={() => setIsOpen(false)}
							>
								Cancel
							</button>
							<button
								className="flex flex-1 items-center justify-center rounded-xl bg-[#0071BC] px-4 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-[#134074] disabled:opacity-50"
								disabled={isDownloading}
								onClick={handleDownload}
							>
								{isDownloading ? "..." : "Confirm"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
