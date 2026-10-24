import path from "path";
import fs from "fs";
import dotenv from "dotenv";

/**
 * Robust Runtime Environment & Path Resolver for Standalone Executable & NSSM Services
 *
 * Inside a pkg-compiled binary:
 * - __dirname points to the virtual filesystem snapshot (C:\snapshot\...)
 * - process.cwd() under Windows SYSTEM service accounts defaults to C:\Windows\System32
 * - process.execPath always points to the physical binary on disk (e.g. C:\PharmaQL\release\api-server.exe)
 *
 * Therefore, path.dirname(process.execPath) guarantees reliable access to external
 * configuration (.env) and persistent assets regardless of the calling process working directory.
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
 * Initializes environment variables anchored to APP_ROOT.
 * 1. Checks for .env in the binary's root directory (APP_ROOT/.env).
 * 2. Falls back to process.cwd()/.env for local development.
 */
export function initializeEnvironment(): void {
  const candidatePaths = [
    path.join(APP_ROOT, ".env"),
    path.join(APP_ROOT, "..", ".env"),
    path.join(process.cwd(), ".env"),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`[PharmaQL API Server] Config loaded from: ${envPath}`);
      return;
    }
  }

  console.warn(
    `[PharmaQL API Server] ⚠️ WARNING: No .env configuration file found in ${APP_ROOT}. Ensure .env exists adjacent to api-server.exe.`
  );
  dotenv.config();
}

// Automatically initialize on import
initializeEnvironment();
