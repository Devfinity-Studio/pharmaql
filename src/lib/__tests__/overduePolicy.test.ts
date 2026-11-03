import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	isOverdueBlockingDisabled,
	getOverdueBlockingStatus,
	setOverdueBlockingStatusAction,
	updateTenantPolicyAction,
} from "@/server/actions/overduePolicy";

// Mock next/headers
vi.mock("next/headers", () => {
	const headersMap = new Map<string, string>();
	return {
		headers: vi.fn(async () => ({
			get: (key: string) => headersMap.get(key.toLowerCase()) || null,
			set: (key: string, value: string) => headersMap.set(key.toLowerCase(), value),
		})),
	};
});

// Mock next/cache
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// Mock auth
vi.mock("@/server/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(async () => ({
				user: {
					id: "admin-1",
					role: "ADMIN",
					email: "admin@devfinity.net",
				},
			})),
		},
	},
}));

// Mock server-storage
let mockStorage: Record<string, any> = {};
vi.mock("@/lib/server-storage", () => ({
	readServerJson: vi.fn(async (file: string, fallback: any) => mockStorage[file] || fallback),
	writeServerJson: vi.fn(async (file: string, data: any) => {
		mockStorage[file] = data;
	}),
}));

// Mock control-plane-db
vi.mock("@/lib/control-plane-db", () => ({
	getControlPlaneSql: vi.fn(() => null),
}));

describe("overduePolicy", () => {
	beforeEach(() => {
		mockStorage = {};
		vi.clearAllMocks();
	});

	it("defaults to blocking enabled (disabled = false) with standard defaults", async () => {
		const status = await getOverdueBlockingStatus();
		expect(status.disabled).toBe(false);
		expect(status.directBlockDays).toBe(90);
		expect(status.divisionBlockDays).toBe(120);
		expect(status.maxDataDays).toBeNull();

		const isDisabled = await isOverdueBlockingDisabled();
		expect(isDisabled).toBe(false);
	});

	it("updates policy via setOverdueBlockingStatusAction when called by admin", async () => {
		const res = await setOverdueBlockingStatusAction(true);
		expect(res.success).toBe(true);
		expect(res.disabled).toBe(true);

		const status = await getOverdueBlockingStatus();
		expect(status.disabled).toBe(true);
		expect(status.updatedBy).toBe("admin@devfinity.net");

		const isDisabled = await isOverdueBlockingDisabled();
		expect(isDisabled).toBe(true);
	});

	it("can re-enable blocking by setting disabled = false", async () => {
		await setOverdueBlockingStatusAction(true);
		expect(await isOverdueBlockingDisabled()).toBe(true);

		const res = await setOverdueBlockingStatusAction(false);
		expect(res.success).toBe(true);
		expect(res.disabled).toBe(false);

		expect(await isOverdueBlockingDisabled()).toBe(false);
	});

	it("updates custom blocking days and maxDataDays via updateTenantPolicyAction", async () => {
		const res = await updateTenantPolicyAction({
			directBlockDays: 60,
			divisionBlockDays: 100,
			maxDataDays: 45,
		});

		expect(res.success).toBe(true);
		expect(res.policy?.directBlockDays).toBe(60);
		expect(res.policy?.divisionBlockDays).toBe(100);
		expect(res.policy?.maxDataDays).toBe(45);

		const fetched = await getOverdueBlockingStatus();
		expect(fetched.directBlockDays).toBe(60);
		expect(fetched.divisionBlockDays).toBe(100);
		expect(fetched.maxDataDays).toBe(45);
	});

	it("clears maxDataDays back to null when set to 0 or null", async () => {
		await updateTenantPolicyAction({ maxDataDays: 60 });
		expect((await getOverdueBlockingStatus()).maxDataDays).toBe(60);

		await updateTenantPolicyAction({ maxDataDays: 0 });
		expect((await getOverdueBlockingStatus()).maxDataDays).toBeNull();
	});
});
