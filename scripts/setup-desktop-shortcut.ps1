$projectRoot = Split-Path $PSScriptRoot -Parent
$vbsLauncher = Join-Path $projectRoot 'JarvisOS.vbs'
$icoPath = Join-Path $projectRoot 'jarvis-one-company-os\build\icon.ico'
$desktopDir = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopDir 'Jarvis One Company OS.lnk'

if (-not (Test-Path $vbsLauncher)) {
  Write-Host "ERROR: Launcher not found: $vbsLauncher" -ForegroundColor Red
  exit 1
}

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = 'wscript.exe'
$sc.Arguments = "`"$vbsLauncher`""
$sc.WorkingDirectory = $projectRoot
$sc.Description = "Jarvis One Company OS"
$sc.WindowStyle = 7

if (Test-Path $icoPath) {
  $sc.IconLocation = "$icoPath,0"
}

$sc.Save()

Write-Host ''
Write-Host '=== Desktop Shortcut Created ===' -ForegroundColor Green
Write-Host "  Path: $shortcutPath" -ForegroundColor Cyan
Write-Host "  Icon: $icoPath" -ForegroundColor DarkGray
Write-Host "  Target: wscript.exe -> $vbsLauncher" -ForegroundColor DarkGray
Write-Host ''
Write-Host "Double-click the desktop icon to launch Jarvis One Company OS!" -ForegroundColor Yellow
Write-Host ''
