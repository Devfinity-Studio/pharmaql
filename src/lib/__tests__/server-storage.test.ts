import { describe, it, expect, vi } from "vitest";
import { readServerJson, writeServerJson } from "../server-storage";

describe("server-storage relational & disk fallback", () => {
	it("should read fallback data when file does not exist", async () => {
		const result = await readServerJson("test_non_existent_file.json", {
			status: "OK",
			count: 42,
		});
		expect(result).toEqual({ status: "OK", count: 42 });
	});

	it("should write and read back data successfully in fallback mode", async () => {
		const testData = { foo: "bar", timestamp: Date.now() };
		await writeServerJson("test_storage_sample.json", testData);

		const readBack = await readServerJson("test_storage_sample.json", {
			foo: "fallback",
			timestamp: 0,
		});
		expect(readBack).toEqual(testData);
	});
});
