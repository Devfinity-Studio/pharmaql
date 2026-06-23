"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { generatePdfReport } from "@/lib/pdf";

export function OutstandingDownloadButtons({ mrId }: { mrId: string }) {
	const searchParams = useSearchParams();
	const division = searchParams.get("division") || "All";
	const defaultFrom = searchParams.get("from") || "";
	const defaultTo = searchParams.get("to") || "";
	const party = searchParams.get("party") || "";

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
		params.set("division", division);
		if (from) params.set("from", from);
		if (to) params.set("to", to);
		if (party) params.set("party", party);

		if (format === "pdf") {
			params.set("format", "json");
			try {
				const res = await fetch(
					`/api/reports/download-outstanding?${params.toString()}`,
				);
				if (!res.ok) throw new Error("Failed to fetch data");
				const data = await res.json();

				// Filter by party if specified
				const filteredData = party
					? data.filter((row: any) => row["Doctor / Party"] === party)
					: data;

				const mrName = data.length > 0 ? data[0]["MR Name"] : "Unknown";

				// Remove MR Name and Generated At from PDF columns since it's in the header
				const cleanDataForPdf = filteredData.map((row: any) => {
					const { "MR Name": _, "Generated At": __, ...rest } = row;
					return rest;
				});

				generatePdfReport(
					`Outstanding Invoices (${division})`,
					`Outstanding_${division}_${new Date().toISOString().split("T")[0]}.pdf`,
					cleanDataForPdf,
					mrName,
				);
			} catch (e) {
				console.error(e);
				alert("Failed to generate PDF");
			}
		} else {
			params.set("format", format);
			window.location.href = `/api/reports/download-outstanding?${params.toString()}`;
		}

		setIsDownloading(false);
		setIsOpen(false);
	};

	return (
		<>
			<div className="flex gap-2">
				<button
					className="flex h-[36px] items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-bold text-rose-700 text-xs transition hover:bg-rose-100"
					onClick={() => openModal("csv")}
					title="Download Outstanding Invoices (CSV)"
				>
					<svg
						className="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
						></path>
					</svg>
					CSV
				</button>
				<button
					className="flex h-[36px] items-center justify-center gap-1.5 rounded-xl border border-rose-700 bg-rose-600 px-3 py-2 font-bold text-white text-xs transition hover:bg-rose-700"
					onClick={() => openModal("excel")}
					title="Download Outstanding Invoices (Excel)"
				>
					<svg
						className="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
						></path>
					</svg>
					Excel
				</button>
				<button
					className="flex h-[36px] items-center justify-center gap-1.5 rounded-xl border border-red-700 bg-red-600 px-3 py-2 font-bold text-white text-xs transition hover:bg-red-700"
					onClick={() => openModal("pdf")}
					title="Download Outstanding Invoices (PDF)"
				>
					<svg
						className="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
						></path>
					</svg>
					PDF
				</button>
			</div>

			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
					<div className="fade-in zoom-in-95 w-full max-w-sm animate-in rounded-2xl bg-white p-6 shadow-xl duration-200">
						<h3 className="mb-2 font-bold text-gray-900 text-xl">
							Download Outstanding {format.toUpperCase()}
						</h3>
						<p className="mb-6 text-gray-500 text-sm">
							Select the date range for your report. Leave blank to download all
							available invoices.
						</p>

						<div className="space-y-4">
							<div>
								<label className="mb-1 block font-bold text-gray-700 text-sm">
									From Invoice Date
								</label>
								<input
									className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900"
									onChange={(e) => setFrom(e.target.value)}
									type="date"
									value={from}
								/>
							</div>
							<div>
								<label className="mb-1 block font-bold text-gray-700 text-sm">
									To Invoice Date
								</label>
								<input
									className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900"
									onChange={(e) => setTo(e.target.value)}
									type="date"
									value={to}
								/>
							</div>
						</div>

						<div className="mt-8 flex gap-3">
							<button
								className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
								disabled={isDownloading}
								onClick={() => setIsOpen(false)}
							>
								Cancel
							</button>
							<button
								className="flex flex-1 items-center justify-center rounded-xl border border-rose-700 bg-rose-600 px-4 py-2.5 font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
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
