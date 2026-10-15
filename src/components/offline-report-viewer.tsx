"use client";

import React, { useEffect, useState } from "react";
import {
	Database,
	HardDrive,
	RefreshCw,
	Search,
	ShieldCheck,
	WifiOff,
	X,
} from "lucide-react";
import { getReportSnapshot } from "@/lib/offline-store";

interface OfflineReportViewerProps {
	mrId: string;
	mrName?: string;
	isOpen: boolean;
	onClose: () => void;
}

const REPORT_TABS = [
	{ id: "stock", label: "Stock Movement" },
	{ id: "sales", label: "Sales & Invoices" },
	{ id: "products", label: "Product Wise" },
	{ id: "party", label: "Party Wise" },
	{ id: "overdue", label: "Outstanding" },
	{ id: "claim", label: "Free Schemes" },
];

export function OfflineReportViewer({
	mrId,
	mrName,
	isOpen,
	onClose,
}: OfflineReportViewerProps) {
	const [activeTab, setActiveTab] = useState("stock");
	const [snapshot, setSnapshot] = useState<{
		data: any;
		cachedAt: string;
		isOfflineSnapshot: true;
	} | null>(null);
	const [loading, setLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		if (!isOpen || !mrId) return;

		let isMounted = true;
		setLoading(true);

		getReportSnapshot(mrId, activeTab).then((res) => {
			if (isMounted) {
				setSnapshot(res);
				setLoading(false);
			}
		});

		return () => {
			isMounted = false;
		};
	}, [isOpen, mrId, activeTab]);

	if (!isOpen) return null;

	// Extract display rows from various data structures
	const rawData = snapshot?.data;
	let rows: any[] = [];
	if (Array.isArray(rawData)) {
		rows = rawData;
	} else if (rawData && typeof rawData === "object") {
		rows = rawData.rows || rawData.items || rawData.data || [];
	}

	const filteredRows = searchQuery.trim()
		? rows.filter((r) =>
				JSON.stringify(r).toLowerCase().includes(searchQuery.toLowerCase()),
			)
		: rows;

	const formattedTime = snapshot?.cachedAt
		? new Date(snapshot.cachedAt).toLocaleString("en-IN", {
				day: "numeric",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-gray-200 bg-[#0B2545] px-6 py-4 text-white">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
							<WifiOff className="h-5 w-5" />
						</div>
						<div>
							<h3 className="font-extrabold text-base">
								Offline Field Snapshots &bull; {mrName || mrId}
							</h3>
							<p className="text-xs text-blue-200">
								Strictly isolated local storage for this MR device. Zero cloud sync required.
							</p>
						</div>
					</div>

					<button
						className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition"
						onClick={onClose}
						type="button"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Tab selector */}
				<div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 px-6 pt-3">
					{REPORT_TABS.map((tab) => (
						<button
							className={`border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
								activeTab === tab.id
									? "border-[#0071BC] text-[#0071BC]"
									: "border-transparent text-gray-500 hover:text-gray-900"
							}`}
							key={tab.id}
							onClick={() => {
								setActiveTab(tab.id);
								setSearchQuery("");
							}}
							type="button"
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Snapshot Status Bar */}
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-6 py-2.5 text-xs">
					<div className="flex items-center gap-2">
						<HardDrive className="h-4 w-4 text-gray-500" />
						{snapshot ? (
							<span className="font-medium text-gray-700" suppressHydrationWarning>
								Cached Snapshot: <strong className="text-gray-900" suppressHydrationWarning>{formattedTime}</strong> ({rows.length} records available offline)
							</span>
						) : (
							<span className="text-gray-500">No offline snapshot saved yet for this report.</span>
						)}
					</div>

					{rows.length > 0 && (
						<div className="relative w-full sm:w-64">
							<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
							<input
								className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400"
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search offline data..."
								type="text"
								value={searchQuery}
							/>
						</div>
					)}
				</div>

				{/* Content Area */}
				<div className="flex-1 overflow-auto p-6">
					{loading ? (
						<div className="flex h-64 items-center justify-center gap-2 text-xs text-gray-500 font-bold">
							<RefreshCw className="h-5 w-5 animate-spin text-[#0071BC]" />
							<span>Loading cached snapshot from device store...</span>
						</div>
					) : !snapshot || rows.length === 0 ? (
						<div className="flex h-64 flex-col items-center justify-center text-center">
							<div className="mb-3 rounded-full bg-gray-100 p-3 text-gray-400">
								<Database className="h-6 w-6" />
							</div>
							<h4 className="font-bold text-gray-800 text-sm">No Offline Snapshot Available</h4>
							<p className="mt-1 max-w-sm text-xs text-gray-500">
								When you are connected, visiting the <strong>{REPORT_TABS.find((t) => t.id === activeTab)?.label}</strong> tab will automatically cache a sanitized snapshot here for offline use.
							</p>
						</div>
					) : (
						<div className="overflow-hidden rounded-xl border border-gray-200">
							<div className="max-h-96 overflow-auto">
								<table className="w-full text-left text-xs font-mono">
									<thead className="sticky top-0 bg-gray-100 font-bold uppercase text-gray-600">
										<tr>
											{Object.keys(filteredRows[0] || {})
												.slice(0, 6)
												.map((col) => (
													<th className="px-3.5 py-2.5" key={col}>
														{col}
													</th>
												))}
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{filteredRows.slice(0, 100).map((row, idx) => (
											<tr className="hover:bg-blue-50/40 transition" key={idx}>
												{Object.keys(filteredRows[0] || {})
													.slice(0, 6)
													.map((col) => (
														<td className="px-3.5 py-2 truncate max-w-xs text-gray-800" key={col}>
															{typeof row[col] === "number"
																? Number(row[col]).toLocaleString()
																: String(row[col] ?? "-")}
														</td>
													))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3 text-xs text-gray-500">
					<div className="flex items-center gap-1.5 text-emerald-700 font-bold">
						<ShieldCheck className="h-4 w-4" />
						<span>Isolated Device Storage &bull; Sanitized & Safe</span>
					</div>
					<button
						className="rounded-xl bg-gray-800 px-4 py-2 font-bold text-white transition hover:bg-gray-900"
						onClick={onClose}
						type="button"
					>
						Close Offline Viewer
					</button>
				</div>
			</div>
		</div>
	);
}
