import fs from "fs/promises";
import path from "path";

export interface RuntimeConfig {
	adminAllowedIps: string;
	debugMode: boolean;
	rateLimitStrictMode: boolean;
	mrOverdueGraceDays: number;
	maintenanceBanner: string;
	sessionMaxAgeDays: number;
	updatedAt: string;
	updatedBy: string;
}

const RUNTIME_CONFIG_FILE = path.join(process.cwd(), "data", "runtime_config.json");

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
	adminAllowedIps: process.env.ADMIN_ALLOWED_IPS || "",
	debugMode: false,
	rateLimitStrictMode: true,
	mrOverdueGraceDays: 7,
	maintenanceBanner: "",
	sessionMaxAgeDays: 7,
	updatedAt: new Date().toISOString(),
	updatedBy: "system",
};

/**
 * Retrieve dynamic runtime configuration.
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
	try {
		const raw = await fs.readFile(RUNTIME_CONFIG_FILE, "utf-8");
		const config: RuntimeConfig = { ...DEFAULT_RUNTIME_CONFIG, ...JSON.parse(raw) };
		if (config.adminAllowedIps !== undefined && config.adminAllowedIps !== "") {
			process.env.ADMIN_ALLOWED_IPS = config.adminAllowedIps;
		}
		return config;
	} catch {
		await fs.mkdir(path.dirname(RUNTIME_CONFIG_FILE), { recursive: true });
		await fs.writeFile(
			RUNTIME_CONFIG_FILE,
			JSON.stringify(DEFAULT_RUNTIME_CONFIG, null, 2),
			"utf-8",
		);
		return DEFAULT_RUNTIME_CONFIG;
	}
}

/**
 * Update dynamic runtime configuration.
 */
export async function updateRuntimeConfig(
	partial: Partial<RuntimeConfig>,
	updatedBy: string,
): Promise<RuntimeConfig> {
	const current = await getRuntimeConfig();
	const next: RuntimeConfig = {
		...current,
		...partial,
		updatedAt: new Date().toISOString(),
		updatedBy,
	};
	if (next.adminAllowedIps !== undefined) {
		process.env.ADMIN_ALLOWED_IPS = next.adminAllowedIps;
	}
	await fs.mkdir(path.dirname(RUNTIME_CONFIG_FILE), { recursive: true });
	await fs.writeFile(RUNTIME_CONFIG_FILE, JSON.stringify(next, null, 2), "utf-8");
	return next;
}

/**
 * Safely inspect masked server environment keys for diagnostics without leaking secrets.
 */
export function getMaskedEnvInspection() {
	const mask = (val?: string) => {
		if (!val) return "Not Configured";
		if (val.length <= 6) return "******";
		return `${val.slice(0, 3)}****${val.slice(-3)}`;
	};

	return {
		nodeEnv: process.env.NODE_ENV || "development",
		apiServerUrl: process.env.API_SERVER_URL || "http://127.0.0.1:9443",
		apiSecretConfigured: Boolean(process.env.API_SECRET_KEY),
		apiSecretMasked: mask(process.env.API_SECRET_KEY),
		adminEmail: process.env.ADMIN_EMAIL || "admin@asmeepharma.com",
		adminPassConfigured: Boolean(process.env.ADMIN_PASSWORD),
		devEmail: process.env.DEV_EMAIL || "dev@asmeepharma.com",
		devPassConfigured: Boolean(process.env.DEV_PASSWORD),
		gmailUser: process.env.GMAIL_USER || "info.devolvestudio@gmail.com",
		gmailPassConfigured: Boolean(process.env.GMAIL_PASS),
		gmailPassMasked: mask(process.env.GMAIL_PASS),
		adminAllowedIps: process.env.ADMIN_ALLOWED_IPS || "Any (Unrestricted)",
	};
}
