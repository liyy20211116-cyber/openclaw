# OpenClaw Gateway Control Script
# Encoding: UTF-8

$ErrorActionPreference = "Stop"
$port = 18789
$dashboardUrl = "http://127.0.0.1:$port/"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:GEMINI_API_KEY = [System.Environment]::GetEnvironmentVariable("GEMINI_API_KEY","User")
$env:OPENAI_API_KEY = [System.Environment]::GetEnvironmentVariable("OPENAI_API_KEY","User")
$env:SILICONFLOW_API_KEY = [System.Environment]::GetEnvironmentVariable("SILICONFLOW_API_KEY","User")

function Confirm-OpenClaw {
  if (-not (Get-Command openclaw -ErrorAction SilentlyContinue)) {
    Write-Host "Error: openclaw command not found." -ForegroundColor Red
    Write-Host "Install with: npm install -g openclaw@latest" -ForegroundColor Yellow
    exit 1
  }
}

function Get-GatewayStatusText {
  try {
    return (openclaw gateway status 2>&1 | Out-String)
  } catch {
    return ""
  }
}

function Test-GatewayRunning {
  $statusText = Get-GatewayStatusText
  return ($statusText -match "RPC probe:\s+ok")
}

function Get-GatewayPids {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -gt 0 }

  if (-not $connections) {
    return @()
  }

  return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Show-Header {
  Write-Host ""
  Write-Host "OpenClaw Gateway Control" -ForegroundColor Cyan
  Write-Host "Dashboard: $dashboardUrl" -ForegroundColor Yellow
  Write-Host "Running: $(if (Test-GatewayRunning) { 'yes' } else { 'no' })" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "1. Start only (do nothing if already running)"
  Write-Host "2. Restart (force takeover on port 18789)"
  Write-Host "3. Stop (kill gateway process on port 18789)"
  Write-Host "4. Show status"
  Write-Host "5. Open dashboard"
  Write-Host "0. Exit"
  Write-Host ""
}

function Start-Gateway {
  if (Test-GatewayRunning) {
    Write-Host "OpenClaw Gateway is already running." -ForegroundColor Green
    Write-Host "Dashboard: $dashboardUrl" -ForegroundColor Yellow
    return
  }

  Write-Host "OpenClaw Gateway (port $port)..." -ForegroundColor Cyan
  Write-Host "Dashboard: $dashboardUrl" -ForegroundColor Yellow
  Write-Host "API Keys: Gemini=$($env:GEMINI_API_KEY -ne $null) | OpenAI=$($env:OPENAI_API_KEY -ne $null) | SiliconFlow=$($env:SILICONFLOW_API_KEY -ne $null)" -ForegroundColor DarkGray
  Write-Host "Ctrl+C to stop.`n" -ForegroundColor Gray
  openclaw gateway --port $port --verbose
}

function Restart-Gateway {
  if (Test-GatewayRunning) {
    Write-Host "Detected a running OpenClaw Gateway. Restarting now..." -ForegroundColor Yellow
  } else {
    Write-Host "OpenClaw Gateway is not currently reachable. Starting a fresh instance..." -ForegroundColor Yellow
  }

  Write-Host "Dashboard: $dashboardUrl" -ForegroundColor Yellow
  Write-Host "API Keys: Gemini=$($env:GEMINI_API_KEY -ne $null) | OpenAI=$($env:OPENAI_API_KEY -ne $null) | SiliconFlow=$($env:SILICONFLOW_API_KEY -ne $null)" -ForegroundColor DarkGray
  Write-Host "Ctrl+C to stop.`n" -ForegroundColor Gray
  openclaw gateway --port $port --force --verbose
}

function Stop-Gateway {
  $pids = Get-GatewayPids
  if ($pids.Count -eq 0) {
    Write-Host "No Gateway process is listening on port $port." -ForegroundColor Yellow
    return
  }

  foreach ($procId in $pids) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "Stopped Gateway process PID $procId." -ForegroundColor Green
    } catch {
      Write-Host "Failed to stop PID ${procId}: $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

function Show-GatewayStatus {
  openclaw gateway status
}

function Open-Dashboard {
  Start-Process $dashboardUrl
  Write-Host "Dashboard opened: $dashboardUrl" -ForegroundColor Green
}

Confirm-OpenClaw
Show-Header
$choice = Read-Host "Choose an action"

switch ($choice) {
  "1" { Start-Gateway }
  "2" { Restart-Gateway }
  "3" { Stop-Gateway }
  "4" { Show-GatewayStatus }
  "5" { Open-Dashboard }
  "0" { Write-Host "Exited." -ForegroundColor Gray }
  default {
    Write-Host "Invalid option. Re-run the script and choose 0-5." -ForegroundColor Red
    exit 1
  }
}
