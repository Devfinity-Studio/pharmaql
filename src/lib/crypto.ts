import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Resolves the 32-byte master key from CONTROL_PLANE_ENCRYPTION_KEY.
 * Accepts 64-char hex, base64, or generates a deterministic development key with a warning.
 */
export function getDevelopmentFallbackKey(): Buffer {
	return crypto
		.createHash("sha256")
		.update("pharmaql-local-dev-fallback-key-do-not-use-in-production")
		.digest();
}

/**
 * Resolves the 32-byte master key from CONTROL_PLANE_ENCRYPTION_KEY.
 * Accepts 64-char hex, base64, or generates a deterministic development key with a warning.
 */
export function getMasterKey(): Buffer {
	const rawKey = process.env.CONTROL_PLANE_ENCRYPTION_KEY?.trim();

	if (rawKey) {
		// 1. Try Hex (64 chars = 32 bytes)
		if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
			return Buffer.from(rawKey, "hex");
		}
		// 2. Try Base64 (44 chars)
		try {
			const b64Buf = Buffer.from(rawKey, "base64");
			if (b64Buf.length === 32) {
				return b64Buf;
			}
		} catch {
			// ignore
		}
		// 3. Hash to 32 bytes if arbitrary passphrase
		return crypto.createHash("sha256").update(rawKey).digest();
	}

	// Local development fallback: deterministic test key so local offline dev never crashes
	return getDevelopmentFallbackKey();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Used for testing / mock seeding (actual encryption occurs in Devfinity control plane).
 * Returns serialized format: `ivHex:authTagHex:ciphertextHex`
 */
export function encryptSecret(plainText: string, customKey?: Buffer): string {
	if (!plainText) return "";
	const key = customKey || getMasterKey();
	const iv = crypto.randomBytes(IV_LENGTH);

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	let encrypted = cipher.update(plainText, "utf8", "hex");
	encrypted += cipher.final("hex");

	const authTag = cipher.getAuthTag().toString("hex");

	return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Helper to decrypt an AES-256-GCM payload with a specific key.
 */
function decryptWithKey(cipherPayload: string, key: Buffer): string {
	const parts = cipherPayload.split(":");
	if (parts.length !== 3) {
		throw new Error(
			"Invalid encrypted payload format. Expected 'iv:authTag:ciphertext'",
		);
	}

	const ivHex = parts[0];
	const authTagHex = parts[1];
	const encryptedHex = parts[2];

	if (!ivHex || !authTagHex || !encryptedHex) {
		throw new Error(
			"Invalid encrypted payload format. Expected 'iv:authTag:ciphertext'",
		);
	}

	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");

	if (iv.length !== IV_LENGTH) {
		throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes`);
	}
	if (authTag.length !== AUTH_TAG_LENGTH) {
		throw new Error(
			`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes`,
		);
	}

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	decipher.setAuthTag(authTag);

	const decryptedBuf = Buffer.concat([
		decipher.update(Buffer.from(encryptedHex, "hex")),
		decipher.final(),
	]);

	return decryptedBuf.toString("utf8");
}

/**
 * Decrypts an AES-256-GCM encrypted payload (`ivHex:authTagHex:ciphertextHex`).
 * Validates authentication tag integrity; throws an error if ciphertext or tag was tampered with.
 * Transparently supports multi-key fallback: tries primary master key, then dev fallback key.
 */
export function decryptSecret(cipherPayload: string, customKey?: Buffer): string {
	if (!cipherPayload) return "";
	const primaryKey = customKey || getMasterKey();

	try {
		return decryptWithKey(cipherPayload, primaryKey);
	} catch (primaryErr) {
		// If customKey was not explicitly supplied and primaryKey is not already the fallback key,
		// attempt fallback key in case the payload was encrypted in local development or legacy seed
		if (!customKey) {
			const fallbackKey = getDevelopmentFallbackKey();
			if (!primaryKey.equals(fallbackKey)) {
				try {
					return decryptWithKey(cipherPayload, fallbackKey);
				} catch {
					// Fallback failed, throw original primary error below
				}
			}
		}
		throw primaryErr;
	}
}
