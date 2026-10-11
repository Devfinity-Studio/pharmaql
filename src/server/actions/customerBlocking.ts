"use server";

import { legacyDb } from "@/lib/legacy-db";

export interface CustomerBlockingInfo {
	id: number;
	custCode: string;
	customer: string;
	inActive: boolean;
	blackList: boolean;
	notAllowInvoice: boolean;
	blackListRmk?: string;
	maxOutDays?: number;
	creditLimit?: number;
	isBlocked: boolean;
	blockReason?: string;
}

/**
 * Batch lookup of customer blocking status from `pdyasvmaster.m_customer`.
 * Returns a Map keyed by `CustCode` or `ID` with quick blocking state and reasons.
 */
export async function getCustomerBlockingMap(): Promise<Map<string, CustomerBlockingInfo>> {
	const map = new Map<string, CustomerBlockingInfo>();

	try {
		const [rows] = await legacyDb.query(`
			SELECT 
				ID, CustCode, Customer, InActive, BlackList, NotAllowInvoice,
				BlackListRmk, MaxOutDays, CrossigLimitAmt
			FROM \`pdyasvmaster\`.\`m_customer\`
		`);

		const items = (rows as any[]) || [];
		items.forEach((r) => {
			const inActive = Number(r.InActive || 0) === 1;
			const blackList = Number(r.BlackList || 0) === 1;
			const notAllowInvoice = Number(r.NotAllowInvoice || 0) === 1;
			const isBlocked = inActive || blackList || notAllowInvoice;

			let reason = "";
			if (blackList) reason = r.BlackListRmk || "Blacklisted";
			else if (notAllowInvoice) reason = "Invoicing Restricted";
			else if (inActive) reason = "Inactive";

			const info: CustomerBlockingInfo = {
				id: Number(r.ID),
				custCode: String(r.CustCode || "").trim(),
				customer: String(r.Customer || "").trim(),
				inActive,
				blackList,
				notAllowInvoice,
				blackListRmk: r.BlackListRmk || undefined,
				maxOutDays: Number(r.MaxOutDays || 0) || undefined,
				creditLimit: Number(r.CrossigLimitAmt || 0) || undefined,
				isBlocked,
				blockReason: reason || undefined,
			};

			if (info.custCode) map.set(info.custCode.toUpperCase(), info);
			if (info.customer) map.set(info.customer.toUpperCase(), info);
			map.set(String(info.id), info);
		});
	} catch (error) {
		console.error("[CustomerBlocking] Error querying m_customer:", error);
	}

	return map;
}
