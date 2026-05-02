# start_chrome_debuggable.ps1
#
# Start Chrome with a remote debugging port so Jarvis can use CDP against
# the user's logged-in browser profile. This script only opens Chrome; it
# does not publish, comment, or send messages.

[CmdletBinding()]
param(
    [int]$Port = 9222,
    [string]$ProfileDir = "D:\FY003\.browser-profiles\chrome-publish"
)

$ErrorActionPreference = "Stop"

$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chromeExe) {
    Write-Host "[ERR] Chrome/Edge executable not found." -ForegroundColor Red
    exit 1
}

Write-Host "[i] Browser: $chromeExe" -ForegroundColor DarkGray
Write-Host "[i] Profile: $ProfileDir" -ForegroundColor DarkGray
Write-Host "[i] CDP Port: $Port" -ForegroundColor DarkGray

if (-not (Test-Path $ProfileDir)) {
    New-Item -Path $ProfileDir -ItemType Directory -Force | Out-Null
    Write-Host "[+] Created browser profile directory." -ForegroundColor Green
}

$inUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($inUse) {
    Write-Host "[!] Port $Port is already in use. Chrome may already be running in debug mode." -ForegroundColor Yellow
    exit 1
}

$chromeArgs = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=`"$ProfileDir`"",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=OptimizationHints,TranslateUI",
    "about:blank"
)

Write-Host ""
Write-Host "=== Starting Chrome in debug mode ===" -ForegroundColor Cyan
Write-Host "If login has expired, use the opened Chrome window to log in again." -ForegroundColor White
Write-Host "CDP check: python scripts/publish/probe_cdp.py" -ForegroundColor Cyan
Write-Host ""

Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs
Write-Host "[OK] Chrome started on CDP port $Port." -ForegroundColor Green
