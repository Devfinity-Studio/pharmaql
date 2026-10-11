"use server";

import { getAllMRUsers, getMRInfo } from "./mrInfo";
import { getMROverrides } from "./mrs";
import {
	getMRwisePeriodicalOutstanding,
	type OverduePeriodicalOutstandingRow,
} from "./overdueReports";

export interface ImpendingBlockInvoice {
	invoiceNo: string;
	customer: string;
	docDate: string;
	dueDate?: string;
	amount: number;
	overDays: number;
	autoBlockDate: string; // Date string when overDays reaches 91
}

export type MROverdueStatusType =
	| "CLEAN"
	| "WARNING" // 80 - 90 days
	| "DIRECT_BLOCKED" // > 90 days
	| "DIVISION_BLOCKED" // Collateral block due to peer MR in same division
	| "MANUAL_BLOCKED"; // Blocked manually by Admin

export interface MROverdueEvaluation {
	mrId: string;
	mrName: string;
	status: MROverdueStatusType;
	isBlocked: boolean;
	totalPendingAmt: number;
	oldestDays: number;
	warningInvoices: ImpendingBlockInvoice[];
	blockingInvoices: ImpendingBlockInvoice[];
	divisionName?: string;
	responsibleMrName?: string;
	responsibleMrId?: string;
	responsibleInvoiceNo?: string;
	responsibleAmount?: number;
	message?: string;
	hasAdminExemption: boolean;
	exemptionReason?: string;
	exemptionUntil?: string;
}

function calculateBlockDate(
	docDateStr: string | Date,
	currentOverDays: number,
): string {
	const base = new Date(docDateStr);
	if (isNaN(base.getTime())) {
		const target = new Date();
		target.setDate(target.getDate() + Math.max(0, 91 - currentOverDays));
		return target.toISOString().split("T")[0]!;
	}
	// Invoice reaches 91 days at base + 91 days (assuming OverDays is from invoice date)
	const blockDate = new Date();
	const daysRemaining = Math.max(0, 91 - currentOverDays);
	blockDate.setDate(blockDate.getDate() + daysRemaining);
	return blockDate.toISOString().split("T")[0]!;
}

/**
 * Evaluates the full overdue status for an MR:
 * - Checks manual block from master and data/mr_overrides.json
 * - Checks active admin exemptions
 * - Runs live `rptMRwisePeriodicalOutstanding`
 * - Filters for net pending: Amount - AdjAmt > 0
 * - Detects 80–90d warnings and >90d direct blocks
 * - If clean, checks if any peer MR in the same division is DIRECT_BLOCKED
 */
