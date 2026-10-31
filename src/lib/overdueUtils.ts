import type { OverduePeriodicalOutstandingRow } from "@/server/actions/overdueReports";

export interface ImpendingBlockInvoice {
	invoiceNo: string;
	customer: string;
	docDate: string;
	dueDate?: string;
	amount: number;
	overDays: number;
	autoBlockDate: string; // Date string when overDays reaches the blocking limit
}

/**
 * Calculates date string when invoice overdue reaches the specified block limit.
 */
export function calculateBlockDate(
	docDateStr: string | Date,
	currentOverDays: number,
	blockLimit = 90,
): string {
	const base = new Date(docDateStr);
	const targetLimit = blockLimit + 1;
	if (isNaN(base.getTime())) {
		const target = new Date();
		target.setDate(target.getDate() + Math.max(0, targetLimit - currentOverDays));
		return target.toISOString().split("T")[0]!;
	}
	const blockDate = new Date();
	const daysRemaining = Math.max(0, targetLimit - currentOverDays);
	blockDate.setDate(blockDate.getDate() + daysRemaining);
	return blockDate.toISOString().split("T")[0]!;
}

/**
 * Pure evaluation helper for invoice overdue calculations:
 * - Aggregates net pending amounts
 * - Normalizes overdue days (supporting both negative ERP DueDays and positive past-due inputs)
 * - Finds warning invoices (within warning window, e.g. 80-90 days or directBlockLimit - 10)
 * - Finds blocking invoices (> directBlockLimit)
 */
export function evaluateOverdueInvoices(
	rows: OverduePeriodicalOutstandingRow[],
	options?: {
		directBlockDays?: number;
		warningWindowDays?: number;
	},
): {
	totalPendingAmt: number;
	oldestDays: number;
	warningInvoices: ImpendingBlockInvoice[];
	blockingInvoices: ImpendingBlockInvoice[];
} {
	const directBlockLimit = options?.directBlockDays ?? 90;
	const warningWindow = options?.warningWindowDays ?? 10;
	const warningStartLimit = Math.max(1, directBlockLimit - warningWindow);

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
			// In Technomax ERP rptMRwisePeriodicalOutstanding:
			// DueDays = DATEDIFF(M.DueDate, NOW())
			// Negative (-49) means 49 days past due date (overdue).
			// If already passed as positive overdue days (e.g. from existing test fixtures or reports), use directly.
			const rawOverDays = Number(r.OverDays || 0);
			const overduePastDueDays = rawOverDays < 0 ? Math.abs(rawOverDays) : rawOverDays;

			if (overduePastDueDays > oldestDays) {
				oldestDays = overduePastDueDays;
			}

			const docDateStr = r.DocDate
				? new Date(r.DocDate).toISOString().split("T")[0]!
				: "";
			const invItem: ImpendingBlockInvoice = {
				invoiceNo: r.DocNo || r.AgainstNo || `INV-${r.ID}`,
				customer: r.Customer || "Unknown Customer",
				docDate: docDateStr,
				dueDate: r.DueDate ? String(r.DueDate).split("T")[0] : undefined,
				amount: net,
				overDays: overduePastDueDays,
				autoBlockDate: calculateBlockDate(r.DocDate, overduePastDueDays, directBlockLimit),
			};

			if (overduePastDueDays > directBlockLimit) {
				blockingInvoices.push(invItem);
			} else if (
				overduePastDueDays >= warningStartLimit &&
				overduePastDueDays <= directBlockLimit
			) {
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
