# OpenClaw quick install and start (ASCII-safe)
$ErrorActionPreference = "Stop"

$nodeVerRaw = ""
try {
  $nodeVerRaw = (node -v)
} catch {
  $nodeVerRaw = ""
}

$nodeVer = $nodeVerRaw -replace '^v', ''
$major = 0
if ($nodeVer) {
  $major = [int]($nodeVer.Split('.')[0])
}

if (-not $nodeVer -or $major -lt 22) {
  $current = if ($nodeVer) { "v$nodeVer" } else { "not installed" }
  Write-Host "Error: Node.js >= 22 required. Current: $current" -ForegroundColor Red
  Write-Host "Install from: https://nodejs.org/" -ForegroundColor Yellow
  exit 1
}

Write-Host "Installing openclaw@latest globally..." -ForegroundColor Cyan
npm install -g openclaw@latest
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Install done. Starting Gateway on port 18789..." -ForegroundColor Green
Write-Host "Dashboard: http://127.0.0.1:18789/" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
openclaw gateway --port 18789 --verbose