import { describe, expect, it } from "vitest";
import { getPermissionsForRank } from "../permissions";

describe("permissions", () => {
	describe("getPermissionsForRank", () => {
		it("grants Stock, Stock & Sales, Overdue, and Expiry for Rank 1", () => {
			const perms = getPermissionsForRank(1);
			expect(perms.canViewStock).toBe(true);
			expect(perms.canViewStockAndSales).toBe(true);
			expect(perms.canViewFreeScheme).toBe(false);
			expect(perms.canViewSales).toBe(false);
			expect(perms.canViewPartyWise).toBe(false);
			expect(perms.canViewProductWise).toBe(false);
			expect(perms.canViewExpiry).toBe(true);
			expect(perms.canViewOverdue).toBe(true);
		});

		it("grants Stock, Stock & Sales, Free Scheme (Claim), Overdue, and Expiry for Rank 2", () => {
			const perms = getPermissionsForRank(2);
			expect(perms.canViewStock).toBe(true);
			expect(perms.canViewStockAndSales).toBe(true);
			expect(perms.canViewFreeScheme).toBe(true);
			expect(perms.canViewSales).toBe(false);
			expect(perms.canViewPartyWise).toBe(false);
			expect(perms.canViewProductWise).toBe(false);
			expect(perms.canViewExpiry).toBe(true);
			expect(perms.canViewOverdue).toBe(true);
		});

		it("grants all report permissions for Rank 3", () => {
			const perms = getPermissionsForRank(3);
			expect(perms.canViewStock).toBe(true);
			expect(perms.canViewStockAndSales).toBe(true);
			expect(perms.canViewFreeScheme).toBe(true);
			expect(perms.canViewSales).toBe(true);
			expect(perms.canViewPartyWise).toBe(true);
			expect(perms.canViewProductWise).toBe(true);
			expect(perms.canViewExpiry).toBe(true);
			expect(perms.canViewOverdue).toBe(true);
		});

		it("correctly resolves ranks across multi-division rows without null profile escalation", () => {
			function resolveMemberRank(members: { rank?: number; explicitRank?: number; JobProfile?: string | null; Ranking?: string | number | null; ranking?: string | number | null }[]) {
				let explicitDbRank: 1 | 2 | 3 | null = null;
				for (const m of members) {
					let r: 1 | 2 | 3 | null = null;
					const rawRanking = m.Ranking ?? m.ranking ?? m.explicitRank;
					if (rawRanking !== undefined && rawRanking !== null && String(rawRanking).trim() !== "") {
						const parsed = Number(rawRanking);
						if (parsed === 1 || parsed === 2 || parsed === 3) {
							r = parsed as 1 | 2 | 3;
						}
					} else if (m.JobProfile) {
						const match = String(m.JobProfile).match(/rank\s*([123])/i);
						if (match && match[1]) {
							r = Number(match[1]) as 1 | 2 | 3;
						}
					}
					if (r !== null) {
						if (explicitDbRank === null || r > explicitDbRank) {
							explicitDbRank = r;
						}
					}
				}
				return explicitDbRank;
			}

			const membersWithExplicit = [
				{ Ranking: 2, JobProfile: "Representative" },
				{ Ranking: 1, JobProfile: null },
			];
			expect(resolveMemberRank(membersWithExplicit)).toBe(2);

			const membersWithTextProfile = [
				{ Ranking: null, JobProfile: "Sales Rank 3" },
				{ Ranking: null, JobProfile: "General MR" },
			];
			expect(resolveMemberRank(membersWithTextProfile)).toBe(3);

			const membersWithoutRank = [
				{ Ranking: null, JobProfile: "Representative" },
			];
			expect(resolveMemberRank(membersWithoutRank)).toBeNull();
		});
	});
});
