param(
  [string]$Choice
)

$ErrorActionPreference = "Stop"
$port = 18789
$dashboardUrl = "http://127.0.0.1:$port/"
$gatewayCmdPath = Join-Path $env:USERPROFILE ".openclaw\gateway.cmd"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$npmBin = Join-Path $env:APPDATA "npm"
if (Test-Path $npmBin) {
  $env:Path = "$npmBin;$env:Path"
}
$env:GEMINI_API_KEY = [System.Environment]::GetEnvironmentVariable("GEMINI_API_KEY","User")
$env:OPENAI_API_KEY = [System.Environment]::GetEnvironmentVariable("OPENAI_API_KEY","User")
$env:SILICONFLOW_API_KEY = [System.Environment]::GetEnvironmentVariable("SILICONFLOW_API_KEY","User")

function Confirm-OpenClaw {
  if (-not (Get-Command openclaw -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 找不到 openclaw 命令（从资源管理器启动时可能未加载 npm 全局路径）。" -ForegroundColor Red
    Write-Host "已尝试将 $($env:APPDATA)\npm 加入 PATH。若仍失败，请执行: npm install -g openclaw@latest" -ForegroundColor Yellow
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
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return $r.StatusCode -eq 200
  } catch {
    return (Get-GatewayPids).Count -gt 0
  }
}

function Get-GatewayPids {
  $pids = @()
  $lines = netstat -ano 2>$null | Select-String ":$port\s.*LISTENING"
  foreach ($line in $lines) {
    if ($line -match '\s(\d+)\s*$') {
      $pids += [int]$matches[1]
    }
  }
  if ($pids.Count -eq 0) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -gt 0 }
    if ($connections) {
      $pids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
    }
  }
  return @($pids | Select-Object -Unique)
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

$jarvisRoot = $null
$walkDir = $PSScriptRoot
for ($i = 0; $i -lt 12; $i++) {
  if (-not $walkDir) { break }
  $candidate = Join-Path $walkDir "jarvis-one-company-os"
  if (Test-Path $candidate) {
    $jarvisRoot = $candidate
    break
  }
  $walkDir = Split-Path $walkDir -Parent
}
if (-not $jarvisRoot) {
  $jarvisRoot = Join-Path $PSScriptRoot "jarvis-one-company-os"
}
$jarvisApiPort = 18782
$jarvisUiPort = 5173
$jarvisUrl = "http://127.0.0.1:${jarvisUiPort}/"

function Test-JarvisRunning {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$jarvisApiPort/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return $r.StatusCode -eq 200
  } catch {
    $lines = netstat -ano 2>$null | Select-String ":$jarvisApiPort\s.*LISTENING"
    return $lines.Count -gt 0
  }
}

function Get-JarvisPids {
  $pids = @()
  foreach ($p in @($jarvisApiPort, $jarvisUiPort)) {
    $lines = netstat -ano 2>$null | Select-String ":$p\s.*LISTENING"
    foreach ($line in $lines) {
      if ($line -match '\s(\d+)\s*$') {
        $pids += [int]$matches[1]
      }
    }
  }
  return @($pids | Select-Object -Unique)
}

function Stop-PortProcess {
  param([int]$Port)
  $lines = netstat -ano 2>$null | Select-String ":$Port\s.*LISTENING"
  foreach ($line in $lines) {
    if ($line -match '\s(\d+)\s*$') {
      $killPid = [int]$matches[1]
      try {
        Stop-Process -Id $killPid -Force -ErrorAction Stop
        Write-Host "  Killed stale process PID $killPid on port $Port" -ForegroundColor DarkGray
      } catch {}
    }
  }
  if ($lines.Count -gt 0) { Start-Sleep -Milliseconds 500 }
}

