$ErrorActionPreference = 'SilentlyContinue'
$logFile = Join-Path $env:TEMP 'jarvis_launcher.log'
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Launcher started" | Out-File $logFile

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')
$npmBin = Join-Path $env:APPDATA 'npm'
if (Test-Path $npmBin) { $env:Path = "$npmBin;$env:Path" }

foreach ($key in @('OPENAI_API_KEY', 'GEMINI_API_KEY', 'SILICONFLOW_API_KEY', 'DEEPSEEK_API_KEY', 'MOONSHOT_API_KEY',
                    'CLIPROXY_PORT', 'CLIPROXY_API_KEY', 'CLIPROXY_MODELS')) {
  $val = [System.Environment]::GetEnvironmentVariable($key, 'User')
  if ($val) { [System.Environment]::SetEnvironmentVariable($key, $val, 'Process') }
}

$jarvisRoot = $null
$walkDir = $PSScriptRoot
for ($i = 0; $i -lt 8; $i++) {
  if (-not $walkDir) { break }
  $candidate = Join-Path $walkDir 'jarvis-one-company-os'
  if (Test-Path $candidate) { $jarvisRoot = $candidate; break }
  $walkDir = Split-Path $walkDir -Parent
}
if (-not $jarvisRoot) {
  "[$(Get-Date -Format 'HH:mm:ss')] ERROR: jarvis-one-company-os not found" | Out-File $logFile -Append
  exit 1
}
"[$(Get-Date -Format 'HH:mm:ss')] Project root: $jarvisRoot" | Out-File $logFile -Append

$apiPort = 18782
$uiPort = 5173

function Test-ServiceReady {
  param([string]$Url)
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    return $r.StatusCode -lt 500
  } catch { return $false }
}

function Test-PortFree {
  param([int]$Port)
  $line = netstat -ano 2>$null | Select-String ":${Port}\s.*LISTENING"
  return -not $line
}

function Clear-Port {
  param([int]$Port)
  $lines = netstat -ano 2>$null | Select-String ":${Port}\s.*LISTENING"
  foreach ($line in $lines) {
    if ($line -match '\s(\d+)\s*$') {
      $procId = [int]$matches[1]
      if ($procId -gt 0) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        taskkill /PID $procId /T /F 2>&1 | Out-Null
        "[$(Get-Date -Format 'HH:mm:ss')] Killed PID $procId on port $Port" | Out-File $logFile -Append
      }
    }
  }
}

$backendUp = Test-ServiceReady "http://127.0.0.1:${apiPort}/health"
$frontendUp = Test-ServiceReady "http://127.0.0.1:${uiPort}/"
"[$(Get-Date -Format 'HH:mm:ss')] Backend: $backendUp, Frontend: $frontendUp" | Out-File $logFile -Append

