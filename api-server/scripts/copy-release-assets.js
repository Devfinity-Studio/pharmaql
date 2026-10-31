const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release");
const logsDir = path.join(releaseDir, "logs");
const binDir = path.join(releaseDir, "bin");

console.log("[Release Pipeline] Assembling structured release package in:", releaseDir);

// 1. Ensure target directory structure exists
fs.mkdirSync(releaseDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(binDir, { recursive: true });

// 2. Ensure logs directory has .gitkeep
const gitkeepPath = path.join(logsDir, ".gitkeep");
if (!fs.existsSync(gitkeepPath)) {
  fs.writeFileSync(gitkeepPath, "# Directory reserved for NSSM service logs (stdout.log / stderr.log)\n");
}

// 3. Copy .env.example template to release/.env.example
const srcEnvExample = path.join(rootDir, ".env.example");
const destEnvExample = path.join(releaseDir, ".env.example");
if (fs.existsSync(srcEnvExample)) {
  fs.copyFileSync(srcEnvExample, destEnvExample);
  console.log("  ✓ Copied .env.example template");
} else {
  console.warn("  ! Warning: .env.example not found in", rootDir);
}

// 4. Copy NSSM binary to release/bin/nssm.exe
const srcNssm = path.join(rootDir, "bin", "nssm.exe");
const destNssm = path.join(binDir, "nssm.exe");
if (fs.existsSync(srcNssm)) {
  fs.copyFileSync(srcNssm, destNssm);
  console.log("  ✓ Copied 64-bit nssm.exe to release/bin/nssm.exe");
}

// 5. Generate install.bat and uninstall.bat helper scripts
const installBat = `@echo off
setlocal
cd /d "%~dp0"
title PharmaQL API Server - Windows Service Setup

echo ========================================================
echo  PharmaQL API Server - Windows Service Installation
echo ========================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [PharmaQL Installer] Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/k \"\"%~dpnx0\"\"' -Verb RunAs"
    exit /b
)

echo [PharmaQL Installer] Running elevated service setup...
"%~dp0api-server.exe" --install --source-dir "%~dp0"
echo.
pause
`;

const uninstallBat = `@echo off
setlocal
cd /d "%~dp0"
title PharmaQL API Server - Service Uninstaller

echo ========================================================
echo  PharmaQL API Server - Windows Service Uninstaller
echo ========================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [PharmaQL Installer] Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/k \"\"%~dpnx0\"\"' -Verb RunAs"
    exit /b
)

"%~dp0api-server.exe" --uninstall
echo.
pause
`;

fs.writeFileSync(path.join(releaseDir, "install.bat"), installBat, "utf8");
fs.writeFileSync(path.join(releaseDir, "uninstall.bat"), uninstallBat, "utf8");
console.log("  ✓ Generated install.bat and uninstall.bat runners");

// 6. Scan and copy any native C++ (.node) bindings if present in dependencies
function findNativeBindings(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["typescript", "tsup", "esbuild", "@yao-pkg", "rollup", "@rollup"].includes(entry.name)) {
        findNativeBindings(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name.endsWith(".node")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const nativeFiles = findNativeBindings(path.join(rootDir, "node_modules"));
if (nativeFiles.length > 0) {
  console.log(`  ✓ Discovered ${nativeFiles.length} native binary binding(s):`);
  for (const nativeFile of nativeFiles) {
    const dest = path.join(binDir, path.basename(nativeFile));
    fs.copyFileSync(nativeFile, dest);
    console.log(`    -> Copied ${path.basename(nativeFile)} to release/bin/`);
  }
} else {
  console.log("  ✓ No external native C++ .node bindings required (100% pure JS runtime).");
}

// 7. Verify release binary if already generated
const exePath = path.join(releaseDir, "api-server.exe");
if (fs.existsSync(exePath)) {
  const stats = fs.statSync(exePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`  ✓ Standalone Binary Verified: release/api-server.exe (${sizeMb} MB)`);
}

console.log("[Release Pipeline] Release structure assembly complete.\n");
