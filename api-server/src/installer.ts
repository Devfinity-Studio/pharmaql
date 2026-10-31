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
    execSync("net session", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the source directory where the user launched the executable from.
 */
export function resolveSourceDir(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--source-dir");
  if (idx !== -1 && args[idx + 1]) {
    return path.resolve(args[idx + 1]);
  }
  return path.dirname(path.resolve(process.execPath));
}

/**
 * Elevates the current executable via Windows UAC with the source directory preserved.
 */
export function requestElevation(args: string[] = ["--install"]): void {
  const currentExe = path.resolve(process.execPath);
  const sourceDir = resolveSourceDir();

  const fullArgs = [...args];
  if (!fullArgs.includes("--source-dir")) {
    fullArgs.push("--source-dir", sourceDir);
  }

  console.log("\n========================================================");
  console.log(" [PharmaQL Installer] Administrator Privileges Required");
  console.log("========================================================\n");
  console.log("Installing into C:\\Program Files and registering a Windows Service");
  console.log("requires elevated Administrator permissions.\n");
  console.log("👉 Please accept the Windows UAC prompt (or right-click and select 'Run as administrator').\n");

  const argString = fullArgs.map((a) => `\"${a}\"`).join(" ");
  const psCommand = `Start-Process cmd.exe -ArgumentList '/k \"\"${currentExe}\"\" ${argString}' -Verb RunAs`;

  try {
    spawnSync("powershell.exe", ["-NoProfile", "-Command", psCommand], {
      stdio: "ignore",
    });
  } catch (err: any) {
    console.error("Automatic elevation failed:", err.message);
  }
}

/**
 * Performs self-installation:
 * 1. Copies executable to %ProgramFiles%\PharmaQL-API\api-server.exe
 * 2. Unpacks embedded 64-bit nssm.exe to %ProgramFiles%\PharmaQL-API\bin\nssm.exe
 * 3. Migrates .env / config.vault and seals it into machine-bound vault
 * 4. Configures and starts the Windows Service via NSSM
 */
export function installPharmaQlService(): boolean {
  if (!isUserAdmin()) {
    console.log("[PharmaQL Installer] Administrator rights required. Requesting elevation...");
    requestElevation(["--install"]);
    return true;
  }

  console.log("\n========================================================");
  console.log(" [PharmaQL Service Installer]");
  console.log(" Target: " + TARGET_INSTALL_DIR);
  console.log("========================================================\n");

  try {
    const currentExe = path.resolve(process.execPath);
    const sourceDir = resolveSourceDir();

    console.log(`[1/5] Source Directory: ${sourceDir}`);
    console.log(`[1/5] Target Directory: ${TARGET_INSTALL_DIR}`);

    // 1. Create target folder structure
    const binDir = path.join(TARGET_INSTALL_DIR, "bin");
    const logsDir = path.join(TARGET_INSTALL_DIR, "logs");
    fs.mkdirSync(TARGET_INSTALL_DIR, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    // 2. Unpack embedded nssm.exe
    const nssmPath = path.join(binDir, "nssm.exe");
    console.log(`[2/5] Extracting embedded 64-bit NSSM manager to: ${nssmPath}`);
    const nssmBuffer = getEmbeddedNssmBuffer();
    fs.writeFileSync(nssmPath, nssmBuffer);

    // 3. Stop existing service if running before overwriting
    try {
      execSync(`"${nssmPath}" stop "${SERVICE_NAME}"`, { stdio: "ignore" });
    } catch {
      // Service not running or not installed
    }

    // Small delay to ensure file locks are released
    execSync("powershell -Command Start-Sleep -Milliseconds 500", { stdio: "ignore" });

    // 4. Copy api-server.exe into Program Files
    console.log(`[3/5] Installing api-server.exe into: ${TARGET_EXE_PATH}`);
    if (currentExe.toLowerCase() !== TARGET_EXE_PATH.toLowerCase()) {
      fs.copyFileSync(currentExe, TARGET_EXE_PATH);
      console.log("  ✓ Executable copied to Program Files.");
    }

    // 5. Migrate & Seal config (.env or config.vault)
    console.log("[4/5] Migrating and sealing configuration...");
    const destVault = path.join(TARGET_INSTALL_DIR, "config.vault");
    const destEnv = path.join(TARGET_INSTALL_DIR, ".env");

    // Candidates for source .env
    const candidateEnvs = [
      path.join(sourceDir, ".env"),
      path.join(process.cwd(), ".env"),
      path.join(TARGET_INSTALL_DIR, ".env"),
    ].filter((p) => fs.existsSync(p));

    // Candidates for existing source config.vault
    const candidateVaults = [
      path.join(sourceDir, "config.vault"),
      path.join(process.cwd(), "config.vault"),
    ].filter((p) => fs.existsSync(p) && p.toLowerCase() !== destVault.toLowerCase());

    if (candidateEnvs.length > 0) {
      const srcEnv = candidateEnvs[0];
      console.log(`  🔒 Found plaintext .env at: ${srcEnv}`);
      console.log(`  🔒 Encrypting into machine-bound vault: ${destVault}...`);

      const sealResult = sealEnvironmentFile(srcEnv, destVault, true);
      if (sealResult.success) {
        console.log(`  ✅ Successfully sealed ${sealResult.keysCount} keys into machine-bound config.vault.`);
        console.log(`  🗑️ Plaintext ${srcEnv} has been securely shredded and deleted.`);
      } else {
        console.warn(`  ⚠️ Vault sealing warning: ${sealResult.error}`);
      }

      // Also clean up any other stray .env files found in candidates
      for (const remainingEnv of candidateEnvs) {
        if (fs.existsSync(remainingEnv)) {
          try {
            fs.unlinkSync(remainingEnv);
            console.log(`  🗑️ Removed stray plaintext: ${remainingEnv}`);
          } catch {}
        }
      }
    } else if (candidateVaults.length > 0) {
      const srcVault = candidateVaults[0];
      fs.copyFileSync(srcVault, destVault);
      console.log(`  ✓ Hardware-bound config.vault copied from: ${srcVault}`);
    } else if (!fs.existsSync(destVault)) {
      // Write sample starter .env if neither exists
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
