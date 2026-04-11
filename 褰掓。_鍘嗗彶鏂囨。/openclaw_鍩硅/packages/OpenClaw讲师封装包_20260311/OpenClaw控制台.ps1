param(
  [string]$Choice
)

$ErrorActionPreference = "Stop"
$port = 18789
$dashboardUrl = "http://127.0.0.1:$port/"
$gatewayCmdPath = Join-Path $env:USERPROFILE ".openclaw\gateway.cmd"

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
  if ($statusText -match "RPC probe:\s+ok") {
    return $true
  }

  return (Get-GatewayPids).Count -gt 0
}

function Get-GatewayPids {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -gt 0 }

  if (-not $connections) {
    return @()
  }

  return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Get-GatewayToken {
  $token = [System.Environment]::GetEnvironmentVariable("OPENCLAW_GATEWAY_TOKEN","Process")
  if (-not $token) {
    $token = [System.Environment]::GetEnvironmentVariable("OPENCLAW_GATEWAY_TOKEN","User")
  }
  if (-not $token) {
    $token = [System.Environment]::GetEnvironmentVariable("OPENCLAW_GATEWAY_TOKEN","Machine")
  }
  if ($token) {
    return $token.Trim()
  }

  if (-not (Test-Path $gatewayCmdPath)) {
    return $null
  }

  $line = Get-Content $gatewayCmdPath | Where-Object { $_ -match 'OPENCLAW_GATEWAY_TOKEN=' } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  if ($line -match 'OPENCLAW_GATEWAY_TOKEN=([^"]+)') {
    return $matches[1].Trim()
  }

  return $null
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

function Wait-ForContinue {
  Write-Host ""
  [void](Read-Host "Press Enter to continue")
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
  $token = Get-GatewayToken
  if ($token) {
    try {
      Set-Clipboard -Value $token
      Write-Host "Gateway token copied to clipboard." -ForegroundColor Green
      Write-Host "If Control UI asks for a token, paste it into Settings." -ForegroundColor Yellow
    } catch {
      Write-Host "Gateway token found but could not be copied automatically." -ForegroundColor Yellow
    }
  } else {
    Write-Host "Gateway token not found. Dashboard may ask for it." -ForegroundColor Yellow
  }

  Start-Process $dashboardUrl
  Write-Host "Dashboard opened: $dashboardUrl" -ForegroundColor Green
}

function Invoke-MenuAction {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SelectedChoice
  )

  switch ($SelectedChoice) {
    "1" {
      Start-Gateway
      return $false
    }
    "2" {
      Restart-Gateway
      return $false
    }
    "3" {
      Stop-Gateway
      return $false
    }
    "4" {
      Show-GatewayStatus
      return $false
    }
    "5" {
      Open-Dashboard
      return $false
    }
    "0" {
      Write-Host "Exited." -ForegroundColor Gray
      return $true
    }
    default {
      Write-Host "Invalid option. Re-run the script and choose 0-5." -ForegroundColor Red
      return $false
    }
  }
}

Confirm-OpenClaw
$isInteractiveMenu = -not $PSBoundParameters.ContainsKey('Choice')

if (-not $isInteractiveMenu) {
  Show-Header
  $shouldExit = Invoke-MenuAction -SelectedChoice $Choice
  exit 0
}

while ($true) {
  Show-Header
  $Choice = Read-Host "Choose an action"

  try {
    $shouldExit = Invoke-MenuAction -SelectedChoice $Choice
  } catch {
    Write-Host "Action failed: $($_.Exception.Message)" -ForegroundColor Red
    $shouldExit = $false
  }

  if ($shouldExit) {
    break
  }

  Wait-ForContinue
}
