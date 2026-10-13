"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { MROverdueEvaluation } from "@/server/actions/overdueEngine";
import { getOverdueEvaluationsSummary } from "@/server/actions/overdueEngine";
import { AdminUnblockModal } from "./unblock-modal";

interface Props {
	initialEvaluations?: MROverdueEvaluation[];
}

export function OverdueMRsSection({ initialEvaluations }: Props) {
	const [evaluations, setEvaluations] = useState<MROverdueEvaluation[] | null>(
		initialEvaluations && initialEvaluations.length > 0
			? initialEvaluations
			: null,
	);
	const [isPending, startTransition] = useTransition();
	const [hasScanned, setHasScanned] = useState(
		Boolean(initialEvaluations && initialEvaluations.length > 0),
	);

	function handleScan() {
		startTransition(async () => {
			try {
				const res = await getOverdueEvaluationsSummary();
				setEvaluations(res);
				setHasScanned(true);
			} catch (err) {
				console.error("Failed to scan overdue MRs", err);
			}
		});
	}

	if (!hasScanned) {
		return (
			<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm">
				<div className="flex items-center gap-3">
					<span className="text-xl">🚨</span>
					<div>
						<h2 className="font-extrabold text-red-950 text-sm">
							Overdue MRs & Division Access Control Center
						</h2>
						<p className="text-red-700 text-xs">
							Automated enforcement based on live ERP outstandings. Scan
							divisions for &gt;90d overdue blocks and collateral suspensions.
						</p>
					</div>
				</div>
				<button
					className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white text-xs shadow-sm transition hover:bg-red-700 disabled:opacity-50"
					disabled={isPending}
					onClick={handleScan}
					type="button"
				>
					{isPending ? "Scanning Live ERP..." : "Scan Division Overdues"}
				</button>
			</div>
		);
	}

	const activeEvals = evaluations || [];
	const aboutToOverdue = activeEvals.filter((e) => e.status === "WARNING");
	const directBlocked = activeEvals.filter(
		(e) => e.status === "DIRECT_BLOCKED",
	);
	const divisionBlocked = activeEvals.filter(
		(e) => e.status === "DIVISION_BLOCKED",
	);
	const totalAlertCount =
		aboutToOverdue.length + directBlocked.length + divisionBlocked.length;

	if (totalAlertCount === 0) {
		return (
			<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
				<div className="flex items-center gap-3">
					<span className="text-xl">✓</span>
					<div>
						<h2 className="font-extrabold text-emerald-950 text-sm">
							All Divisions In Good Standing
						</h2>
						<p className="text-emerald-700 text-xs">
							Zero active payment overdues (&gt;80d) detected across all MR
							accounts.
						</p>
					</div>
				</div>
				<button
					className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 font-bold text-emerald-800 text-xs shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
					disabled={isPending}
					onClick={handleScan}
					type="button"
				>
					{isPending ? "Re-scanning..." : "Refresh Status"}
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-6 rounded-2xl border-2 border-red-200 bg-red-50/40 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4 border-red-200 border-b pb-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-xl">🚨</span>
						<h2 className="font-extrabold text-red-950 text-xl">
							Overdue MRs & Division Access Control Center
						</h2>
					</div>
					<p className="mt-1 text-red-800 text-xs">
						Automatic enforcement based on live ERP outstandings. MRs with
						pending payments &gt;90 days and their division colleagues are
						automatically blocked.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 font-bold text-xs">
					<span className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1 text-amber-800">
						80–90d Warning: {aboutToOverdue.length}
					</span>
					<span className="rounded-lg border border-red-300 bg-red-100 px-3 py-1 text-red-800">
						Direct Blocked: {directBlocked.length}
					</span>
					<span className="rounded-lg border border-purple-300 bg-purple-100 px-3 py-1 text-purple-800">
						Division Blocked: {divisionBlocked.length}
					</span>
					<button
						className="ml-2 rounded-lg border border-red-300 bg-white px-3 py-1 font-bold text-red-700 text-xs hover:bg-red-50 disabled:opacity-50"
						disabled={isPending}
						onClick={handleScan}
						type="button"
					>
						{isPending ? "Scanning..." : "Re-scan"}
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* 1. About to Overdue (80-90 Days) */}
				<div className="flex flex-col justify-between rounded-xl border border-amber-300 bg-white p-4 shadow-sm">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="flex items-center gap-1.5 font-extrabold text-amber-900 text-sm">
								<span>⏳</span> About to Overdue (80–90d)
							</h3>
							<span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800 text-xs">
								{aboutToOverdue.length} MRs
							</span>
						</div>
						<p className="mt-1 text-[11px] text-gray-500">
							MRs receiving warning popups with impending block countdowns.
						</p>

						<div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto">
							{aboutToOverdue.length === 0 ? (
								<p className="py-2 text-gray-400 text-xs italic">
									No MRs currently in 80–90 day range.
								</p>
							) : (
								aboutToOverdue.map((mr) => {
									const worst = mr.warningInvoices[0];
									return (
										<div
											className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-xs"
											key={mr.mrId}
										>
											<div className="flex items-baseline justify-between">
												<Link
													className="font-bold text-gray-900 underline hover:text-blue-600"
													href={`/admin/mrs/${mr.mrId}`}
												>
													{mr.mrName}
												</Link>
												<span className="font-extrabold text-amber-700">
													₹{mr.totalPendingAmt.toFixed(2)}
												</span>
											</div>
											<div className="mt-1 flex justify-between text-[11px] text-gray-600">
												<span>Division: {mr.divisionName || "N/A"}</span>
												<span className="font-semibold text-red-600">
													{mr.oldestDays} Days Overdue
												</span>
											</div>
											{worst && (
												<div className="mt-1.5 rounded bg-amber-100/70 p-1 font-medium text-[10px] text-amber-800">
													Auto-blocks on:{" "}
													<span className="font-bold">
														{worst.autoBlockDate}
													</span>{" "}
													(Invoice {worst.invoiceNo})
												</div>
											)}
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>

				{/* 2. Direct Blocked (>90 Days) */}
				<div className="flex flex-col justify-between rounded-xl border border-red-300 bg-white p-4 shadow-sm">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="flex items-center gap-1.5 font-extrabold text-red-900 text-sm">
								<span>🛑</span> Direct Blocked (&gt;90d)
							</h3>
							<span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-800 text-xs">
								{directBlocked.length} MRs
							</span>
						</div>
						<p className="mt-1 text-[11px] text-gray-500">
							MRs with their own invoices exceeding the 90-day threshold.
						</p>

						<div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto">
							{directBlocked.length === 0 ? (
								<p className="py-2 text-gray-400 text-xs italic">
									No MRs directly blocked.
								</p>
							) : (
								directBlocked.map((mr) => {
									const worst = mr.blockingInvoices[0];
									return (
										<div
											className="rounded-lg border border-red-200 bg-red-50/60 p-2.5 text-xs"
											key={mr.mrId}
										>
											<div className="flex items-baseline justify-between">
												<Link
													className="font-bold text-gray-900 underline hover:text-red-700"
													href={`/admin/mrs/${mr.mrId}`}
												>
													{mr.mrName}
												</Link>
												<span className="font-extrabold text-red-700">
													₹{mr.totalPendingAmt.toFixed(2)}
												</span>
											</div>
											<div className="mt-1 flex justify-between text-[11px] text-gray-600">
												<span>Division: {mr.divisionName || "N/A"}</span>
												<span className="font-bold text-red-700">
													{mr.oldestDays} Days Overdue
												</span>
											</div>
											{worst && (
												<div className="mt-1 text-[10px] text-gray-500">
													Blocked since invoice {worst.invoiceNo} (₹
													{worst.amount.toFixed(2)})
												</div>
											)}
											<div className="mt-2">
												<AdminUnblockModal
													mrId={mr.mrId}
													mrName={mr.mrName}
													statusLabel="Direct Overdue Block"
												/>
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>

				{/* 3. Division Blocked (Collateral) */}
				<div className="flex flex-col justify-between rounded-xl border border-purple-300 bg-white p-4 shadow-sm">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="flex items-center gap-1.5 font-extrabold text-purple-900 text-sm">
								<span>🔗</span> Division Blocked (Collateral)
							</h3>
							<span className="rounded-full bg-purple-100 px-2 py-0.5 font-bold text-purple-800 text-xs">
								{divisionBlocked.length} MRs
							</span>
						</div>
						<p className="mt-1 text-[11px] text-gray-500">
							MRs suspended because a colleague in their division exceeded 90
							days.
						</p>

						<div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto">
							{divisionBlocked.length === 0 ? (
								<p className="py-2 text-gray-400 text-xs italic">
									No division collateral blocks.
								</p>
							) : (
								divisionBlocked.map((mr) => (
									<div
										className="rounded-lg border border-purple-200 bg-purple-50/60 p-2.5 text-xs"
										key={mr.mrId}
									>
										<div className="flex items-baseline justify-between">
											<Link
												className="font-bold text-gray-900 underline hover:text-purple-700"
												href={`/admin/mrs/${mr.mrId}`}
											>
												{mr.mrName}
											</Link>
											<span className="rounded bg-purple-200 px-1.5 py-0.5 font-bold text-[10px] text-purple-800">
												Collateral
											</span>
										</div>
										<div className="mt-1 text-[11px] text-gray-600">
											Division:{" "}
											<span className="font-semibold">{mr.divisionName}</span>
										</div>
										{mr.responsibleMrName && (
											<div className="mt-1 text-[10px] text-purple-800">
												Suspended by:{" "}
												<span className="font-bold">
													{mr.responsibleMrName}
												</span>
												{mr.responsibleInvoiceNo &&
													` (Inv: ${mr.responsibleInvoiceNo})`}
											</div>
										)}
										<div className="mt-2">
											<AdminUnblockModal
												mrId={mr.mrId}
												mrName={mr.mrName}
												statusLabel="Division Collateral Block"
											/>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
