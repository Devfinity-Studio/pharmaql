import { describe, it, expect } from "vitest";
import {
	getLatestRelease,
	getAllReleases,
	publishRelease,
	recordInstanceHeartbeat,
	getAllInstances,
} from "../releases-store";

describe("control plane OTA releases & fleet telemetry store", () => {
	it("should retrieve the baseline or latest release for win-x64", async () => {
		const latest = await getLatestRelease("win-x64");
		expect(latest).toBeDefined();
		expect(latest?.platform).toBe("win-x64");
		expect(typeof latest?.version).toBe("string");
		expect(typeof latest?.downloadUrl).toBe("string");
	});

	it("should publish a new release and list it in catalog", async () => {
		const testVersion = "1.2.99-test";
		const published = await publishRelease({
			version: testVersion,
			platform: "win-x64",
			sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			downloadUrl: `/api/releases/download?version=${testVersion}`,
			mandatory: true,
			releaseNotes: "Test release notes for automated test suite",
			isActive: true,
		});

		expect(published.version).toBe(testVersion);
		expect(published.mandatory).toBe(true);

		const all = await getAllReleases();
		const found = all.find((r) => r.version === testVersion);
		expect(found).toBeDefined();
		expect(found?.sha256).toBe("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
	});

	it("should record instance heartbeat and return in fleet list", async () => {
		const testInstanceId = "test-node-guid-889900";
		await recordInstanceHeartbeat({
			instanceId: testInstanceId,
			version: "1.1.0",
			platform: "win-x64",
			isVaultProtected: true,
			status: "ONLINE",
			metadata: { hostname: "TEST-CLIENT-PC", os: "Windows_NT" },
		});

		const instances = await getAllInstances();
		const found = instances.find((i) => i.instanceId === testInstanceId);
		expect(found).toBeDefined();
		expect(found?.isVaultProtected).toBe(true);
		expect(found?.status).toBe("ONLINE");
		expect(found?.metadata?.hostname).toBe("TEST-CLIENT-PC");
	});
});

