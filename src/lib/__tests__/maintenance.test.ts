import { describe, expect, it, vi, beforeEach } from "vitest";
import { isUnderMaintenance, updateMaintenanceConfig, getMaintenanceConfig } from "../maintenance";

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

describe("maintenance service", () => {
	beforeEach(async () => {
		const { __resetMemoryStore } = (await import("../server-storage")) as any;
		__resetMemoryStore();
	});

	it("returns inMaintenance: false when mode is DISABLED", async () => {
		await updateMaintenanceConfig({ mode: "DISABLED" }, "test-admin");
		const mrCheck = await isUnderMaintenance("MR");
		const adminCheck = await isUnderMaintenance("ADMIN");
		const devCheck = await isUnderMaintenance("DEVELOPER");

		expect(mrCheck.inMaintenance).toBe(false);
		expect(adminCheck.inMaintenance).toBe(false);
		expect(devCheck.inMaintenance).toBe(false);
	});

	it("blocks MRs when mode is MRS_ONLY, but allows ADMIN and DEVELOPER", async () => {
		await updateMaintenanceConfig(
			{
				mode: "MRS_ONLY",
				message: "MR Maintenance in progress",
			},
			"test-admin",
		);

		const mrCheck = await isUnderMaintenance("MR");
		const adminCheck = await isUnderMaintenance("ADMIN");
		const devCheck = await isUnderMaintenance("DEVELOPER");

		expect(mrCheck.inMaintenance).toBe(true);
		expect(mrCheck.message).toBe("MR Maintenance in progress");

		expect(adminCheck.inMaintenance).toBe(false);
		expect(devCheck.inMaintenance).toBe(false);
	});

	it("blocks both MRs and ADMINs when mode is ALL_USERS, but DEVELOPER bypasses always", async () => {
		await updateMaintenanceConfig(
			{
				mode: "ALL_USERS",
				message: "Full maintenance mode",
				estimatedEndTime: "11:00 PM IST",
			},
			"test-admin",
		);

		const mrCheck = await isUnderMaintenance("MR");
		const adminCheck = await isUnderMaintenance("ADMIN");
		const devCheck = await isUnderMaintenance("DEVELOPER");

		expect(mrCheck.inMaintenance).toBe(true);
		expect(mrCheck.message).toBe("Full maintenance mode");
		expect(mrCheck.estimatedEndTime).toBe("11:00 PM IST");

		expect(adminCheck.inMaintenance).toBe(true);
		expect(adminCheck.message).toBe("Full maintenance mode");

		// Developer ALWAYS bypasses
		expect(devCheck.inMaintenance).toBe(false);
	});
});
