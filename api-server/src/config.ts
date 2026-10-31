import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import {
  sealEnvironmentFile,
  loadVaultIntoEnvironment,
  decryptConfigData,
} from "./vault";
import {
  installPharmaQlService,
  uninstallPharmaQlService,
  isRunningFromInstalledLocation,
  TARGET_EXE_PATH,
} from "./installer";

/**
 * Robust Runtime Environment & Path Resolver for Standalone Executable & NSSM Services
 *
 * Inside a pkg-compiled binary:
 * - __dirname points to the virtual filesystem snapshot (C:\snapshot\...)
 * - process.cwd() under Windows SYSTEM service accounts defaults to C:\Windows\System32
 * - process.execPath always points to the physical binary on disk (e.g. C:\PharmaQL\release\api-server.exe)
 *
 * Therefore, path.dirname(process.execPath) guarantees reliable access to external
 * configuration (.env / config.vault) and persistent assets regardless of the calling working directory.
 */

// Detect if running inside a packaged binary (@yao-pkg/pkg or Node SEA)
export const isPackaged = Boolean((process as any).pkg);

/**
 * Resolves the physical base directory of the server installation.
 */
export function getAppRootDir(): string {
  if (isPackaged) {
    return path.dirname(process.execPath);
  }
  return process.cwd();
}

export const APP_ROOT = getAppRootDir();

/**
 * CLI Command Handlers for Vault Sealing and Verification.
 * Returns true if a CLI command was processed (and the application should exit).
 */
export function handleVaultCliCommands(): boolean {
  const args = process.argv.slice(2);
  // Command: --install (Explicit Windows Service installation)
  if (args.includes("--install")) {
    installPharmaQlService();
    process.exit(0);
  }

  // Command: --uninstall (Explicit Windows Service removal)
  if (args.includes("--uninstall")) {
    uninstallPharmaQlService();
    process.exit(0);
  }

  // Self-installer: Running outside Program Files triggers automatic Windows Service setup
  if (isPackaged && !isRunningFromInstalledLocation() && !args.includes("--run-direct")) {
    console.log("[PharmaQL API Server] Initial launch detected outside installation directory.");
    console.log(`  Current location: ${process.execPath}`);
    console.log(`  Target location:  ${TARGET_EXE_PATH}`);
    console.log("\nInitializing automatic installation into Program Files & Windows Service setup...");
    installPharmaQlService();
    process.exit(0);
  }


  // Command: --seal
  if (args.includes("--seal")) {
    console.log("[PharmaQL Vault] 🔒 Sealing configuration into machine-bound config.vault...");
    const envCandidate = [
      path.join(APP_ROOT, ".env"),
      path.join(process.cwd(), ".env"),
    ].find((p) => fs.existsSync(p));

    if (!envCandidate) {
      console.error(`[PharmaQL Vault] ❌ Error: No .env file found in ${APP_ROOT} to seal.`);
      process.exit(1);
    }

    const vaultPath = path.join(APP_ROOT, "config.vault");
    const result = sealEnvironmentFile(envCandidate, vaultPath, true);

    if (result.success) {
      console.log(
        `[PharmaQL Vault] ✅ Successfully sealed ${result.keysCount} environment variables into:\n  -> ${vaultPath}`
      );
      console.log("[PharmaQL Vault] Plaintext .env securely wiped and removed. Your server is protected.");
      process.exit(0);
    } else {
      console.error(`[PharmaQL Vault] ❌ Sealing failed: ${result.error}`);
      process.exit(1);
    }
  }

  // Command: --verify-vault
  if (args.includes("--verify-vault")) {
    console.log("[PharmaQL Vault] 🔍 Verifying machine-bound config.vault integrity...");
    const vaultPath = path.join(APP_ROOT, "config.vault");

    if (!fs.existsSync(vaultPath)) {
      console.error(`[PharmaQL Vault] ❌ Error: No config.vault found at: ${vaultPath}`);
      process.exit(1);
    }

    try {
      const buffer = fs.readFileSync(vaultPath);
      const data = decryptConfigData(buffer);
      console.log(`[PharmaQL Vault] ✅ Vault verified! (${Object.keys(data).length} keys authenticated)`);
      for (const [k, v] of Object.entries(data)) {
        const masked =
          k.toLowerCase().includes("pass") ||
          k.toLowerCase().includes("key") ||
          k.toLowerCase().includes("secret")
            ? "********"
            : v;
        console.log(`  • ${k}: ${masked}`);
      }
      process.exit(0);
    } catch (err: any) {
      console.error(`[PharmaQL Vault] ❌ Verification failed: ${err.message}`);
      process.exit(1);
    }
  }

  return false;
}

/**
 * Initializes environment variables anchored to APP_ROOT.
 * 1. Checks for machine-bound config.vault (Highest Priority - Zero Plaintext Exposure).
 * 2. Falls back to plaintext .env in APP_ROOT or cwd() for development.
 */
export function initializeEnvironment(): void {
  // Check if CLI flags were passed
  if (handleVaultCliCommands()) {
    return;
  }

  // 1. Check for encrypted config.vault
  const candidateVaultPaths = [
    path.join(APP_ROOT, "config.vault"),
    path.join(APP_ROOT, "..", "config.vault"),
    path.join(process.cwd(), "config.vault"),
  ];

  for (const vaultPath of candidateVaultPaths) {
    if (fs.existsSync(vaultPath)) {
      const loaded = loadVaultIntoEnvironment(vaultPath);
      if (loaded) {
        // Check if an accidental plaintext .env is still lingering
        const lingeringEnv = path.join(path.dirname(vaultPath), ".env");
        if (fs.existsSync(lingeringEnv)) {
          console.warn(
            `[PharmaQL Vault] ⚠️ SECURITY NOTICE: Plaintext .env detected at ${lingeringEnv}. Run 'api-server.exe --seal' or delete it to ensure zero plaintext exposure.`
          );
        }
        return;
      }
    }
  }

  // 2. Fallback to plaintext .env (Development mode)
  const candidateEnvPaths = [
    path.join(APP_ROOT, ".env"),
    path.join(APP_ROOT, "..", ".env"),
    path.join(process.cwd(), ".env"),
  ];

  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`[PharmaQL API Server] Config loaded from plaintext: ${envPath}`);
      console.log(
        "[PharmaQL Vault] 💡 Run 'api-server.exe --seal' to encrypt this .env into a machine-bound config.vault."
      );
      return;
    }
  }

  console.warn(
    `[PharmaQL API Server] ⚠️ WARNING: No config.vault or .env found in ${APP_ROOT}.`
  );
  dotenv.config();
}

// Automatically initialize on import
initializeEnvironment();
