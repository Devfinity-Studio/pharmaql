import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import https from "https";
import http from "http";
import { APP_ROOT, isPackaged } from "./config";

export const API_SERVER_VERSION = process.env.API_SERVER_VERSION || "1.1.0";

interface ReleaseInfo {
  hasUpdate: boolean;
  version: string;
  sha256: string;
  downloadUrl: string;
  mandatory?: boolean;
  releaseNotes?: string;
}

/**
 * Checks the central PharmaQL Control Plane for available updates.
 */
export async function queryLatestRelease(): Promise<ReleaseInfo | null> {
  const controlPlaneUrl = (
    process.env.CONTROL_PLANE_URL || "https://pharmaql.devfinity.net"
  ).replace(/\/$/, "");
  const apiKey = process.env.API_SERVER_KEY || "";
  const queryUrl = `${controlPlaneUrl}/api/releases/latest?current_version=${API_SERVER_VERSION}&platform=win-x64`;

  return new Promise((resolve) => {
    const isHttps = queryUrl.startsWith("https://");
    const transport = isHttps ? https : http;

    const req = transport.get(
      queryUrl,
      {
        headers: {
          "x-api-key": apiKey,
          "User-Agent": `PharmaQL-API-Updater/${API_SERVER_VERSION}`,
        },
        timeout: 10000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Downloads the update binary to api-server.new and verifies its SHA-256 hash.
 */
export async function downloadAndVerifyPayload(
  downloadUrl: string,
  expectedSha256: string,
  destPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const isHttps = downloadUrl.startsWith("https://");
    const transport = isHttps ? https : http;
    const fileStream = fs.createWriteStream(destPath);
    const hashStream = crypto.createHash("sha256");

    const req = transport.get(
      downloadUrl,
      {
        headers: {
          "x-api-key": process.env.API_SERVER_KEY || "",
        },
        timeout: 60000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          fileStream.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          resolve(false);
          return;
        }

        res.on("data", (chunk) => {
          fileStream.write(chunk);
          hashStream.update(chunk);
        });

        res.on("end", () => {
          fileStream.end();
          const computedHash = hashStream.digest("hex").toLowerCase();
          const expected = expectedSha256.trim().toLowerCase();

          if (computedHash === expected) {
            console.log(`[AutoUpdater] ✅ Downloaded binary verified (SHA-256: ${computedHash.slice(0, 16)}...)`);
            resolve(true);
          } else {
            console.error(
              `[AutoUpdater] ❌ Integrity check failed! Expected ${expected}, got ${computedHash}. Discarding payload.`
            );
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            resolve(false);
          }
        });
      }
    );

    req.on("error", (err) => {
      console.error("[AutoUpdater] Download error:", err.message);
      fileStream.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      resolve(false);
    });

    req.on("timeout", () => {
      req.destroy();
      fileStream.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      resolve(false);
    });
  });
}

/**
 * Executes atomic swap of the binary and restarts the Windows service with automatic rollback.
 */
export function executeAtomicServiceSwap(newBinaryPath: string): void {
  const serviceName = process.env.NSSM_SERVICE_NAME || "PharmaQL-API";
  const port = process.env.PORT || "9443";
  const batchScriptPath = path.join(APP_ROOT, "apply-update.bat");

  const batchContent = `@echo off
rem =========================================================
rem PharmaQL Atomic Service Updater & Rollback Watchdog
rem =========================================================
timeout /t 2 /nobreak >nul

rem 1. Stop NSSM service
nssm stop "${serviceName}" >nul 2>&1
timeout /t 1 /nobreak >nul

rem 2. Backup current running executable
if exist "${path.join(APP_ROOT, "api-server.bak")}" del /f /q "${path.join(APP_ROOT, "api-server.bak")}"
move /y "${path.join(APP_ROOT, "api-server.exe")}" "${path.join(APP_ROOT, "api-server.bak")}" >nul

rem 3. Move new executable into place
move /y "${newBinaryPath}" "${path.join(APP_ROOT, "api-server.exe")}" >nul

rem 4. Restart NSSM service
nssm start "${serviceName}" >nul 2>&1
timeout /t 3 /nobreak >nul

rem 5. Health Check probe
curl -s -f http://127.0.0.1:${port}/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [PharmaQL Updater] Boot health check failed! Triggering automatic rollback...
    nssm stop "${serviceName}" >nul 2>&1
    move /y "${path.join(APP_ROOT, "api-server.bak")}" "${path.join(APP_ROOT, "api-server.exe")}" >nul
    nssm start "${serviceName}" >nul 2>&1
    echo [PharmaQL Updater] Rolled back to previous stable binary.
) else (
    echo [PharmaQL Updater] Update successfully verified and running.
)

rem 6. Cleanup updater script
del /f /q "%~f0"
`;

  fs.writeFileSync(batchScriptPath, batchContent, "utf8");

  console.log(
    `[AutoUpdater] 🚀 Spawning detached update runner and exiting to release binary file locks...`
  );

  // Spawn batch runner detached
  const child = spawn("cmd.exe", ["/c", batchScriptPath], {
    detached: true,
    stdio: "ignore",
    cwd: APP_ROOT,
  });
  child.unref();

  // Exit cleanly
  process.exit(0);
}

/**
 * Sends heartbeat telemetry to the PharmaQL Control Plane.
 */
export async function sendHeartbeat(): Promise<void> {
  const controlPlaneUrl = (
    process.env.CONTROL_PLANE_URL || "https://pharmaql.devfinity.net"
  ).replace(/\/$/, "");
  const apiKey = process.env.API_SERVER_KEY || "";
  const telemetryUrl = `${controlPlaneUrl}/api/releases/telemetry`;

  const payload = JSON.stringify({
    version: API_SERVER_VERSION,
    uptimeSeconds: Math.floor(process.uptime()),
    vaultSealed: fs.existsSync(path.join(APP_ROOT, "config.vault")),
    plaintextEnvPresent: fs.existsSync(path.join(APP_ROOT, ".env")),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });

  try {
    const isHttps = telemetryUrl.startsWith("https://");
    const transport = isHttps ? https : http;

    const req = transport.request(
      telemetryUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "x-api-key": apiKey,
        },
        timeout: 5000,
      },
      () => {}
    );
    req.on("error", () => {});
    req.write(payload);
    req.end();
  } catch {}
}

