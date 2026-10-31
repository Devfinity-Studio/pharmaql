import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { getEmbeddedNssmBuffer } from "./nssm-embedded";
import { sealEnvironmentFile } from "./vault";

export const SERVICE_NAME = "pharmaql-api";
export const DEFAULT_PROGRAM_FILES =
  process.env["ProgramFiles"] || "C:\\Program Files";
export const TARGET_INSTALL_DIR = path.join(
  DEFAULT_PROGRAM_FILES,
  "PharmaQL-API"
);
export const TARGET_EXE_PATH = path.join(TARGET_INSTALL_DIR, "api-server.exe");

/**
 * Checks if the running binary is executing from the official Program Files location.
 */
export function isRunningFromInstalledLocation(): boolean {
  try {
    const currentExe = path.resolve(process.execPath);
    const targetExe = path.resolve(TARGET_EXE_PATH);
    return currentExe.toLowerCase() === targetExe.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Checks if the current process is running with administrative privileges.
 */
export function isUserAdmin(): boolean {
  try {
    // Attempting to query an administrative command
    execSync("net session", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Elevates the current executable via Windows UAC.
 */
export function requestElevation(args: string[] = ["--install"]): void {
  console.log("\n========================================================");
  console.log(" [PharmaQL Installer] Requesting Administrator Privileges");
  console.log("========================================================\n");
  console.log("Please accept the Windows UAC elevation prompt to continue...\n");

  const currentExe = process.execPath;
  const escapedArgs = args.map((a) => `\`"${a}\`"`).join(" ");
  const psCommand = `Start-Process -FilePath "${currentExe}" -ArgumentList "${escapedArgs}" -Verb RunAs`;

  try {
    spawnSync("powershell.exe", ["-NoProfile", "-Command", psCommand], {
      stdio: "inherit",
    });
  } catch (err: any) {
    console.error("Failed to trigger UAC elevation:", err.message);
  }
}

/**
 * Performs self-installation:
 * 1. Copies executable to %ProgramFiles%\PharmaQL-API\api-server.exe
 * 2. Unpacks embedded 64-bit nssm.exe to %ProgramFiles%\PharmaQL-API\bin\nssm.exe
 * 3. Migrates .env / config.vault and seals it
 * 4. Configures and starts the Windows Service via NSSM
 */
export function installPharmaQlService(): boolean {
  if (!isUserAdmin()) {
    console.log("[PharmaQL Installer] Administrator rights required. Elevating...");
    requestElevation(["--install"]);
    return true;
  }

  console.log("\n========================================================");
  console.log(" [PharmaQL Service Installer]");
  console.log(" Target: " + TARGET_INSTALL_DIR);
  console.log("========================================================\n");

  try {
    const currentExe = path.resolve(process.execPath);
    const sourceDir = path.dirname(currentExe);

    // 1. Create target folder structure
    const binDir = path.join(TARGET_INSTALL_DIR, "bin");
    const logsDir = path.join(TARGET_INSTALL_DIR, "logs");
    fs.mkdirSync(TARGET_INSTALL_DIR, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    // 2. Unpack embedded nssm.exe
    const nssmPath = path.join(binDir, "nssm.exe");
    console.log(`[1/5] Extracting embedded 64-bit NSSM manager to: ${nssmPath}`);
    const nssmBuffer = getEmbeddedNssmBuffer();
    fs.writeFileSync(nssmPath, nssmBuffer);

    // 3. Stop existing service if running before overwriting
    try {
      console.log(`[2/5] Stopping any running '${SERVICE_NAME}' service...`);
      execSync(`"${nssmPath}" stop "${SERVICE_NAME}"`, { stdio: "ignore" });
    } catch {
      // Not running or not installed yet
    }

    // Small delay to ensure file locks are released
    execSync("powershell -Command Start-Sleep -Milliseconds 500", { stdio: "ignore" });

    // 4. Copy api-server.exe into Program Files
    console.log(`[3/5] Installing api-server.exe into: ${TARGET_EXE_PATH}`);
    if (currentExe.toLowerCase() !== TARGET_EXE_PATH.toLowerCase()) {
      fs.copyFileSync(currentExe, TARGET_EXE_PATH);
    }

    // 5. Migrate config (.env or config.vault)
    console.log("[4/5] Migrating security configurations...");
    const srcVault = path.join(sourceDir, "config.vault");
    const destVault = path.join(TARGET_INSTALL_DIR, "config.vault");
    const srcEnv = path.join(sourceDir, ".env");
    const destEnv = path.join(TARGET_INSTALL_DIR, ".env");

    if (fs.existsSync(srcVault)) {
      fs.copyFileSync(srcVault, destVault);
      console.log("  ✓ Hardware-bound config.vault migrated successfully.");
    } else if (fs.existsSync(srcEnv)) {
      fs.copyFileSync(srcEnv, destEnv);
      console.log("  ✓ Found source .env file. Encrypting into zero-knowledge vault...");
      try {
        sealEnvironmentFile(destEnv, destVault);
        console.log("  🔒 Plaintext .env sealed into config.vault.");
      } catch (sealErr: any) {
        console.warn("  ! Note: Vault sealing warning:", sealErr.message);
      }
    } else if (!fs.existsSync(destVault)) {
      // Write sample .env if neither exists
      fs.writeFileSync(
        destEnv,
        "# PharmaQL Configuration\nPORT=9443\nCONTROL_PLANE_URL=https://pharmaql.devfinity.net\n",
        "utf8"
      );
      console.log("  ✓ Created starter .env template in installation directory.");
    }

    // 6. Register Windows Service with NSSM
    console.log(`[5/5] Configuring Windows Service '${SERVICE_NAME}' via NSSM...`);
    const nssmCmd = `"${nssmPath}"`;

    // Try installing service (fails silently if already installed)
    try {
      execSync(`${nssmCmd} install "${SERVICE_NAME}" "${TARGET_EXE_PATH}"`, {
        stdio: "ignore",
      });
    } catch {
      // Service might already exist, update parameters
      execSync(`${nssmCmd} set "${SERVICE_NAME}" Application "${TARGET_EXE_PATH}"`, {
        stdio: "ignore",
      });
    }

    // Service parameters
    execSync(`${nssmCmd} set "${SERVICE_NAME}" AppDirectory "${TARGET_INSTALL_DIR}"`, {
      stdio: "ignore",
    });
    execSync(
      `${nssmCmd} set "${SERVICE_NAME}" DisplayName "PharmaQL API Server"`,
      { stdio: "ignore" }
    );
    execSync(
      `${nssmCmd} set "${SERVICE_NAME}" Description "PharmaQL High-Performance On-Premise API Engine with Zero-Knowledge Vault"`,
      { stdio: "ignore" }
    );
    execSync(`${nssmCmd} set "${SERVICE_NAME}" Start SERVICE_AUTO_START`, {
      stdio: "ignore",
    });
    execSync(
      `${nssmCmd} set "${SERVICE_NAME}" AppStdout "${path.join(
        logsDir,
        "stdout.log"
      )}"`,
      { stdio: "ignore" }
    );
    execSync(
      `${nssmCmd} set "${SERVICE_NAME}" AppStderr "${path.join(
        logsDir,
        "stderr.log"
      )}"`,
      { stdio: "ignore" }
    );
    execSync(`${nssmCmd} set "${SERVICE_NAME}" AppStopMethodConsole 1500`, {
      stdio: "ignore",
    });
    execSync(`${nssmCmd} set "${SERVICE_NAME}" AppRestartDelay 5000`, {
      stdio: "ignore",
    });

    // 7. Start the service
    console.log(`\n🚀 Starting Windows Service '${SERVICE_NAME}'...`);
    execSync(`${nssmCmd} start "${SERVICE_NAME}"`, { stdio: "ignore" });

    // 8. Confirm running state
    let isRunning = false;
    for (let i = 0; i < 5; i++) {
      try {
        const query = execSync(`sc.exe query "${SERVICE_NAME}"`, {
          encoding: "utf8",
        });
        if (query.includes("RUNNING")) {
          isRunning = true;
          break;
        }
      } catch {
        // Retry
      }
      execSync("powershell -Command Start-Sleep -Milliseconds 1000", { stdio: "ignore" });
    }

    console.log("\n========================================================");
    if (isRunning) {
      console.log(" ✅ PharmaQL API Server Installed & Running as a Service!");
    } else {
      console.log(" ⚠️ Service registered. State pending startup.");
    }
    console.log(` 📂 Location: ${TARGET_INSTALL_DIR}`);
    console.log(` 🛠 Service Name: ${SERVICE_NAME}`);
    console.log(` 📜 Logs: ${path.join(logsDir, "stdout.log")}`);
    console.log("========================================================\n");

    // Optional graphical popup notification if running in interactive desktop session
    try {
      const msg = `PharmaQL API Server was successfully installed and started as a Windows Service (${SERVICE_NAME}) in ${TARGET_INSTALL_DIR}.`;
      execSync(
        `powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; [System.Windows.Forms.MessageBox]::Show('${msg}', 'PharmaQL API Service Installed', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)"`,
        { stdio: "ignore", timeout: 8000 }
      );
    } catch {
      // Non-interactive or suppressed
    }

    return true;
  } catch (err: any) {
    console.error(`\n❌ Installation Error: ${err.message}`);
    return false;
  }
}

/**
 * Uninstalls the service and stops processes.
 */
export function uninstallPharmaQlService(): boolean {
  if (!isUserAdmin()) {
    console.log("[PharmaQL Installer] Administrator rights required to uninstall. Elevating...");
    requestElevation(["--uninstall"]);
    return true;
  }

  console.log(`[PharmaQL Installer] Uninstalling '${SERVICE_NAME}' Windows Service...`);
  const nssmPath = path.join(TARGET_INSTALL_DIR, "bin", "nssm.exe");

  try {
    if (fs.existsSync(nssmPath)) {
      execSync(`"${nssmPath}" stop "${SERVICE_NAME}"`, { stdio: "ignore" });
      execSync(`"${nssmPath}" remove "${SERVICE_NAME}" confirm`, {
        stdio: "ignore",
      });
    } else {
      execSync(`sc.exe stop "${SERVICE_NAME}"`, { stdio: "ignore" });
      execSync(`sc.exe delete "${SERVICE_NAME}"`, { stdio: "ignore" });
    }
    console.log(`✅ Windows Service '${SERVICE_NAME}' uninstalled successfully.`);
    return true;
  } catch (err: any) {
    console.error(`❌ Failed to uninstall service: ${err.message}`);
    return false;
  }
}