if ($backendUp -and $frontendUp) {
  "[$(Get-Date -Format 'HH:mm:ss')] Both services running, skip start" | Out-File $logFile -Append
} else {
  Clear-Port -Port $apiPort
  Clear-Port -Port $uiPort
  Start-Sleep -Seconds 3

  if (-not (Test-PortFree $apiPort) -or -not (Test-PortFree $uiPort)) {
    "[$(Get-Date -Format 'HH:mm:ss')] Ports still occupied, trying admin kill..." | Out-File $logFile -Append
    $killScript = "netstat -ano | Select-String ':(${apiPort}|${uiPort})\s.*LISTEN' | ForEach-Object { if (`$_ -match '\s(\d+)\s*`$') { taskkill /PID `$matches[1] /T /F 2>`$null } }; Start-Sleep 2"
    Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile', '-Command', $killScript -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  }

  if (-not (Test-PortFree $apiPort) -or -not (Test-PortFree $uiPort)) {
    "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Could not free ports" | Out-File $logFile -Append
    exit 1
  }

  if (-not (Test-Path (Join-Path $jarvisRoot 'node_modules'))) {
    "[$(Get-Date -Format 'HH:mm:ss')] Installing dependencies..." | Out-File $logFile -Append
    Push-Location $jarvisRoot
    npm install 2>&1 | Out-Null
    Pop-Location
  }

  $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue).Source
  if (-not $npmCmd) { $npmCmd = 'npm' }

  $devStackLog = Join-Path $env:TEMP 'jarvis_devstack.log'

  $envPairs = @()
  foreach ($key in @('Path', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'SILICONFLOW_API_KEY', 'DEEPSEEK_API_KEY',
                     'MOONSHOT_API_KEY', 'CLIPROXY_PORT', 'CLIPROXY_API_KEY', 'CLIPROXY_MODELS',
                     'OPENAI_BASE_URL', 'LLM_API_BASE', 'LLM_API_KEY', 'OPENAI_MODEL',
                     'VITE_LLM_DEFAULT_PROVIDER', 'LLM_PROVIDER_FALLBACKS',
                     'OPENAI_DIRECT_KEY', 'OPENAI_DIRECT_BASE', 'OPENAI_DIRECT_MODELS')) {
    $val = [System.Environment]::GetEnvironmentVariable($key, 'Process')
    if (-not $val) { $val = [System.Environment]::GetEnvironmentVariable($key, 'User') }
    if ($val) {
      $escaped = $val -replace "'", "''"
      $envPairs += "`$env:${key} = '${escaped}'"
    }
  }
  $envBlock = $envPairs -join "`n"

  $devStackScript = @"
$envBlock
Set-Location '$jarvisRoot'
& '$npmCmd' run dev:full 2>&1 | Tee-Object -FilePath '$devStackLog'
"@
  $bytes = [System.Text.Encoding]::Unicode.GetBytes($devStackScript)
  $encoded = [Convert]::ToBase64String($bytes)
  Start-Process powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', $encoded) -WindowStyle Hidden

  "[$(Get-Date -Format 'HH:mm:ss')] Dev-stack started, waiting..." | Out-File $logFile -Append

  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    if (Test-ServiceReady "http://127.0.0.1:${apiPort}/health") {
      "[$(Get-Date -Format 'HH:mm:ss')] Backend ready ($($i * 2)s)" | Out-File $logFile -Append
      break
    }
  }

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    if (Test-ServiceReady "http://127.0.0.1:${uiPort}/") {
      "[$(Get-Date -Format 'HH:mm:ss')] Frontend ready ($($i * 2)s)" | Out-File $logFile -Append
      break
    }
  }
}

$frontendReady = Test-ServiceReady "http://127.0.0.1:${uiPort}/"
"[$(Get-Date -Format 'HH:mm:ss')] Final: Frontend=$frontendReady" | Out-File $logFile -Append

if (-not $frontendReady) {
  "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Frontend not ready" | Out-File $logFile -Append
  exit 1
}

$electronMainJs = Join-Path $jarvisRoot 'dist-electron\main.js'
$electronMainTs = Join-Path $jarvisRoot 'desktop\electron\main.ts'
$needCompile = -not (Test-Path $electronMainJs)
if (-not $needCompile -and (Test-Path $electronMainTs)) {
  $needCompile = (Get-Item $electronMainTs).LastWriteTime -gt (Get-Item $electronMainJs).LastWriteTime
}
if ($needCompile) {
  "[$(Get-Date -Format 'HH:mm:ss')] Compiling Electron..." | Out-File $logFile -Append
  Push-Location $jarvisRoot
  npx tsc -p tsconfig.electron.json 2>&1 | Out-Null
  Pop-Location
}

$electronExe = Join-Path $jarvisRoot 'node_modules\electron\dist\electron.exe'
if (Test-Path $electronExe) {
  $env:JARVIS_DESKTOP_URL = "http://localhost:$uiPort"
  Start-Process -FilePath $electronExe -ArgumentList "`"$electronMainJs`"" -WorkingDirectory $jarvisRoot
  "[$(Get-Date -Format 'HH:mm:ss')] Electron launched" | Out-File $logFile -Append
} else {
  Start-Process "http://127.0.0.1:${uiPort}/"
  "[$(Get-Date -Format 'HH:mm:ss')] Fallback: browser" | Out-File $logFile -Append
}
