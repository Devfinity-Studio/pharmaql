"use client";

import { useState } from "react";
import type { ImpendingBlockInvoice } from "@/lib/overdueUtils";

interface Props {
	mrName: string;
	divisionName?: string;
	invoices: ImpendingBlockInvoice[];
}

export function MROverdueWarningModal({
	mrName,
	divisionName,
	invoices,
}: Props) {
	const [isOpen, setIsOpen] = useState(true);

	if (!isOpen || invoices.length === 0) return null;

	const worst = [...invoices].sort((a, b) => b.overDays - a.overDays)[0]!;
	const totalPending = invoices.reduce((sum, i) => sum + i.amount, 0);

	return (
		<div className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
			<div className="w-full max-w-xl rounded-2xl border-2 border-amber-400 bg-white p-6 shadow-2xl sm:p-8">
				<div className="flex items-start gap-4">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 font-black text-2xl text-amber-600">
						⚠️
					</div>
					<div className="flex-1">
						<div className="inline-block rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800 text-xs uppercase tracking-wider">
							Impending Block Notice (80–90 Days)
						</div>
						<h2 className="mt-2 font-extrabold text-2xl text-gray-900 tracking-tight">
							Payment Pending Warning
						</h2>
						<p className="mt-1 font-medium text-gray-600 text-sm">
							Hello <span className="font-bold text-gray-900">{mrName}</span>,
							your account has pending invoices that are nearing the 90-day
							automatic block threshold.
						</p>
					</div>
				</div>

				{/* Impending Block Alert Banner */}
				<div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
					<div className="flex items-baseline justify-between font-bold text-sm">
						<span>Total Approaching Block:</span>
						<span className="font-extrabold text-lg text-red-700">
							₹
							{totalPending.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</span>
					</div>
					<p className="mt-2 text-red-800 text-xs leading-relaxed">
						<strong>Critical Deadline:</strong> Your account and division (
						<span className="font-semibold">
							{divisionName || "Assigned Division"}
						</span>
						) will be{" "}
						<strong className="underline">
							automatically blocked on {worst.autoBlockDate}
						</strong>{" "}
						if payment is not cleared.
					</p>
				</div>

				{/* Invoice Breakdown */}
				<div className="mt-4 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 text-xs">
					{invoices.map((inv, idx) => (
						<div
							className="flex items-center justify-between p-3 hover:bg-gray-50"
							key={idx}
						>
							<div>
								<div className="font-bold text-gray-900">{inv.invoiceNo}</div>
								<div className="text-gray-500">
									{inv.customer} &bull; Inv Date: {inv.docDate}
								</div>
							</div>
							<div className="text-right">
								<div className="font-bold text-amber-700">
									₹{inv.amount.toFixed(2)}
								</div>
								<div className="font-bold text-red-600">
									{inv.overDays} Days Overdue
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<button
						className="w-full rounded-xl bg-gray-900 px-6 py-2.5 font-bold text-sm text-white shadow transition hover:bg-gray-800 sm:w-auto"
						onClick={() => setIsOpen(false)}
						type="button"
					>
						I Understand & Acknowledge
					</button>
				</div>
			</div>
		</div>
	);
}
