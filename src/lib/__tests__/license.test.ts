import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	getLicenseStatus,
	updateLicenseConfig,
	suspendUsageImmediately,
	forceExpireImmediately,
	restoreActiveUsage,
} from "../license";

vi.mock("../server-storage", () => {
	let memoryStore: Record<string, any> = {};
	return {
		getServerDataDir: () => "mock-dir",
		getServerDataFilePath: (f: string) => `mock-dir/${f}`,
		readServerJson: vi.fn(async (filename: string, fallback: any) => {
			return memoryStore[filename] !== undefined ? memoryStore[filename] : fallback;
		}),
		writeServerJson: vi.fn(async (filename: string, data: any) => {
			memoryStore[filename] = data;
		}),
		__resetMemoryStore: () => {
			memoryStore = {};
		},
	};
});

describe("license service", () => {
	beforeEach(async () => {
		const { __resetMemoryStore } = (await import("../server-storage")) as any;
		__resetMemoryStore();
	});

	it("returns active status when license expiration is in the future", async () => {
		const futureDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString();
		await updateLicenseConfig(
			{
				status: "ACTIVE",
				expiresAt: futureDate,
				killswitchActive: false,
			},
			"test-dev",
		);

		const status = await getLicenseStatus();
		expect(status.status).toBe("ACTIVE");
		expect(status.isBlocked).toBe(false);
		expect(status.daysRemaining).toBeGreaterThan(90);
	});

	it("marks license as blocked when suspendUsageImmediately is triggered", async () => {
		await suspendUsageImmediately("test-dev");
		const status = await getLicenseStatus();

		expect(status.status).toBe("SUSPENDED");
		expect(status.isBlocked).toBe(true);
		expect(status.killswitchActive).toBe(true);
	});

	it("marks license as blocked when forceExpireImmediately is triggered", async () => {
		await forceExpireImmediately("test-dev");
		const status = await getLicenseStatus();

		expect(status.status).toBe("EXPIRED");
		expect(status.isBlocked).toBe(true);
		expect(status.daysRemaining).toBeLessThan(0);
	});

	it("restores license to active and unblocked state", async () => {
		await suspendUsageImmediately("test-dev");
		const suspendedStatus = await getLicenseStatus();
		expect(suspendedStatus.isBlocked).toBe(true);

		await restoreActiveUsage("test-dev");
		const restoredStatus = await getLicenseStatus();
		expect(restoredStatus.status).toBe("ACTIVE");
		expect(restoredStatus.isBlocked).toBe(false);
		expect(restoredStatus.killswitchActive).toBe(false);
	});
});
