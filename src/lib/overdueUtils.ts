import type { OverduePeriodicalOutstandingRow } from "@/server/actions/overdueReports";

export interface ImpendingBlockInvoice {
	invoiceNo: string;
	customer: string;
	docDate: string;
	dueDate?: string;
	amount: number;
	overDays: number;
	autoBlockDate: string; // Date string when overDays reaches 91
}

/**
 * Calculates date string when invoice overdue reaches 91 days.
 */
export function calculateBlockDate(
	docDateStr: string | Date,
	currentOverDays: number,
): string {
	const base = new Date(docDateStr);
	if (isNaN(base.getTime())) {
		const target = new Date();
		target.setDate(target.getDate() + Math.max(0, 91 - currentOverDays));
		return target.toISOString().split("T")[0]!;
	}
	const blockDate = new Date();
	const daysRemaining = Math.max(0, 91 - currentOverDays);
	blockDate.setDate(blockDate.getDate() + daysRemaining);
	return blockDate.toISOString().split("T")[0]!;
}

/**
 * Pure evaluation helper for invoice overdue calculations:
 * - Aggregates net pending amounts
 * - Finds warning invoices (80-90 days)
 * - Finds blocking invoices (>90 days)
 */
export function evaluateOverdueInvoices(rows: OverduePeriodicalOutstandingRow[]): {
	totalPendingAmt: number;
	oldestDays: number;
	warningInvoices: ImpendingBlockInvoice[];
	blockingInvoices: ImpendingBlockInvoice[];
} {
	let totalPendingAmt = 0;
	let oldestDays = 0;
	const warningInvoices: ImpendingBlockInvoice[] = [];
	const blockingInvoices: ImpendingBlockInvoice[] = [];

	rows.forEach((r) => {
		const amt = Number(r.Amount || 0);
		const adj = Number(r.AdjAmt || 0);
		const net = amt - adj;

		if (net > 0) {
			totalPendingAmt += net;
			const days = Number(r.OverDays || 0);
			if (days > oldestDays) oldestDays = days;

			const docDateStr = r.DocDate
				? new Date(r.DocDate).toISOString().split("T")[0]!
				: "";
			const invItem: ImpendingBlockInvoice = {
				invoiceNo: r.DocNo || r.AgainstNo || `INV-${r.ID}`,
				customer: r.Customer || "Unknown Customer",
				docDate: docDateStr,
				dueDate: r.DueDate ? String(r.DueDate).split("T")[0] : undefined,
				amount: net,
				overDays: days,
				autoBlockDate: calculateBlockDate(r.DocDate, days),
			};

			if (days > 90) {
				blockingInvoices.push(invItem);
			} else if (days >= 80 && days <= 90) {
				warningInvoices.push(invItem);
			}
		}
	});

	return {
		totalPendingAmt,
		oldestDays,
		warningInvoices,
		blockingInvoices,
	};
}