/**
 * Initializes the autonomous OTA updater loop.
 */
export function startAutoUpdaterDaemon(): void {
  // Only activate automated binary swap in packaged production binary on Windows
  if (!isPackaged && process.env.NODE_ENV !== "test") {
    console.log(
      `[AutoUpdater] Standalone packaged mode not active (running via source/node). Binary OTA auto-swap inactive.`
    );
  }

  // Periodic check interval (default: 15 minutes)
  const intervalMinutes = parseInt(process.env.UPDATE_CHECK_INTERVAL_MINUTES || "15", 10);
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  // Initial update check and heartbeat after 15 seconds
  setTimeout(async () => {
    await sendHeartbeat();
    await runUpdateCheckCycle();
  }, 15 * 1000).unref();

  // Recurring daemon
  setInterval(async () => {
    await sendHeartbeat();
    await runUpdateCheckCycle();
  }, intervalMs).unref();

  console.log(`[AutoUpdater] 🔄 Background OTA updater active (Checking every ${intervalMinutes}m).`);
}

/**
 * Single update check and apply cycle.
 */
export async function runUpdateCheckCycle(): Promise<boolean> {
  try {
    const release = await queryLatestRelease();
    if (!release || !release.hasUpdate || !release.downloadUrl) {
      return false;
    }

    console.log(
      `[AutoUpdater] 📦 New release detected: v${release.version} (Current: v${API_SERVER_VERSION}). Initiating OTA update...`
    );

    const newBinaryPath = path.join(APP_ROOT, "api-server.new");
    const verified = await downloadAndVerifyPayload(
      release.downloadUrl,
      release.sha256,
      newBinaryPath
    );

    if (verified && isPackaged) {
      console.log(`[AutoUpdater] Applying atomic update to v${release.version}...`);
      executeAtomicServiceSwap(newBinaryPath);
      return true;
    }
  } catch (err: any) {
    console.warn("[AutoUpdater] Update check cycle error:", err.message);
  }
  return false;
}

