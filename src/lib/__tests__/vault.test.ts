import { describe, it, expect } from "vitest";
import {
	encryptConfigData,
	decryptConfigData,
	getMachineFingerprint,
} from "../../../api-server/src/vault";

describe("api-server zero-knowledge hardware-bound vault", () => {
	const sampleConfig: Record<string, string> = {
		PORT: "9443",
		DB_HOST: "127.0.0.1",
		DB_PORT: "3306",
		DB_USER: "root",
		DB_PASSWORD: "SuperSecretLegacyDbPassword123!",
		DB_DATABASE: "pharmadb",
		API_SECRET_KEY: "pharmaql_sec_prod_9988776655",
		API_ALLOWED_ORIGINS: "https://pharmaql.devfinity.net",
	};

	it("should encrypt and decrypt configuration with matching machine fingerprint", () => {
		const machineKey = getMachineFingerprint();
		expect(typeof machineKey).toBe("string");
		expect(machineKey.length).toBeGreaterThan(0);

		const vaultBuffer = encryptConfigData(sampleConfig, machineKey);
		expect(Buffer.isBuffer(vaultBuffer)).toBe(true);
		expect(vaultBuffer.length).toBeGreaterThan(50);

		const decrypted = decryptConfigData(vaultBuffer, machineKey);
		expect(decrypted).toEqual(sampleConfig);
		expect(decrypted.DB_PASSWORD).toBe("SuperSecretLegacyDbPassword123!");
	});

	it("should fail decryption when machine fingerprint does not match (stolen vault prevention)", () => {
		const validKey = "machine-guid-source-server-12345";
		const attackerKey = "machine-guid-stolen-target-server-67890";

		const vaultBuffer = encryptConfigData(sampleConfig, validKey);

		expect(() => {
			decryptConfigData(vaultBuffer, attackerKey);
		}).toThrow(/Machine fingerprint mismatch|Decryption failed/i);
	});

	it("should reject tampered ciphertext or altered payload", () => {
		const validKey = "valid-host-key-abc";
		const vaultBuffer = encryptConfigData(sampleConfig, validKey);

		// Tamper with the ciphertext byte in the payload
		const tampered = Buffer.from(vaultBuffer);
		const targetIndex = tampered.length - 5;
		const originalByte = tampered[targetIndex] ?? 0;
		tampered[targetIndex] = originalByte ^ 0xff;

		expect(() => {
			decryptConfigData(tampered, validKey);
		}).toThrow(/Machine fingerprint mismatch|Decryption failed/i);
	});

	it("should reject corrupt or truncated vault payload header", () => {
		const validKey = "valid-host-key-abc";
		const corruptBuffer = Buffer.from("NOT_A_VALID_VAULT_PAYLOAD");

		expect(() => {
			decryptConfigData(corruptBuffer, validKey);
		}).toThrow(/Invalid vault/i);
	});
});
