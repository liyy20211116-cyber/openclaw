param(
    [int]$TargetCny = 10000,
    [int]$Days = 30,
    [string]$At = "09:10"
)

$ErrorActionPreference = "Stop"

$TaskName = "JarvisAutonomousRevenueLoop-Daily"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ScriptPath = Join-Path $Root "scripts\revenue_goal_loop.py"
$Python = (Get-Command python).Source

if (-not (Test-Path $ScriptPath)) {
    throw "Missing revenue goal loop script: $ScriptPath"
}

$Argument = "`"$ScriptPath`" --target-cny $TargetCny --days $Days"
$Action = New-ScheduledTaskAction -Execute $Python -Argument $Argument -WorkingDirectory $Root
$Trigger = New-ScheduledTaskTrigger -Daily -At $At
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Jarvis One Company autonomous daily revenue planning loop. Generates candidates, assignments, artifacts, and CEO approval queue." `
    -Force | Out-Null

Write-Output "$TaskName registered for daily $At with target CNY $TargetCny over $Days days."
