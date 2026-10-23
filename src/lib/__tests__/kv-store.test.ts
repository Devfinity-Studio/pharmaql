import { describe, expect, it } from "vitest";
import { kvStore } from "../kv-store";

describe("kvStore", () => {
	it("stores and retrieves values", async () => {
		const key = "test:user:123";
		await kvStore.set(key, { name: "Dr. Smith", role: "MR" });

		const retrieved = await kvStore.get<{ name: string; role: string }>(key);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.name).toBe("Dr. Smith");
		expect(retrieved?.role).toBe("MR");
	});

	it("deletes values properly", async () => {
		const key = "test:delete:456";
		await kvStore.set(key, "temporary");
		expect(await kvStore.has(key)).toBe(true);

		await kvStore.del(key);
		expect(await kvStore.has(key)).toBe(false);
		expect(await kvStore.get(key)).toBeNull();
	});

	it("returns null for non-existent keys", async () => {
		const result = await kvStore.get("non:existent:key");
		expect(result).toBeNull();
	});
});
