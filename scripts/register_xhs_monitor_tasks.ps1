param(
  [string]$Title = "xhs-note",
  [datetime]$PublishedAt = "2026-04-29T08:58:00"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PowerShell = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$PythonCandidates = @(
  "$env:LOCALAPPDATA\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\python.exe",
  "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
  "C:\Python312\python.exe",
  "python.exe"
)
$Python = $PythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Python) {
  throw "Python executable not found. Checked: $($PythonCandidates -join ', ')"
}

$checks = @(
  @{ Name = "JarvisXhsMonitor-T2h";  Event = "post_t2h_initial_metrics";   At = $PublishedAt.AddHours(2)  },
  @{ Name = "JarvisXhsMonitor-T8h";  Event = "post_t8h_engagement_scan";   At = $PublishedAt.AddHours(8)  },
  @{ Name = "JarvisXhsMonitor-T24h"; Event = "post_t24h_review";           At = $PublishedAt.AddHours(24) }
)

foreach ($check in $checks) {
  if ($check.At -lt (Get-Date).AddMinutes(1)) {
    Write-Host "[skip] $($check.Name) time already passed: $($check.At)"
    continue
  }

  $safeTitle = $Title.Replace("'", "''")
  $cmd = "Set-Location '$Root'; `$env:PYTHONIOENCODING='utf-8'; & '$Python' '$Root\scripts\xhs_post_monitor.py' --title '$safeTitle' --event $($check.Event)"
  $action = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$cmd`""
  $trigger = New-ScheduledTaskTrigger -Once -At $check.At
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

  Register-ScheduledTask -TaskName $check.Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Write-Host "[ok] $($check.Name) => $($check.At.ToString('yyyy-MM-dd HH:mm:ss')) / $($check.Event)"
}
