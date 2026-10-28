import { describe, it, expect } from "vitest";
import { isOfflineError } from "../api-client";

describe("isOfflineError", () => {
	it("detects TimeoutError correctly", () => {
		const err = new Error("The operation was aborted due to timeout");
		err.name = "TimeoutError";
		expect(isOfflineError(err)).toBe(true);
	});

	it("detects ECONNREFUSED network errors", () => {
		const err = new Error("connect ECONNREFUSED 127.0.0.1:9443");
		expect(isOfflineError(err)).toBe(true);
	});

	it("detects ETIMEDOUT connection errors", () => {
		const err = new Error("connect ETIMEDOUT 203.0.113.195:9443");
		expect(isOfflineError(err)).toBe(true);
	});

	it("detects Failed to fetch network errors", () => {
		const err = new Error("TypeError: Failed to fetch");
		expect(isOfflineError(err)).toBe(true);
	});

	it("returns false for application business logic errors", () => {
		const err = new Error("Invalid username or password");
		expect(isOfflineError(err)).toBe(false);
	});

	it("returns false for null/undefined", () => {
		expect(isOfflineError(null)).toBe(false);
		expect(isOfflineError(undefined)).toBe(false);
	});
});
