$ErrorActionPreference = "Stop"
$port = 18789
$dashboardUrl = "http://127.0.0.1:$port/"

function Test-GatewayRunning {
  try {
    $status = openclaw gateway status 2>&1 | Out-String
    if ($status -match "RPC probe:\s+ok") {
      return $true
    }
  } catch {
  }

  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -gt 0 }
  return $null -ne $connections
}

function Open-DashboardSoon {
  Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 4
    Start-Process $url
  } -ArgumentList $dashboardUrl | Out-Null
}

function Get-NodeMajorVersion {
  try {
    $nodeVerRaw = node -v
  } catch {
    return $null
  }

  $nodeVer = $nodeVerRaw -replace '^v', ''
  if (-not $nodeVer) {
    return $null
  }

  return [int]($nodeVer.Split('.')[0])
}

function Get-OpenClawCommand {
  return Get-Command openclaw -ErrorAction SilentlyContinue
}

function Install-OpenClawIfMissing {
  $cmd = Get-OpenClawCommand
  if ($cmd) {
    try {
      $openclawVer = openclaw --version
      Write-Host "OpenClaw already installed: $openclawVer" -ForegroundColor Green
    } catch {
      Write-Host "OpenClaw command found. Starting gateway directly..." -ForegroundColor Green
    }
    return $true
  }

  Write-Host "OpenClaw not found. Installing openclaw@latest globally..." -ForegroundColor Cyan
  npm install -g openclaw@latest
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Global install failed." -ForegroundColor Red
    Write-Host "Please check network/npm permissions, then rerun:" -ForegroundColor Yellow
    Write-Host "  npm install -g openclaw@latest" -ForegroundColor Yellow
    return $false
  }

  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
  $cmd = Get-OpenClawCommand
  if (-not $cmd) {
    Write-Host ""
    Write-Host "OpenClaw was installed, but the command is not visible in this shell yet." -ForegroundColor Yellow
    Write-Host "Please open a new PowerShell window, then run:" -ForegroundColor Yellow
    Write-Host "  openclaw --version" -ForegroundColor Yellow
    return $false
  }

  $openclawVer = openclaw --version
  Write-Host "OpenClaw installed successfully: $openclawVer" -ForegroundColor Green
  return $true
}

$nodeMajor = Get-NodeMajorVersion
if (-not $nodeMajor -or $nodeMajor -lt 22) {
  $current = if ($nodeMajor) { "v$nodeMajor" } else { "not installed" }
  Write-Host "Error: Node.js >= 22 required. Current: $current" -ForegroundColor Red
  Write-Host "Install from: https://nodejs.org/" -ForegroundColor Yellow
  exit 1
}

if (Test-GatewayRunning) {
  Write-Host "Gateway is already running." -ForegroundColor Green
  Write-Host "Dashboard: $dashboardUrl" -ForegroundColor Yellow
  Start-Process $dashboardUrl
  exit 0
}

if (-not (Install-OpenClawIfMissing)) {
  exit 1
}

Write-Host "Starting Gateway on port 18789..." -ForegroundColor Green
Write-Host "Dashboard: $dashboardUrl" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Open-DashboardSoon
openclaw gateway --port $port --verbose
