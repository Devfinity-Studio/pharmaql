"use server";

import { getAllMRUsers, getMRInfo } from "./mrInfo";
import { getMROverrides } from "./mrs";
import {
	getMRwisePeriodicalOutstanding,
	type OverduePeriodicalOutstandingRow,
} from "./overdueReports";
import {
	calculateBlockDate,
	evaluateOverdueInvoices,
	type ImpendingBlockInvoice,
} from "@/lib/overdueUtils";

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
	responsibleOverDays?: number;
	message?: string;
	hasAdminExemption: boolean;
	exemptionReason?: string;
	exemptionUntil?: string;
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

	const { totalPendingAmt, oldestDays, warningInvoices, blockingInvoices } =
		evaluateOverdueInvoices(rows);

	// If direct block applies (>90 days)
	if (blockingInvoices.length > 0) {
		if (!hasAdminExemption) {
			const worst = blockingInvoices.sort(
				(a, b) => b.overDays - a.overDays,
			)[0]!;

			// Asynchronously dispatch block alert to assigned MR (throttled to 1/24h)
			(async () => {
				try {
					const { sendPushToUser, getUserInAppNotifications } = await import("@/lib/push-notifications");
					const recents = await getUserInAppNotifications(mrId, "MR");
					const recentlyAlerted = recents.some(
						(a) => a.category === "OVERDUE" && a.urgency === "HIGH" && Date.now() - new Date(a.createdAt).getTime() < 24 * 60 * 60 * 1000,
					);
					if (!recentlyAlerted) {
						await sendPushToUser(mrId, {
							title: `🚫 Account Suspended: Overdue Payment`,
							body: `Customer ${worst.customer} has an invoice ${worst.invoiceNo} (₹${worst.amount.toFixed(0)}) overdue by ${worst.overDays} days. Orders on hold.`,
							url: "/dashboard?tab=overdue",
							category: "OVERDUE",
							urgency: "HIGH",
						});
					}
				} catch (err) {
					console.warn("[OverduePush] Block push alert error:", err);
				}
			})();

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

		// Asynchronously dispatch impending block warning push to assigned MR (throttled to 1/24h)
		(async () => {
			try {
				const { sendPushToUser, getUserInAppNotifications } = await import("@/lib/push-notifications");
				const recents = await getUserInAppNotifications(mrId, "MR");
				const recentlyAlerted = recents.some(
					(a) => a.category === "OVERDUE" && Date.now() - new Date(a.createdAt).getTime() < 24 * 60 * 60 * 1000,
				);
				if (!recentlyAlerted) {
					await sendPushToUser(mrId, {
						title: `⚠️ Impending Block: ${worst.customer}`,
						body: `Invoice ${worst.invoiceNo} (₹${worst.amount.toFixed(0)}) is ${worst.overDays} days overdue. Follow up before ${worst.autoBlockDate} to prevent suspension.`,
						url: "/dashboard?tab=overdue",
						category: "OVERDUE",
						urgency: "HIGH",
					});
				}
			} catch (err) {
				console.warn("[OverduePush] Warning push alert error:", err);
			}
		})();

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
	// If MR is clean, check all peer MRs in all assigned divisions of this MR
	const divisionNames = Array.from(
		new Set(
			(mrInfo.assignments && mrInfo.assignments.length > 0
				? mrInfo.assignments.map((a) => a.division || a.manufacturer)
				: [mrInfo.division || mrInfo.company]
			).filter((d): d is string => Boolean(d)),
		),
	);

	if (divisionNames.length > 0) {
		try {
			// Find all MRs in the same division(s) via API server
			const allMrs = await getAllMRUsers();

			for (const divisionName of divisionNames) {
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

					// Division cascading block only triggers when peer payment exceeds 95 days
					const peerBlocking = peerItems.filter((p) => {
						const net = Number(p.Amount || 0) - Number(p.AdjAmt || 0);
						return net > 0 && Number(p.OverDays || 0) > 95;
					});

					if (peerBlocking.length > 0) {
						const worst = peerBlocking.sort(
							(a, b) => Number(b.OverDays) - Number(a.OverDays),
						)[0]!;
						const netAmt = Number(worst.Amount || 0) - Number(worst.AdjAmt || 0);
						const overDays = Number(worst.OverDays || 0);

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
								responsibleOverDays: overDays,
								message: `Division access for '${divisionName}' is temporarily suspended because MR ${peer.MRName || peerId} has overdue payments exceeding 95 days on invoice ${worst.DocNo || worst.AgainstNo} (₹${netAmt.toFixed(2)}, ${overDays} days overdue).`,
								hasAdminExemption: false,
							};
						}
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
		divisionName: divisionNames[0] || mrInfo.division || mrInfo.company || undefined,
		hasAdminExemption,
		exemptionUntil: exemptionUntilStr,
	};
}

/**
 * Scan all MRs across divisions for overdue evaluation.
 * Decoupled from the initial page load to avoid locking the UI.
 */
export async function getOverdueEvaluationsSummary(): Promise<
	MROverdueEvaluation[]
> {
	try {
		const legacyMRs = await getAllMRUsers();
		const overdueEvaluations = await Promise.all(
			legacyMRs.map((lmr) => evaluateMROverdueStatus(lmr.id)),
		);
		return overdueEvaluations;
	} catch (error) {
		console.error("[OverdueEngine] Failed to evaluate summary:", error);
		return [];
	}
}
