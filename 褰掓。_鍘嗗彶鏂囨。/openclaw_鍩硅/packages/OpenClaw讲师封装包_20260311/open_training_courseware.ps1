$ErrorActionPreference = "Stop"
$port = 8019
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$courseUrl = "http://127.0.0.1:$port/openclaw-feishu-training.html"

function Test-CourseServerRunning {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -gt 0 }
  return $null -ne $connections
}

if (-not (Test-CourseServerRunning)) {
  Start-Process powershell -ArgumentList @(
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $root "courseware_local_server.ps1"),
    "-RootPath", $root,
    "-Port", "$port"
  )
  Start-Sleep -Seconds 2
}

Start-Process $courseUrl
