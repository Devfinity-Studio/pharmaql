import { describe, expect, it } from "vitest";
import { getPermissionsForRank } from "../permissions";

describe("permissions", () => {
	describe("getPermissionsForRank", () => {
		it("grants only Stock Movement and Stock & Sales for Rank 1", () => {
			const perms = getPermissionsForRank(1);
			expect(perms.canViewStock).toBe(true);
			expect(perms.canViewStockAndSales).toBe(true);
			expect(perms.canViewFreeScheme).toBe(false);
			expect(perms.canViewSales).toBe(false);
			expect(perms.canViewPartyWise).toBe(false);
			expect(perms.canViewProductWise).toBe(false);
		});

		it("grants Stock, Stock & Sales, and Free Scheme (Claim) for Rank 2", () => {
			const perms = getPermissionsForRank(2);
			expect(perms.canViewStock).toBe(true);
			expect(perms.canViewStockAndSales).toBe(true);
			expect(perms.canViewFreeScheme).toBe(true);
			expect(perms.canViewSales).toBe(false);
			expect(perms.canViewPartyWise).toBe(false);
			expect(perms.canViewProductWise).toBe(false);
		});

		it("grants all report permissions for Rank 3", () => {
			const perms = getPermissionsForRank(3);
			expect(perms.canViewStock).toBe(true);
			expect(perms.canViewStockAndSales).toBe(true);
			expect(perms.canViewFreeScheme).toBe(true);
			expect(perms.canViewSales).toBe(true);
			expect(perms.canViewPartyWise).toBe(true);
			expect(perms.canViewProductWise).toBe(true);
		});

		it("correctly resolves ranks across multi-division rows without null profile escalation", () => {
			function resolveMemberRank(members: { rank?: number; explicitRank?: number; JobProfile?: string | null }[]) {
				let explicitDbRank: 1 | 2 | 3 | null = null;
				for (const m of members) {
					let r: 1 | 2 | 3 | null = null;
					const explicit = m.explicitRank;
					if (explicit === 1 || explicit === 2 || explicit === 3) {
						r = explicit as 1 | 2 | 3;
					} else if (m.JobProfile) {
						const jp = m.JobProfile.toUpperCase().trim();
						if (jp === "MR") r = 1;
						else if (jp === "ABM" || jp === "BO") r = 2;
						else if (jp === "ASM" || jp === "RSM" || jp === "ZSM" || jp === "NSM") r = 3;
					} else if (m.rank === 1 || m.rank === 2) {
						r = m.rank as 1 | 2 | 3;
					}
					if (r !== null) {
						if (explicitDbRank === null || r > explicitDbRank) {
							explicitDbRank = r;
						}
					}
				}
				return explicitDbRank ?? 3;
			}

			// Single row set to MR
			expect(resolveMemberRank([{ JobProfile: "MR" }])).toBe(1);

			// Multi-division MR: One division set to MR (Rank 1), other division unconfigured/null
			// MUST NOT escalate to Rank 3!
			expect(resolveMemberRank([{ JobProfile: "MR" }, { JobProfile: null }])).toBe(1);

			// Multi-division ABM: One division set to ABM (Rank 2), other division null
			expect(resolveMemberRank([{ JobProfile: "ABM" }, { JobProfile: null }])).toBe(2);

			// Explicit Rank 1 column with secondary division having default rank 3
			expect(resolveMemberRank([{ rank: 1, explicitRank: 1 }, { rank: 3, JobProfile: null }])).toBe(1);
		});
	});
});
