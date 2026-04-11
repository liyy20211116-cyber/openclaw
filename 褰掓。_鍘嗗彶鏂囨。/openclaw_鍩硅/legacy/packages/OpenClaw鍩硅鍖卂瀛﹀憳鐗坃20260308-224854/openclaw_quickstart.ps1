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

$hasOpenclaw = $null -ne (Get-Command openclaw -ErrorAction SilentlyContinue)

if (-not $hasOpenclaw) {
  Write-Host "OpenClaw not found. Installing openclaw@latest globally..." -ForegroundColor Cyan
  npm install -g openclaw@latest
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  try {
    $openclawVer = openclaw --version
    Write-Host "OpenClaw already installed: $openclawVer" -ForegroundColor Green
  } catch {
    Write-Host "OpenClaw command found. Starting gateway directly..." -ForegroundColor Green
  }
}

Write-Host "Starting Gateway on port 18789..." -ForegroundColor Green
Write-Host "Dashboard: http://127.0.0.1:18789/" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
openclaw gateway --port 18789 --verbose
