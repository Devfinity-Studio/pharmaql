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
	});
});
