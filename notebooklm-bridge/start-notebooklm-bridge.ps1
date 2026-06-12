$ErrorActionPreference = "Stop"

$PORT = 3100
if ($args.Count -gt 0) {
    $PORT = $args[0]
}

Write-Host "`n=== Oaktree: NotebookLM Bridge Launcher (Windows) ===" -ForegroundColor Cyan
Write-Host ""

# 1. Dependency: Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[X] node not found. Please install Node.js: https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "[?] node $nodeVersion found" -ForegroundColor Green

# 2. Dependency: cloudflared
if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "[!] cloudflared not found. Installing via winget..." -ForegroundColor Yellow
    winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "[X] cloudflared not found after install. Please install manually." -ForegroundColor Red
    exit 1
}
$cfVersion = (cloudflared --version) -split "`n" | Select-Object -First 1
Write-Host "[?] $cfVersion found" -ForegroundColor Green

# 3. Bridge server dir check
$BRIDGE_DIR = $PSScriptRoot
if (!(Test-Path "$BRIDGE_DIR\node_modules")) {
    Write-Host "[!] node_modules not found. Running npm install..." -ForegroundColor Yellow
    Push-Location $BRIDGE_DIR
    npm install
    Pop-Location
    Write-Host "[?] Dependencies installed" -ForegroundColor Green
}

# 4. Start bridge server
Write-Host "`n[1/2] Starting NotebookLM HTTP bridge on port $PORT..." -ForegroundColor Cyan

$env:PORT = $PORT
$bridgeProcess = Start-Process node -ArgumentList "$BRIDGE_DIR\src\bridge.js" -PassThru -NoNewWindow
Write-Host "    Bridge started (PID $($bridgeProcess.Id))" -ForegroundColor DarkGray
Start-Sleep -Seconds 2

if ($bridgeProcess.HasExited) {
    Write-Host "[X] Bridge process crashed immediately. Check if port $PORT is already in use." -ForegroundColor Red
    exit 1
}
Write-Host "[?] Bridge process is running — proceeding to tunnel setup." -ForegroundColor Green

# 5. Start Cloudflare Tunnel
Write-Host "`n[2/2] Starting Cloudflare Tunnel -> http://localhost:$PORT`n" -ForegroundColor Cyan
Write-Host "??=========================================================??" -ForegroundColor Yellow
Write-Host "??  Your public tunnel URL will appear below (look for https://)??" -ForegroundColor Yellow
Write-Host "??  Copy it and run:                                            ??" -ForegroundColor Yellow
Write-Host "??    cd mcp-worker                                             ??" -ForegroundColor Yellow
Write-Host "??    npx wrangler secret put NOTEBOOKLM_BRIDGE_URL             ??" -ForegroundColor Yellow
Write-Host "??=========================================================??`n" -ForegroundColor Yellow

Register-EngineEvent -SourceIdentifier ([System.Guid]::NewGuid().ToString()) -Action {
    Write-Host "`nShutting down..." -ForegroundColor Yellow
    if (!$bridgeProcess.HasExited) {
        Stop-Process -Id $bridgeProcess.Id -Force
        Write-Host "Bridge stopped (PID $($bridgeProcess.Id))" -ForegroundColor Green
    }
} | Out-Null

try {
    cloudflared tunnel --url "http://localhost:$PORT"
} finally {
    Write-Host "`nShutting down..." -ForegroundColor Yellow
    if (!$bridgeProcess.HasExited) {
        Stop-Process -Id $bridgeProcess.Id -Force
        Write-Host "Bridge stopped (PID $($bridgeProcess.Id))" -ForegroundColor Green
    }
}
