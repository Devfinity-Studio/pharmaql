import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

// Magic header: "PQLV" (PharmaQL Vault)
const VAULT_MAGIC = Buffer.from([0x50, 0x51, 0x4c, 0x56]);
const VAULT_VERSION = 1;
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits

/**
 * Retrieves the unique machine identifier for key binding.
 * On Windows, reads MachineGuid from registry.
 * Falls back to composite hardware fingerprint if registry query fails or on non-Windows OS.
 */
export function getMachineFingerprint(): string {
  let machineGuid = "";

  if (process.platform === "win32") {
    try {
      const regOutput = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 3000 }
      );
      const match = regOutput.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]+)/i);
      if (match && match[1]) {
        machineGuid = match[1].trim();
      }
    } catch {
      // Reg query fallback
    }
  }

  // Composite hardware components
  const hostname = os.hostname().toLowerCase();
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0]?.model || "cpu" : "cpu";
  const arch = os.arch();
  const platform = os.platform();

  const networkInterfaces = os.networkInterfaces();
  const macAddresses: string[] = [];
  for (const name of Object.keys(networkInterfaces)) {
    const netList = networkInterfaces[name];
    if (netList) {
      for (const net of netList) {
        if (!net.internal && net.mac && net.mac !== "00:00:00:00:00:00") {
          macAddresses.push(net.mac);
        }
      }
    }
  }
  macAddresses.sort();
  const primaryMac = macAddresses[0] || "default-mac";

  // Combine into a machine-bound entropy string
  const rawEntropy = `${machineGuid}::${hostname}::${cpuModel}::${arch}::${platform}::${primaryMac}::PharmaQL_OnPremise_Vault_Key`;
  return crypto.createHash("sha256").update(rawEntropy).digest("hex");
}

/**
 * Derives a 256-bit encryption key from the machine fingerprint and a random salt.
 */
function deriveKey(fingerprint: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    fingerprint,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    "sha256"
  );
}

/**
 * Encrypts a configuration object into a machine-bound config.vault binary buffer.
 */
export function encryptConfigData(
  config: Record<string, string>,
  customFingerprint?: string
): Buffer {
  const fingerprint = customFingerprint || getMachineFingerprint();
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM

  const key = deriveKey(fingerprint, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const jsonPayload = JSON.stringify(config);
  const ciphertext = Buffer.concat([
    cipher.update(jsonPayload, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16-byte authentication tag

  // Assemble binary vault:
  // [4 bytes Magic] [1 byte Version] [16 bytes Salt] [12 bytes IV] [16 bytes AuthTag] [Ciphertext]
  return Buffer.concat([
    VAULT_MAGIC,
    Buffer.from([VAULT_VERSION]),
    salt,
    iv,
    authTag,
    ciphertext,
  ]);
}

/**
 * Decrypts a config.vault binary buffer into memory.
 * Fails with an error if the vault was tampered with or run on a different machine.
 */
export function decryptConfigData(
  vaultBuffer: Buffer,
  customFingerprint?: string
): Record<string, string> {
  if (vaultBuffer.length < 49) {
    throw new Error("Invalid vault file: Corrupted or incomplete header.");
  }

  // 1. Validate magic header
  const magic = vaultBuffer.subarray(0, 4);
  if (!magic.equals(VAULT_MAGIC)) {
    throw new Error("Invalid vault format: Missing PharmaQL Vault magic signature.");
  }

  // 2. Validate version
  const version = vaultBuffer.readUInt8(4);
  if (version !== VAULT_VERSION) {
    throw new Error(`Unsupported vault version: ${version} (expected ${VAULT_VERSION}).`);
  }

  // 3. Extract components
  const salt = vaultBuffer.subarray(5, 21); // 16 bytes
  const iv = vaultBuffer.subarray(21, 33); // 12 bytes
  const authTag = vaultBuffer.subarray(33, 49); // 16 bytes
  const ciphertext = vaultBuffer.subarray(49);

  // 4. Derive key from current machine fingerprint
  const fingerprint = customFingerprint || getMachineFingerprint();
  const key = deriveKey(fingerprint, salt);

  // 5. Decrypt and authenticate
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decryptedJson = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(decryptedJson);
  } catch (err: any) {
    throw new Error(
      "Decryption failed: Machine fingerprint mismatch or corrupted vault file. " +
        "The vault cannot be decrypted on this computer."
    );
  }
}

/**
 * Encrypts an existing .env file into config.vault and securely removes .env.
 */
export function sealEnvironmentFile(
  envFilePath: string,
  vaultFilePath: string,
  deletePlaintext = true
): { success: boolean; keysCount: number; error?: string } {
  try {
    if (!fs.existsSync(envFilePath)) {
      return { success: false, keysCount: 0, error: `File not found: ${envFilePath}` };
    }

    const rawContent = fs.readFileSync(envFilePath, "utf8");
    const lines = rawContent.split(/\r?\n/);
    const parsedConfig: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Remove enclosing quotes if present
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        parsedConfig[key] = val;
      }
    }

    const keysCount = Object.keys(parsedConfig).length;
    if (keysCount === 0) {
      return { success: false, keysCount: 0, error: "No environment variables found in .env." };
    }

    // Encrypt and write vault
    const vaultBuffer = encryptConfigData(parsedConfig);
    fs.writeFileSync(vaultFilePath, vaultBuffer);

    // Verify vault immediately before touching .env
    const verifyBuffer = fs.readFileSync(vaultFilePath);
    const verifiedData = decryptConfigData(verifyBuffer);
    if (Object.keys(verifiedData).length !== keysCount) {
      throw new Error("Integrity verification failed immediately after write.");
    }

    // Securely wipe and remove plaintext .env if requested
    if (deletePlaintext) {
      const randomPadding = crypto.randomBytes(rawContent.length);
      fs.writeFileSync(envFilePath, randomPadding);
      fs.unlinkSync(envFilePath);
      console.log(`[Vault] Securely wiped and deleted plaintext: ${envFilePath}`);
    }

    return { success: true, keysCount };
  } catch (err: any) {
    return { success: false, keysCount: 0, error: err.message || "Failed to seal environment file." };
  }
}

/**
 * Loads and decrypts config.vault from a specified path into process.env.
 */
export function loadVaultIntoEnvironment(vaultFilePath: string): boolean {
  if (!fs.existsSync(vaultFilePath)) {
    return false;
  }

  try {
    const vaultBuffer = fs.readFileSync(vaultFilePath);
    const config = decryptConfigData(vaultBuffer);

    let loadedCount = 0;
    for (const [key, value] of Object.entries(config)) {
      process.env[key] = value;
      loadedCount++;
    }

    console.log(
      `[PharmaQL Vault] 🔒 Successfully decrypted machine-bound config.vault (${loadedCount} keys loaded directly into RAM).`
    );
    return true;
  } catch (err: any) {
    console.error(`[PharmaQL Vault] ❌ CRITICAL: ${err.message}`);
    return false;
  }
}

