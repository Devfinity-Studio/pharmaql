import { readServerJson, writeServerJson } from "./server-storage";

export type FeatureKey =
	| "stock"
	| "sales"
	| "products"
	| "party"
	| "claim"
	| "overdue"
	| "export"
	| "notices";

export type FeatureScope =
	| "ACTIVE"
	| "DISABLED_FOR_MRS"
	| "DISABLED_FOR_ADMINS"
	| "DISABLED_FOR_ALL";

export interface MaintenanceConfig {
	mode: "DISABLED" | "MRS_ONLY" | "ALL_USERS";
	message: string;
	reason?: string;
	estimatedEndTime?: string;
	updatedAt: string;
	updatedBy: string;
}

const DEFAULT_TOGGLES: Record<FeatureKey, FeatureScope> = {
	stock: "ACTIVE",
	sales: "ACTIVE",
	products: "ACTIVE",
	party: "ACTIVE",
	claim: "ACTIVE",
	overdue: "ACTIVE",
	export: "ACTIVE",
	notices: "ACTIVE",
};

const DEFAULT_MAINTENANCE: MaintenanceConfig = {
	mode: "DISABLED",
	message: "PharmaQL is currently undergoing scheduled maintenance. Please check back shortly.",
	reason: "System performance optimizations and database re-indexing.",
	estimatedEndTime: "Soon",
	updatedAt: new Date().toISOString(),
	updatedBy: "system",
};

/**
 * Retrieve current feature toggles from server storage safely.
 */
export async function getFeatureToggles(): Promise<Record<FeatureKey, FeatureScope>> {
	const data = await readServerJson<Record<FeatureKey, FeatureScope>>(
		"feature_toggles.json",
		DEFAULT_TOGGLES,
	);
	return { ...DEFAULT_TOGGLES, ...data };
}

/**
 * Update an individual feature toggle scope.
 */
export async function updateFeatureToggle(
	key: FeatureKey,
	scope: FeatureScope,
	updatedBy: string,
): Promise<Record<FeatureKey, FeatureScope>> {
	const current = await getFeatureToggles();
	current[key] = scope;
	await writeServerJson("feature_toggles.json", current);
	return current;
}

/**
 * Checks whether a specific feature is enabled for a given user role.
 * Developers always bypass feature toggles.
 */
export async function isFeatureEnabledForRole(
	key: FeatureKey,
	role?: string,
): Promise<{ enabled: boolean; message?: string }> {
	if (role === "DEVELOPER") return { enabled: true };

	const toggles = await getFeatureToggles();
	const scope = toggles[key] || "ACTIVE";

	if (scope === "ACTIVE") return { enabled: true };

	if (scope === "DISABLED_FOR_ALL") {
		return {
			enabled: false,
			message: "This service is temporarily undergoing scheduled maintenance. Please check back shortly.",
		};
	}

	if (scope === "DISABLED_FOR_MRS" && role === "MR") {
		return {
			enabled: false,
			message: "This report feature is temporarily paused for Medical Representatives. Please check back later.",
		};
	}

	if (scope === "DISABLED_FOR_ADMINS" && role === "ADMIN") {
		return {
			enabled: false,
			message: "This feature is currently undergoing administrative maintenance.",
		};
	}

	return { enabled: true };
}

/**
 * Retrieve global maintenance mode status.
 */
export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
	const data = await readServerJson<MaintenanceConfig>(
		"maintenance.json",
		DEFAULT_MAINTENANCE,
	);
	return { ...DEFAULT_MAINTENANCE, ...data };
}

/**
 * Update global maintenance mode settings.
 */
export async function updateMaintenanceConfig(
	update: Partial<MaintenanceConfig>,
	updatedBy: string,
): Promise<MaintenanceConfig> {
	const current = await getMaintenanceConfig();
	const next: MaintenanceConfig = {
		...current,
		...update,
		updatedAt: new Date().toISOString(),
		updatedBy,
	};
	await writeServerJson("maintenance.json", next);
	return next;
}

/**
 * Evaluates whether the system is in maintenance mode for a given role.
 * Developers always bypass maintenance mode.
 */
export async function isUnderMaintenance(role?: string): Promise<{
	inMaintenance: boolean;
	message?: string;
	estimatedEndTime?: string;
}> {
	if (role === "DEVELOPER") return { inMaintenance: false };

	const config = await getMaintenanceConfig();
	if (config.mode === "DISABLED") return { inMaintenance: false };

	if (config.mode === "ALL_USERS") {
		return {
			inMaintenance: true,
			message: config.message,
			estimatedEndTime: config.estimatedEndTime,
		};
	}

	if (config.mode === "MRS_ONLY" && role === "MR") {
		return {
			inMaintenance: true,
			message: config.message,
			estimatedEndTime: config.estimatedEndTime,
		};
	}

	return { inMaintenance: false };
}
