import Link from "next/link";
import type { MROverdueEvaluation } from "@/server/actions/overdueEngine";
import { AdminUnblockModal } from "./unblock-modal";

interface Props {
	evaluations: MROverdueEvaluation[];
}

export function OverdueMRsSection({ evaluations }: Props) {
	const aboutToOverdue = evaluations.filter((e) => e.status === "WARNING");
	const directBlocked = evaluations.filter(
		(e) => e.status === "DIRECT_BLOCKED",
	);
	const divisionBlocked = evaluations.filter(
		(e) => e.status === "DIVISION_BLOCKED",
	);
	const totalAlertCount =
		aboutToOverdue.length + directBlocked.length + divisionBlocked.length;

	if (totalAlertCount === 0) return null;

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
				<div className="flex gap-2 font-bold text-xs">
					<span className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1 text-amber-800">
						80–90d Warning: {aboutToOverdue.length}
					</span>
					<span className="rounded-lg border border-red-300 bg-red-100 px-3 py-1 text-red-800">
						Direct Blocked: {directBlocked.length}
					</span>
					<span className="rounded-lg border border-purple-300 bg-purple-100 px-3 py-1 text-purple-800">
						Division Blocked: {divisionBlocked.length}
					</span>
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
													(Inv {worst.invoiceNo})
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
				<div className="flex flex-col justify-between rounded-xl border border-red-300 bg-white p-4 shadow-sm">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="flex items-center gap-1.5 font-extrabold text-red-900 text-sm">
								<span>🚫</span> Direct Overdue Blocked (&gt;90d)
							</h3>
							<span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-800 text-xs">
								{directBlocked.length} MRs
							</span>
						</div>
						<p className="mt-1 text-[11px] text-gray-500">
							MRs with overdue &gt;90 days. Login rejected and cascading
							triggered.
						</p>

						<div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto">
							{directBlocked.length === 0 ? (
								<p className="py-2 text-gray-400 text-xs italic">
									No MRs directly blocked.
								</p>
							) : (
								directBlocked.map((mr) => (
									<div
										className="space-y-1.5 rounded-lg border border-red-200 bg-red-50/60 p-2.5 text-xs"
										key={mr.mrId}
									>
										<div className="flex items-baseline justify-between">
											<Link
												className="font-bold text-gray-900 underline hover:text-blue-600"
												href={`/admin/mrs/${mr.mrId}`}
											>
												{mr.mrName}
											</Link>
											<span className="font-black text-red-700">
												₹{mr.totalPendingAmt.toFixed(2)}
											</span>
										</div>
										<div className="flex justify-between text-[11px] text-gray-600">
											<span>Division: {mr.divisionName || "N/A"}</span>
											<span className="font-black text-red-700">
												{mr.oldestDays} Days Overdue
											</span>
										</div>
										<div className="flex justify-end pt-1">
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
				<div className="flex flex-col justify-between rounded-xl border border-purple-300 bg-white p-4 shadow-sm">
					<div>
						<div className="flex items-center justify-between border-b pb-2">
							<h3 className="flex items-center gap-1.5 font-extrabold text-purple-950 text-sm">
								<span>🔒</span> Division Blocked (Collateral)
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
									No division collateral blocks active.
								</p>
							) : (
								divisionBlocked.map((mr) => (
									<div
										className="space-y-1.5 rounded-lg border border-purple-200 bg-purple-50/60 p-2.5 text-xs"
										key={mr.mrId}
									>
										<div className="flex items-baseline justify-between">
											<Link
												className="font-bold text-gray-900 underline hover:text-blue-600"
												href={`/admin/mrs/${mr.mrId}`}
											>
												{mr.mrName}
											</Link>
											<span className="rounded bg-purple-200 px-1.5 py-0.5 font-bold text-[10px] text-purple-900">
												{mr.divisionName}
											</span>
										</div>
										<div className="rounded border border-purple-100 bg-white p-1.5 text-[11px] text-gray-700">
											Blocked by:{" "}
											<span className="font-bold text-red-700">
												{mr.responsibleMrName}
											</span>{" "}
											(Inv {mr.responsibleInvoiceNo || "N/A"})
										</div>
										<div className="flex justify-end pt-1">
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