function Start-Jarvis {
  if (Test-JarvisRunning) {
    Write-Host "Jarvis One Company OS is already running." -ForegroundColor Green
    Write-Host "Dashboard: $jarvisUrl" -ForegroundColor Yellow
    return
  }

  Stop-PortProcess -Port $jarvisApiPort
  Stop-PortProcess -Port $jarvisUiPort

  if (-not (Test-Path (Join-Path $jarvisRoot "node_modules"))) {
    Write-Host "Installing dependencies (first time only)..." -ForegroundColor Yellow
    Push-Location $jarvisRoot
    npm install 2>&1 | Out-Null
    Pop-Location
  }

  Write-Host "Starting Jarvis One Company OS (Desktop)..." -ForegroundColor Cyan
  Write-Host "  API: http://127.0.0.1:$jarvisApiPort" -ForegroundColor DarkGray
  Write-Host "  Mode: Electron Desktop App" -ForegroundColor Yellow

  $jvLogFile = Join-Path $env:TEMP "jarvis_os.log"
  $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue).Source
  if (-not $npmCmd) { $npmCmd = "npm" }

  Start-Process powershell -ArgumentList "-NoProfile -Command `"`$Host.UI.RawUI.WindowTitle = 'Jarvis One Company OS'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host '  Jarvis One Company OS - Backend' -ForegroundColor Cyan; Write-Host '  API: http://127.0.0.1:$jarvisApiPort' -ForegroundColor DarkGray; Write-Host '  Log: $jvLogFile' -ForegroundColor DarkGray; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; Set-Location '$jarvisRoot'; & '$npmCmd' run dev:full 2>&1 | Tee-Object -FilePath '$jvLogFile'`""
  Write-Host "  Backend log: $jvLogFile" -ForegroundColor DarkGray

  $jvReady = $false
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    if (Test-JarvisRunning) {
      $jvReady = $true
      break
    }
    Write-Host "  Waiting for backend... ($($i*2+2)s)" -ForegroundColor DarkGray
  }

  if (-not $jvReady) {
    Write-Host "  WARNING: Backend did not start in 30s. Check log: $jvLogFile" -ForegroundColor Red
    return
  }

  Write-Host "  Backend ready. Launching desktop window..." -ForegroundColor Green

  $electronExe = Join-Path $jarvisRoot "node_modules\electron\dist\electron.exe"
  $electronMain = Join-Path $jarvisRoot "dist-electron\main.js"

  if (-not (Test-Path $electronExe)) {
    Write-Host "  Electron not found. Falling back to browser..." -ForegroundColor Yellow
    Start-Process $jarvisUrl
    return
  }

  if (-not (Test-Path $electronMain)) {
    Write-Host "  Compiling Electron main process..." -ForegroundColor DarkGray
    Push-Location $jarvisRoot
    npx tsc -p tsconfig.electron.json 2>&1 | Out-Null
    Pop-Location
  }

  $env:JARVIS_DESKTOP_URL = "http://localhost:$jarvisUiPort"
  Start-Process -FilePath $electronExe -ArgumentList "`"$electronMain`"" -WorkingDirectory $jarvisRoot
  Write-Host "Jarvis OS desktop window opened!" -ForegroundColor Green
}

function Stop-Jarvis {
  $pids = Get-JarvisPids
  if ($pids.Count -eq 0) {
    Write-Host "Jarvis One Company OS is not running." -ForegroundColor Yellow
    return
  }
  foreach ($procId in $pids) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "Stopped Jarvis process PID $procId." -ForegroundColor Green
    } catch {
      Write-Host "Failed to stop PID ${procId}: $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

function Start-AllServices {
  Write-Host ""
  Write-Host "=== Starting All Services ===" -ForegroundColor Cyan
  Write-Host ""

  if (-not (Test-GatewayRunning)) {
    Write-Host "[1/2] Starting OpenClaw Gateway..." -ForegroundColor Cyan

    $openclawCmd = (Get-Command openclaw -ErrorAction SilentlyContinue).Source
    if (-not $openclawCmd) { $openclawCmd = "openclaw" }
    $gwLogFile = Join-Path $env:TEMP "openclaw_gateway.log"
    Start-Process powershell -ArgumentList "-NoProfile -Command `"`$Host.UI.RawUI.WindowTitle = 'openclaw-gateway'; Write-Host '========================================' -ForegroundColor Green; Write-Host '  OpenClaw Gateway' -ForegroundColor Green; Write-Host '  Port: $port' -ForegroundColor DarkGray; Write-Host '  Dashboard: http://127.0.0.1:$port/' -ForegroundColor DarkGray; Write-Host '  Log: $gwLogFile' -ForegroundColor DarkGray; Write-Host '========================================' -ForegroundColor Green; Write-Host ''; & '$openclawCmd' gateway --port $port --force --verbose 2>&1 | Tee-Object -FilePath '$gwLogFile'`""
    Write-Host "  OpenClaw Gateway starting on port $port (log: $gwLogFile)..." -ForegroundColor Green

    $gwReady = $false
    for ($i = 0; $i -lt 20; $i++) {
      Start-Sleep -Seconds 2
      if (Test-GatewayRunning) {
        Write-Host "  OpenClaw Gateway is ready!" -ForegroundColor Green
        $gwReady = $true
        break
      }
      Write-Host "  Waiting for gateway... ($($i*2+2)s)" -ForegroundColor DarkGray
    }
    if (-not $gwReady) {
      Write-Host "  WARNING: Gateway did not respond in 40s. Check log: $gwLogFile" -ForegroundColor Red
    }
  } else {
    Write-Host "[1/2] OpenClaw Gateway already running." -ForegroundColor Green
  }

  Write-Host "[2/2] Starting Jarvis One Company OS..." -ForegroundColor Cyan
  Start-Jarvis

  Write-Host ""
  Write-Host "=== All Services Ready ===" -ForegroundColor Green
  Write-Host "  OpenClaw: $dashboardUrl" -ForegroundColor Yellow
  Write-Host "  Jarvis:   Desktop App (Electron)" -ForegroundColor Yellow
  Write-Host "  Browser:  $jarvisUrl (fallback)" -ForegroundColor DarkGray
  Write-Host "  Model: shared via OPENAI_API_KEY" -ForegroundColor DarkGray
  Write-Host ""
}

