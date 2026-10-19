"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getDefaultTMinus1MonthRange } from "@/lib/dateUtils";
import {
	generateFreeSchemePdfReport,
	generatePartyWisePdfReport,
	generateProductPdfReport,
	generateSalesPdfReport,
	generateStockAndSalesPdfReport,
	generateStockPdfReport,
} from "@/lib/pdf";

export function ReportDownloadButtons({
	mrId,
	activeTab,
}: {
	mrId: string;
	activeTab?: string;
}) {
	const searchParams = useSearchParams();
	const division = searchParams.get("division") || "All";
	const tMinus1 = getDefaultTMinus1MonthRange();
	const defaultFrom = searchParams.get("from") || tMinus1.from;
	const defaultTo = searchParams.get("to") || tMinus1.to;
	const product = searchParams.get("product") || "";
	const currentTab = activeTab || searchParams.get("tab") || "stock";

	const [isOpen, setIsOpen] = useState(false);
	const [format, setFormat] = useState<"csv" | "excel" | "pdf" | "print">(
		"csv",
	);
	const [from, setFrom] = useState(defaultFrom);
	const [to, setTo] = useState(defaultTo);
	const [isDownloading, setIsDownloading] = useState(false);

	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const openModal = (fmt: "csv" | "excel" | "pdf" | "print") => {
		setFormat(fmt);
		const currentUrlFrom = searchParams.get("from");
		const currentUrlTo = searchParams.get("to");
		if (fmt === "pdf" || fmt === "print") {
			const t1 = getDefaultTMinus1MonthRange();
			setFrom(currentUrlFrom || t1.from);
			setTo(currentUrlTo || t1.to);
		} else {
			setFrom(currentUrlFrom || defaultFrom);
			setTo(currentUrlTo || defaultTo);
		}
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

		if (format === "pdf" || format === "print") {
			params.set("format", "json");
			try {
				let endpoint = "/api/reports/download-sales";
				if (currentTab === "stock") {
					endpoint = "/api/reports/download-stock";
				} else {
					endpoint = "/api/reports/download-sales";
					params.set("tab", currentTab);
				}

				const res = await fetch(`${endpoint}?${params.toString()}`);
				if (!res.ok) throw new Error("Failed to fetch data");
				const serverDateStr = res.headers.get("date") || undefined;
				const data = await res.json();

				const safeDivision = division.replace(/[^a-zA-Z0-9]/g, "_");

				let formattedFromForFilename = from;
				let formattedToForFilename = to;
				let displayFrom = from;
				let displayTo = to;

				if (from) {
					const parts = from.split("-");
					if (parts.length === 3) {
						formattedFromForFilename = `${parts[2]}_${parts[1]}_${parts[0]}`;
						displayFrom = `${parts[2]}-${parts[1]}-${parts[0]}`;
					}
				}
				if (to) {
					const parts = to.split("-");
					if (parts.length === 3) {
						formattedToForFilename = `${parts[2]}_${parts[1]}_${parts[0]}`;
						displayTo = `${parts[2]}-${parts[1]}-${parts[0]}`;
					}
				}

				let fromToSuffix = "";
				if (formattedFromForFilename && formattedToForFilename)
					fromToSuffix = `_${formattedFromForFilename}_${formattedToForFilename}`;
				else if (formattedFromForFilename)
					fromToSuffix = `_${formattedFromForFilename}`;
				else if (formattedToForFilename)
					fromToSuffix = `_${formattedToForFilename}`;

				if (currentTab === "stock-and-sales") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";
					const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
					await generateStockAndSalesPdfReport(
						`${safeMrName}_${safeDivision}_stock_and_sales${fromToSuffix}.pdf`,
						data,
						mrName,
						displayFrom,
						displayTo,
						format === "print" ? "print" : "download",
						serverDateStr,
					);
				} else if (currentTab === "stock") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";
					const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
					await generateStockPdfReport(
						`${safeMrName}_${safeDivision}_stock${fromToSuffix}.pdf`,
						data,
						mrName,
						displayFrom,
						displayTo,
						format === "print" ? "print" : "download",
						serverDateStr,
					);
				} else if (currentTab === "sales" || currentTab === "new-sales") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";
					const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
					await generateSalesPdfReport(
						`${safeMrName}_${safeDivision}_sales${fromToSuffix}.pdf`,
						data,
						mrName,
						displayFrom,
						displayTo,
						format === "print" ? "print" : "download",
						serverDateStr,
					);
				} else if (currentTab === "party") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";
					const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
					await generatePartyWisePdfReport(
						`${safeMrName}_${safeDivision}_party_sales${fromToSuffix}.pdf`,
						data,
						mrName,
						displayFrom,
						displayTo,
						format === "print" ? "print" : "download",
						serverDateStr,
					);
				} else if (currentTab === "products") {
					const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";
					const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
					await generateProductPdfReport(
						`${safeMrName}_${safeDivision}_products${fromToSuffix}.pdf`,
						data,
						mrName,
						displayFrom,
						displayTo,
						format === "print" ? "print" : "download",
						serverDateStr,
					);
				} else {
					// Free Scheme (default)
					const filteredData = product
						? data.filter((row: any) => row["Product Name"] === product)
						: data;

					const mrName =
						filteredData.length > 0 ? filteredData[0]["MR Name"] : "Unknown";
					const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");

					await generateFreeSchemePdfReport(
						`${safeMrName}_${safeDivision}_free_schemes${fromToSuffix}.pdf`,
						filteredData,
						mrName,
						displayFrom,
						displayTo,
						format === "print" ? "print" : "download",
						serverDateStr,
					);
				}
			} catch (e) {
				console.error(e);
				alert("Failed to generate PDF");
			}
		} else {
			params.set("format", format);
			let endpoint = "/api/reports/download-sales";
			if (currentTab === "stock") {
				endpoint = "/api/reports/download-stock";
			} else {
				endpoint = "/api/reports/download-sales";
				params.set("tab", currentTab);
			}
			window.location.href = `${endpoint}?${params.toString()}`;
		}

		setIsDownloading(false);
		setIsOpen(false);
	};

	const getReportLabel = () => {
		switch (currentTab) {
			case "stock":
				return "Stock Movement Statement";
			case "stock-and-sales":
				return "Stock & Sales Statement";
			case "sales":
			case "new-sales":
				return "Sales & Invoicing Details";
			case "party":
				return "Partywise Sales Statement";
			case "products":
				return "Productwise Sales Statement";
			case "free-schemes":
				return "Claim Quantity Statement";
			default:
				return "Report";
		}
	};

	return (
		<>
			{/* Unified Corporate Blue Tonal Export Button Family */}
			<div className="flex flex-wrap gap-2">
				<button
					className="flex h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#BAE6FD] bg-[#E0F2FE] px-4 py-2 font-bold text-[#0071BC] text-sm transition-colors hover:bg-[#BAE6FD]"
					onClick={() => openModal("csv")}
					title={`Download ${getReportLabel()} (CSV)`}
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
					title={`Download ${getReportLabel()} (Excel)`}
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
					title={`Download ${getReportLabel()} (PDF)`}
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

				<button
					className="flex h-[38px] items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 text-sm transition-colors hover:bg-gray-50"
					onClick={() => openModal("print")}
					title={`Print ${getReportLabel()}`}
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2.5"
						></path>
					</svg>
					Print
				</button>
			</div>

			{/* Prompt Dialog Window via Portal */}
			{isOpen &&
				mounted &&
				createPortal(
					<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
						{/* Dark Full-Screen Backdrop with Real Blur */}
						<div
							className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200"
							onClick={() => setIsOpen(false)}
						/>

						{/* Centered Modal Card */}
						<div className="fade-in zoom-in-95 relative z-10 w-full max-w-sm animate-in rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xl duration-200">
							<h3 className="mb-2 font-extrabold text-[#0B2545] text-xl">
								Download {format.toUpperCase()} Report
							</h3>
							<p className="mb-6 font-medium text-gray-500 text-sm">
								Export {getReportLabel()} for the selected period.
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
					</div>,
					document.body,
				)}
		</>
	);
}
