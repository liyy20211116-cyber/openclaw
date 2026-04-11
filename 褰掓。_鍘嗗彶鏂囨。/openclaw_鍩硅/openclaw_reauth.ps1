param(
  [switch]$OpenAI,
  [switch]$Qwen,
  [switch]$All
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

function Write-Info($msg)    { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Write-WarnMsg($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "[ERR ] $msg" -ForegroundColor Red }

if (-not (Get-Command openclaw -ErrorAction SilentlyContinue)) {
  Write-Err "openclaw not found. Install with: npm install -g openclaw@latest"
  exit 1
}

$version = (openclaw --version 2>&1 | Select-Object -First 1)
Write-Info "openclaw version: $version"
Write-Host ""

function Get-TokenExpiry {
  param([string]$provider)
  try {
    $authFile = "$env:USERPROFILE\.openclaw\agents\main\agent\auth-profiles.json"
    if (-not (Test-Path $authFile)) { return $null }
    $json = Get-Content $authFile -Raw | ConvertFrom-Json
    $key = "$provider`:default"
    $profile = $json.profiles.$key
    if ($null -eq $profile -or $null -eq $profile.expires) { return $null }
    return [DateTimeOffset]::FromUnixTimeMilliseconds([long]$profile.expires).ToLocalTime()
  } catch { return $null }
}

function Invoke-ReAuth {
  param([string]$provider, [string]$displayName)

  $expiry = Get-TokenExpiry $provider
  if ($null -ne $expiry -and $expiry -gt (Get-Date)) {
    Write-Ok "$displayName token valid until: $expiry"
    $confirm = Read-Host "Re-login anyway? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
      Write-Info "Skipping $displayName re-login."
      return
    }
  } elseif ($null -ne $expiry) {
    Write-WarnMsg "$displayName token EXPIRED at: $expiry"
  } else {
    Write-WarnMsg "$displayName token not found."
  }

  Write-Info "Starting $displayName auth flow (browser will open)..."
  try {
    & openclaw models auth login --provider $provider
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
      Write-Err "$displayName login failed (exit code $LASTEXITCODE). See messages above."
    } else {
      Write-Ok "$displayName re-login successful!"
    }
  } catch {
    Write-Err "$displayName login failed: $($_.Exception.Message)"
  }
  Write-Host ""
}

# Interactive menu when no flags passed
if (-not $OpenAI -and -not $Qwen -and -not $All) {
  Write-Host "===============================" -ForegroundColor Cyan
  Write-Host " OpenClaw OAuth Re-login Tool  " -ForegroundColor Cyan
  Write-Host "===============================" -ForegroundColor Cyan
  Write-Host ""

  $codexExpiry = Get-TokenExpiry "openai-codex"
  $qwenExpiry  = Get-TokenExpiry "qwen-portal"
  $now         = Get-Date

  $codexStatus = if ($null -ne $codexExpiry -and $codexExpiry -gt $now) { "OK  (expires $codexExpiry)" }
                 elseif ($null -ne $codexExpiry) { "EXPIRED ($codexExpiry)" }
                 else { "not configured" }
  $qwenStatus  = if ($null -ne $qwenExpiry -and $qwenExpiry -gt $now) { "OK  (expires $qwenExpiry)" }
                 elseif ($null -ne $qwenExpiry) { "EXPIRED ($qwenExpiry)" }
                 else { "not configured" }

  $codexColor = if ($null -ne $codexExpiry -and $codexExpiry -gt $now) { "Green" } else { "Red" }
  $qwenColor  = if ($null -ne $qwenExpiry  -and $qwenExpiry  -gt $now) { "Green" } else { "Red" }

  Write-Host "Token status:"
  Write-Host "  [1] openai-codex  : " -NoNewline; Write-Host $codexStatus -ForegroundColor $codexColor
  Write-Host "  [2] qwen-portal   : " -NoNewline; Write-Host $qwenStatus  -ForegroundColor $qwenColor
  Write-Host "  [3] Re-login BOTH"
  Write-Host "  [0] Exit"
  Write-Host ""

  $choice = Read-Host "Choose"
  switch ($choice) {
    "1" { Invoke-ReAuth "openai-codex" "OpenAI Codex (ChatGPT)" }
    "2" { Invoke-ReAuth "qwen-portal"  "Qwen Portal" }
    "3" {
      Invoke-ReAuth "openai-codex" "OpenAI Codex (ChatGPT)"
      Invoke-ReAuth "qwen-portal"  "Qwen Portal"
    }
    "0" { Write-Host "Exit." -ForegroundColor Gray; exit 0 }
    default { Write-WarnMsg "Invalid choice."; exit 1 }
  }
} else {
  if ($All -or $OpenAI) { Invoke-ReAuth "openai-codex" "OpenAI Codex (ChatGPT)" }
  if ($All -or $Qwen)   { Invoke-ReAuth "qwen-portal"  "Qwen Portal" }
}

Write-Host ""
Write-Info "Done. Restart the gateway to apply new tokens:"
Write-Host "  Open OpenClaw_Console.bat -> choose 2 (Restart)" -ForegroundColor Yellow
