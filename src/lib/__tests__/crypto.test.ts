import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, getMasterKey } from "../crypto";

describe("crypto utility (AES-256-GCM)", () => {
	it("should provide a valid 32-byte master key", () => {
		const key = getMasterKey();
		expect(key).toBeInstanceOf(Buffer);
		expect(key.length).toBe(32);
	});

	it("should round-trip encrypt and decrypt a connection string", () => {
		const plainText =
			"postgresql://user:p%40ssw0rd@ep-cool-db-123.us-east-2.aws.neon.tech/client_db?sslmode=require";
		const encrypted = encryptSecret(plainText);

		expect(encrypted).not.toEqual(plainText);
		expect(encrypted.split(":")).toHaveLength(3);

		const decrypted = decryptSecret(encrypted);
		expect(decrypted).toEqual(plainText);
	});

	it("should round-trip encrypt and decrypt an API secret key", () => {
		const apiKey = "sk_live_9a8b7c6d5e4f3a2b1c0d_pharmaql_test";
		const encrypted = encryptSecret(apiKey);
		const decrypted = decryptSecret(encrypted);
		expect(decrypted).toEqual(apiKey);
	});

	it("should fail decryption when ciphertext is tampered with", () => {
		const plainText = "top-secret-database-password";
		const encrypted = encryptSecret(plainText);
		const parts = encrypted.split(":");
		const ivHex = parts[0]!;
		const tagHex = parts[1]!;
		const dataHex = parts[2]!;

		// Tamper with last character of dataHex
		const tamperedHex =
			dataHex.slice(0, -1) + (dataHex.slice(-1) === "a" ? "b" : "a");
		const tamperedPayload = `${ivHex}:${tagHex}:${tamperedHex}`;

		expect(() => decryptSecret(tamperedPayload)).toThrow();
	});

	it("should fail decryption when authentication tag is tampered with", () => {
		const plainText = "top-secret-database-password";
		const encrypted = encryptSecret(plainText);
		const parts = encrypted.split(":");
		const ivHex = parts[0]!;
		const tagHex = parts[1]!;
		const dataHex = parts[2]!;

		// Tamper with tagHex
		const tamperedTag =
			tagHex.slice(0, -1) + (tagHex.slice(-1) === "f" ? "0" : "f");
		const tamperedPayload = `${ivHex}:${tamperedTag}:${dataHex}`;

		expect(() => decryptSecret(tamperedPayload)).toThrow();
	});

	it("should throw on malformed payload format", () => {
		expect(() => decryptSecret("not-a-valid-payload")).toThrow(
			/Invalid encrypted payload format/,
		);
		expect(() => decryptSecret("only:two")).toThrow(
			/Invalid encrypted payload format/,
		);
	});

	it("should return empty string for empty input", () => {
		expect(encryptSecret("")).toBe("");
		expect(decryptSecret("")).toBe("");
	});

	it("should decrypt legacy payload encrypted with fallback dev key even when custom master key is in env", () => {
		const originalEnv = process.env.CONTROL_PLANE_ENCRYPTION_KEY;
		try {
			// Encrypt with dev fallback key
			const devEncrypted = "2e4af394ab601ff9198dbdfd:d9773e742b94515135fa6c2ae5701710:0cfcf41b"; // 'test'
			
			// Set a distinct master key in env
			process.env.CONTROL_PLANE_ENCRYPTION_KEY = "c29c4b52f90203dc7854f4d1e5e1d21f8b76c269587503d91f4a7559c2f9325d";
			
			const decrypted = decryptSecret(devEncrypted);
			expect(decrypted).toBe("test");
		} finally {
			process.env.CONTROL_PLANE_ENCRYPTION_KEY = originalEnv;
		}
	});
});
