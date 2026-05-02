# start_chrome_attach_existing.ps1
# Attach Jarvis to the existing Chrome (reuse default User Data profile).
# Login cookies preserved. See scripts/publish/README.md for details.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\publish\start_chrome_attach_existing.ps1 -Force

[CmdletBinding()]
param(
    [int]$Port = 9222,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
$isEdge = $false
if (-not $chromeExe) {
    Write-Host "[ERR] Chrome not found, try Edge..." -ForegroundColor Red
    $edgeExe = @(
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($edgeExe) { $chromeExe = $edgeExe; $isEdge = $true } else { exit 1 }
}

if ($isEdge) {
    $defaultUserData = "$env:LOCALAPPDATA\Microsoft\Edge\User Data"
    $processName = "msedge"
} else {
    $defaultUserData = "$env:LOCALAPPDATA\Google\Chrome\User Data"
    $processName = "chrome"
}

Write-Host "[i] Browser: $chromeExe" -ForegroundColor DarkGray
Write-Host "[i] UserData: $defaultUserData" -ForegroundColor DarkGray
Write-Host "[i] CDP Port: $Port" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path $defaultUserData)) {
    Write-Host "[ERR] Default user-data dir not found: $defaultUserData" -ForegroundColor Red
    exit 1
}

$existing = Get-Process -Name $processName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[!] Found $($existing.Count) $processName processes running." -ForegroundColor Yellow
    if (-not $Force) {
        $ans = Read-Host "Kill them and restart? (Y/N, default Y)"
        if ($ans -and $ans -notmatch '^[Yy]') {
            Write-Host "[abort]" -ForegroundColor Yellow
            exit 0
        }
    }
    Write-Host "[..] Stopping all $processName processes..." -ForegroundColor Gray
    $existing | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $still = Get-Process -Name $processName -ErrorAction SilentlyContinue
    if ($still) {
        Start-Sleep -Seconds 3
        Get-Process -Name $processName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Chrome stopped." -ForegroundColor Green
}

$inUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($inUse) {
    Write-Host "[ERR] Port $Port is in use by another program. Try -Port 9333" -ForegroundColor Red
    exit 1
}

$chromeArgs = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=`"$defaultUserData`"",
    "--remote-allow-origins=*"
)

Write-Host ""
Write-Host "=== Launching Chrome (original profile + CDP) ===" -ForegroundColor Cyan
Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs
Start-Sleep -Seconds 4

try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 5
    $info = $health.Content | ConvertFrom-Json
    Write-Host "[OK] CDP ready: $($info.Browser)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next: python scripts\publish\probe_cdp.py" -ForegroundColor Cyan
} catch {
    Write-Host "[WARN] CDP not ready yet: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "       Wait 5s and try: python scripts\publish\probe_cdp.py" -ForegroundColor Gray
}