function Stop-AllServices {
  Write-Host "Stopping all services..." -ForegroundColor Yellow
  Stop-Gateway
  Stop-Jarvis
  Write-Host "All services stopped." -ForegroundColor Green
}

function Show-Header {
  $gwRunning = Test-GatewayRunning
  $jvRunning = Test-JarvisRunning

  Write-Host ""
  Write-Host "========================================" -ForegroundColor DarkCyan
  Write-Host "  OpenClaw + Jarvis One Company OS" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor DarkCyan
  Write-Host ""
  Write-Host "  OpenClaw Gateway : $(if ($gwRunning) { 'Running' } else { 'Stopped' })" -ForegroundColor $(if ($gwRunning) { "Green" } else { "Red" })
  Write-Host "  Jarvis OS        : $(if ($jvRunning) { 'Running' } else { 'Stopped' })" -ForegroundColor $(if ($jvRunning) { "Green" } else { "Red" })
  Write-Host "  API Key          : $(if ($env:OPENAI_API_KEY) { 'Loaded' } else { 'Missing' })" -ForegroundColor $(if ($env:OPENAI_API_KEY) { "Green" } else { "Red" })
  Write-Host ""
  Write-Host "--- Quick Actions ---" -ForegroundColor DarkGray
  Write-Host "  1. Start all (OpenClaw + Jarvis OS, shared model)" -ForegroundColor White
  Write-Host "  2. Stop all" -ForegroundColor White
  Write-Host ""
  Write-Host "--- OpenClaw Gateway ---" -ForegroundColor DarkGray
  Write-Host "  3. Start gateway only"
  Write-Host "  4. Restart gateway (force)"
  Write-Host "  5. Stop gateway"
  Write-Host "  6. Show status"
  Write-Host "  7. Open OpenClaw dashboard"
  Write-Host ""
  Write-Host "--- Jarvis One Company OS (Desktop) ---" -ForegroundColor DarkGray
  Write-Host "  8. Start Jarvis OS desktop"
  Write-Host "  9. Stop Jarvis OS"
  Write-Host "  A. Open Jarvis OS (browser fallback)"
  Write-Host ""
  Write-Host "--- Other ---" -ForegroundColor DarkGray
  Write-Host "  R. Re-authenticate OAuth"
  Write-Host "  0. Exit"
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

  switch ($SelectedChoice.ToUpper()) {
    "1" {
      Start-AllServices
      return $false
    }
    "2" {
      Stop-AllServices
      return $false
    }
    "3" {
      Start-Gateway
      return $false
    }
    "4" {
      Restart-Gateway
      return $false
    }
    "5" {
      Stop-Gateway
      return $false
    }
    "6" {
      Show-GatewayStatus
      return $false
    }
    "7" {
      Open-Dashboard
      return $false
    }
    "8" {
      Start-Jarvis
      return $false
    }
    "9" {
      Stop-Jarvis
      return $false
    }
    "A" {
      if (Test-JarvisRunning) {
        Start-Process $jarvisUrl
        Write-Host "Jarvis OS dashboard opened: $jarvisUrl" -ForegroundColor Green
      } else {
        Write-Host "Jarvis OS is not running. Start it first (option 8 or 1)." -ForegroundColor Yellow
      }
      return $false
    }
    "R" {
      $reauthScript = Join-Path $PSScriptRoot "openclaw_reauth.ps1"
      if (Test-Path $reauthScript) {
        & $reauthScript
      } else {
        Write-Host "Re-auth script not found. Run manually:" -ForegroundColor Yellow
        Write-Host "  openclaw models auth login --provider openai-codex" -ForegroundColor Cyan
        Write-Host "  openclaw models auth login --provider qwen-portal" -ForegroundColor Cyan
      }
      return $false
    }
    "0" {
      Write-Host "Exited." -ForegroundColor Gray
      return $true
    }
    default {
      Write-Host "Invalid option." -ForegroundColor Red
      return $false
    }
  }
}

try {
  Confirm-OpenClaw
  $isInteractiveMenu = -not $PSBoundParameters.ContainsKey('Choice')

  if (-not $isInteractiveMenu) {
    Show-Header
    $null = Invoke-MenuAction -SelectedChoice $Choice
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
} catch {
  Write-Host ""
  Write-Host "OpenClaw 控制台异常退出: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Read-Host "按 Enter 关闭窗口"
  exit 1
}
