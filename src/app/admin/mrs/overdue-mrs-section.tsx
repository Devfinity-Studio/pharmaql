import React from "react";
import Link from "next/link";
import { AdminUnblockModal } from "./unblock-modal";
import type { MROverdueEvaluation } from "@/server/actions/overdueEngine";

interface Props {
	evaluations: MROverdueEvaluation[];
}

export function OverdueMRsSection({ evaluations }: Props) {
	const aboutToOverdue = evaluations.filter((e) => e.status === "WARNING");
	const directBlocked = evaluations.filter((e) => e.status === "DIRECT_BLOCKED");
	const divisionBlocked = evaluations.filter((e) => e.status === "DIVISION_BLOCKED");
	const totalAlertCount = aboutToOverdue.length + directBlocked.length + divisionBlocked.length;

	if (totalAlertCount === 0) return null;

	return (
		<div className="space-y-6 rounded-2xl border-2 border-red-200 bg-red-50/40 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-red-200 pb-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-xl">🚨</span>
						<h2 className="font-extrabold text-xl text-red-950">
							Overdue MRs & Division Access Control Center
						</h2>
					</div>
					<p className="mt-1 text-xs text-red-800">
						Automatic enforcement based on live ERP outstandings. MRs with pending payments &gt;90 days and their division colleagues are automatically blocked.
					</p>
				</div>
				<div className="flex gap-2 text-xs font-bold">
					<span className="rounded-lg bg-amber-100 px-3 py-1 text-amber-800 border border-amber-300">
						80–90d Warning: {aboutToOverdue.length}
					</span>
					<span className="rounded-lg bg-red-100 px-3 py-1 text-red-800 border border-red-300">
						Direct Blocked: {directBlocked.length}
					</span>
					<span className="rounded-lg bg-purple-100 px-3 py-1 text-purple-800 border border-purple-300">
						Division Blocked: {divisionBlocked.length}
					</span>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* 1. About to Overdue (80-90 Days) */}
				<div className="rounded-xl border border-amber-300 bg-white p-4 shadow-sm flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="font-extrabold text-sm text-amber-900 flex items-center gap-1.5">
								<span>⏳</span> About to Overdue (80–90d)
							</h3>
							<span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800 text-xs">
								{aboutToOverdue.length} MRs
							</span>
						</div>
						<p className="mt-1 text-[11px] text-gray-500">
							MRs receiving warning popups with impending block countdowns.
						</p>

						<div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
							{aboutToOverdue.length === 0 ? (
								<p className="text-gray-400 text-xs italic py-2">No MRs currently in 80–90 day range.</p>
							) : (
								aboutToOverdue.map((mr) => {
									const worst = mr.warningInvoices[0];
									return (
										<div key={mr.mrId} className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-xs">
											<div className="flex justify-between items-baseline">
												<Link href={`/admin/mrs/${mr.mrId}`} className="font-bold text-gray-900 hover:text-blue-600 underline">
													{mr.mrName}
												</Link>
												<span className="font-extrabold text-amber-700">₹{mr.totalPendingAmt.toFixed(2)}</span>
											</div>
											<div className="mt-1 text-[11px] text-gray-600 flex justify-between">
												<span>Division: {mr.divisionName || "N/A"}</span>
												<span className="font-semibold text-red-600">{mr.oldestDays} Days Overdue</span>
											</div>
											{worst && (
												<div className="mt-1.5 text-[10px] text-amber-800 bg-amber-100/70 p-1 rounded font-medium">
													Auto-blocks on: <span className="font-bold">{worst.autoBlockDate}</span> (Inv {worst.invoiceNo})
												</div>
											)}
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>

				{/* 2. Directly Overdue (>90 Days) */}
				<div className="rounded-xl border border-red-300 bg-white p-4 shadow-sm flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="font-extrabold text-sm text-red-900 flex items-center gap-1.5">
								<span>🚫</span> Direct Overdue Blocked (&gt;90d)
							</h3>
							<span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-800 text-xs">
								{directBlocked.length} MRs
							</span>
						</div>
						<p className="mt-1 text-[11px] text-gray-500">
							MRs with overdue &gt;90 days. Login rejected and cascading triggered.
						</p>

						<div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
							{directBlocked.length === 0 ? (
								<p className="text-gray-400 text-xs italic py-2">No MRs directly blocked.</p>
							) : (
								directBlocked.map((mr) => (
									<div key={mr.mrId} className="rounded-lg border border-red-200 bg-red-50/60 p-2.5 text-xs space-y-1.5">
										<div className="flex justify-between items-baseline">
											<Link href={`/admin/mrs/${mr.mrId}`} className="font-bold text-gray-900 hover:text-blue-600 underline">
												{mr.mrName}
											</Link>
											<span className="font-black text-red-700">₹{mr.totalPendingAmt.toFixed(2)}</span>
										</div>
										<div className="text-[11px] text-gray-600 flex justify-between">
											<span>Division: {mr.divisionName || "N/A"}</span>
											<span className="font-black text-red-700">{mr.oldestDays} Days Overdue</span>
										</div>
										<div className="pt-1 flex justify-end">
											<AdminUnblockModal
												mrId={mr.mrId}
												mrName={mr.mrName}
												statusLabel={`Direct Overdue (${mr.oldestDays}d - ₹${mr.totalPendingAmt.toFixed(2)})`}
											/>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				{/* 3. Division Blocked (Cascaded) */}
				<div className="rounded-xl border border-purple-300 bg-white p-4 shadow-sm flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="font-extrabold text-sm text-purple-950 flex items-center gap-1.5">
								<span>🔒</span> Division Blocked (Collateral)
							</h3>
							<span className="rounded-full bg-purple-100 px-2 py-0.5 font-bold text-purple-800 text-xs">
								{divisionBlocked.length} MRs
							</span>
						</div>
						<p className="mt-1 text-[11px] text-gray-500">
							MRs suspended because a colleague in their division exceeded 90 days.
						</p>

						<div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
							{divisionBlocked.length === 0 ? (
								<p className="text-gray-400 text-xs italic py-2">No division collateral blocks active.</p>
							) : (
								divisionBlocked.map((mr) => (
									<div key={mr.mrId} className="rounded-lg border border-purple-200 bg-purple-50/60 p-2.5 text-xs space-y-1.5">
										<div className="flex justify-between items-baseline">
											<Link href={`/admin/mrs/${mr.mrId}`} className="font-bold text-gray-900 hover:text-blue-600 underline">
												{mr.mrName}
											</Link>
											<span className="rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-bold text-purple-900">
												{mr.divisionName}
											</span>
										</div>
										<div className="rounded bg-white p-1.5 text-[11px] text-gray-700 border border-purple-100">
											Blocked by: <span className="font-bold text-red-700">{mr.responsibleMrName}</span> (Inv {mr.responsibleInvoiceNo || "N/A"})
										</div>
										<div className="pt-1 flex justify-end">
											<AdminUnblockModal
												mrId={mr.mrId}
												mrName={mr.mrName}
												statusLabel={`Division Blocked by ${mr.responsibleMrName}`}
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
