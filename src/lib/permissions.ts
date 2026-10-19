export type MRRank = 1 | 2 | 3;

export interface RankPermissions {
	canViewStock: boolean;
	canViewStockAndSales: boolean;
	canViewFreeScheme: boolean;
	canViewSales: boolean;
	canViewPartyWise: boolean;
	canViewProductWise: boolean;
}

export interface MROverride {
	isBlocked?: boolean;
	lastLogin?: string;
	rank?: MRRank;
	permissions?: {
		canViewFreeScheme: boolean;
		canViewStock: boolean;
		canViewStockAndSales?: boolean;
		canViewSales: boolean;
		canViewPartyWise: boolean;
		canViewProductWise: boolean;
	};
	assignedManufacturers?: {
		id: string;
		manufacturer: string;
		division: string | null;
	}[];
}

/**
 * Derives strict report permissions according to MR Rank:
 * - Rank 1: Stock Movement and Stock & Sales reports
 * - Rank 2: Stock reports and Claim Quantity (Free Scheme) reports
 * - Rank 3: All reports (Stock Movement, Stock & Sales, Free Scheme, Sales, Party Wise, Product Wise)
 */
export function getPermissionsForRank(rank: MRRank): RankPermissions {
	if (rank === 1) {
		return {
			canViewStock: true,
			canViewStockAndSales: true,
			canViewFreeScheme: false,
			canViewSales: false,
			canViewPartyWise: false,
			canViewProductWise: false,
		};
	}
	if (rank === 2) {
		return {
			canViewStock: true,
			canViewStockAndSales: true,
			canViewFreeScheme: true,
			canViewSales: false,
			canViewPartyWise: false,
			canViewProductWise: false,
		};
	}
	// Rank 3 (or any higher)
	return {
		canViewStock: true,
		canViewStockAndSales: true,
		canViewFreeScheme: true,
		canViewSales: true,
		canViewPartyWise: true,
		canViewProductWise: true,
	};
}