export async function evaluateMROverdueStatus(
	mrIdentifier: string | number,
): Promise<MROverdueEvaluation> {
	const mrInfo = await getMRInfo(mrIdentifier);
	if (!mrInfo) {
		return {
			mrId: String(mrIdentifier),
			mrName: "Unknown MR",
			status: "CLEAN",
			isBlocked: false,
			totalPendingAmt: 0,
			oldestDays: 0,
			warningInvoices: [],
			blockingInvoices: [],
			hasAdminExemption: false,
		};
	}

	const mrId = mrInfo.id;
	const overrides = await getMROverrides();
	const mrOverride = (overrides as any)[mrId] || {};

	// Check Admin Exemption / Grace Period
	const now = new Date();
	const exemptionUntilStr =
		mrOverride.unblockedUntil || mrOverride.exemptionUntil;
	const hasAdminExemption =
		Boolean(exemptionUntilStr) &&
		new Date(exemptionUntilStr).getTime() > now.getTime();

	// Check manual admin block
	if (mrOverride.isBlocked === true || mrInfo.isBlocked) {
		if (!hasAdminExemption) {
			return {
				mrId,
				mrName: mrInfo.name,
				status: "MANUAL_BLOCKED",
				isBlocked: true,
				totalPendingAmt: 0,
				oldestDays: 0,
				warningInvoices: [],
				blockingInvoices: [],
				divisionName: mrInfo.division || mrInfo.company,
				message: "Account has been manually suspended by system administrator.",
				hasAdminExemption: false,
			};
		}
	}

	// Fetch live outstanding for this MR
	const compCode = mrInfo.companyCode || mrInfo.company || "";
	const outRes = await getMRwisePeriodicalOutstanding({
		mrId,
		compCode,
		fromDate: "2026-04-01",
		toDate: new Date().toISOString().split("T")[0],
		locNo: mrInfo.locNo || "11",
	});

	const rows = (
		outRes.success && outRes.data ? outRes.data : []
	) as OverduePeriodicalOutstandingRow[];

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

	// If direct block applies (>90 days)
	if (blockingInvoices.length > 0) {
		if (!hasAdminExemption) {
			const worst = blockingInvoices.sort(
				(a, b) => b.overDays - a.overDays,
			)[0]!;
			return {
				mrId,
				mrName: mrInfo.name,
				status: "DIRECT_BLOCKED",
				isBlocked: true,
				totalPendingAmt,
				oldestDays,
				warningInvoices,
				blockingInvoices,
				divisionName: mrInfo.division || mrInfo.company,
				message: `Account is automatically blocked due to pending payment exceeding 90 days on invoice ${worst.invoiceNo} (₹${worst.amount.toFixed(2)}, ${worst.overDays} days overdue).`,
				hasAdminExemption: false,
			};
		}
	}

	// If warning applies (80–90 days)
	if (warningInvoices.length > 0) {
		const worst = warningInvoices.sort((a, b) => b.overDays - a.overDays)[0]!;
		return {
			mrId,
			mrName: mrInfo.name,
			status: "WARNING",
			isBlocked: false,
			totalPendingAmt,
			oldestDays,
			warningInvoices,
			blockingInvoices: [],
			divisionName: mrInfo.division || mrInfo.company,
			message: `Warning: Invoice ${worst.invoiceNo} (₹${worst.amount.toFixed(2)}) is ${worst.overDays} days overdue. Your account will be automatically blocked on ${worst.autoBlockDate} if payment is not cleared.`,
			hasAdminExemption,
			exemptionUntil: exemptionUntilStr,
		};
	}

	// Check Division Cascading Block:
	// If MR is clean, check all peer MRs in the same division
	const divisionName = mrInfo.division || mrInfo.company;
	if (divisionName) {
		try {
			// Find all MRs in the same division via API server
			const allMrs = await getAllMRUsers();
			const peers = allMrs.filter(
				(m) =>
					(m.division === divisionName || m.company === divisionName) &&
					String(m.ID) !== String(mrInfo.ID),
			);

			for (const peer of peers) {
				const peerId = String(peer.ID);
				// Check if peer has an admin exemption
				const peerOverride = (overrides as any)[peerId] || {};
				const peerExemption =
					Boolean(peerOverride.unblockedUntil) &&
					new Date(peerOverride.unblockedUntil).getTime() > now.getTime();

				if (peerExemption) continue;

				// Query peer outstanding
				const peerOut = await getMRwisePeriodicalOutstanding({
					mrId: peerId,
					compCode,
					fromDate: "2026-04-01",
					toDate: new Date().toISOString().split("T")[0],
					locNo: mrInfo.locNo || "11",
				});

				const peerItems = (
					peerOut.success && peerOut.data ? peerOut.data : []
				) as OverduePeriodicalOutstandingRow[];
				const peerBlocking = peerItems.filter((p) => {
					const net = Number(p.Amount || 0) - Number(p.AdjAmt || 0);
					return net > 0 && Number(p.OverDays || 0) > 90;
				});

				if (peerBlocking.length > 0) {
					const worst = peerBlocking.sort(
						(a, b) => Number(b.OverDays) - Number(a.OverDays),
					)[0]!;
					const netAmt = Number(worst.Amount || 0) - Number(worst.AdjAmt || 0);

					if (!hasAdminExemption) {
						return {
							mrId,
							mrName: mrInfo.name,
							status: "DIVISION_BLOCKED",
							isBlocked: true,
							totalPendingAmt,
							oldestDays,
							warningInvoices: [],
							blockingInvoices: [],
							divisionName,
							responsibleMrName: peer.MRName || `MR #${peerId}`,
							responsibleMrId: peerId,
							responsibleInvoiceNo:
								worst.DocNo || worst.AgainstNo || `INV-${worst.ID}`,
							responsibleAmount: netAmt,
							message: `Division access for '${divisionName}' is temporarily suspended due to overdue payment (>90 days) by MR ${peer.MRName || peerId} on invoice ${worst.DocNo || worst.AgainstNo} (₹${netAmt.toFixed(2)}).`,
							hasAdminExemption: false,
						};
					}
				}
			}
		} catch (err) {
			console.error(
				"[OverdueEngine] Error checking division cascading block:",
				err,
			);
		}
	}

	return {
		mrId,
		mrName: mrInfo.name,
		status: "CLEAN",
		isBlocked: false,
		totalPendingAmt,
		oldestDays,
		warningInvoices: [],
		blockingInvoices: [],
		divisionName,
		hasAdminExemption,
		exemptionUntil: exemptionUntilStr,
	};
}
