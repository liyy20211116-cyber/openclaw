$ErrorActionPreference = "Stop"
$root = "D:\FY003"
$rawText = $env:NLD_TEXT
if ([string]::IsNullOrWhiteSpace($rawText)) {
  throw "Missing input text. Use nl_dispatch.bat ""your request""."
}
$textLower = ($rawText | Out-String).Trim().ToLowerInvariant()

function Invoke-Bat([string]$batPath) {
  if (!(Test-Path $batPath)) {
    throw "Not found: $batPath"
  }
  & cmd /c $batPath
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $batPath (exit=$LASTEXITCODE)"
  }
}

function Contains-Any([string]$src, [string[]]$keywords) {
  foreach ($k in $keywords) {
    if ([string]::IsNullOrWhiteSpace($k)) { continue }
    if ($src.IndexOf($k.ToLowerInvariant(), [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      return $true
    }
  }
  return $false
}

# Build Chinese keywords without source-file Chinese literals.
$cnAllFlow = [string]::Concat([char]0x5168,[char]0x6D41,[char]0x7A0B) # 全流程
$cnOneKey = [string]::Concat([char]0x4E00,[char]0x952E)               # 一键
$cnGenVideo = [string]::Concat([char]0x751F,[char]0x6210,[char]0x4ECA,[char]0x5929,[char]0x8D22,[char]0x7ECF,[char]0x89C6,[char]0x9891) # 生成今天财经视频
$cnBuild = [string]::Concat([char]0x51FA,[char]0x7247)                # 出片
$cnVideo = [string]::Concat([char]0x89C6,[char]0x9891)                # 视频
$cnDaily = [string]::Concat([char]0x65E5,[char]0x62A5)                # 日报
$cnScript = [string]::Concat([char]0x811A,[char]0x672C)               # 脚本

$kAll = @("run all", "all", "full", $cnAllFlow, $cnOneKey, $cnGenVideo)
$kBuild = @("build", "video", "render", $cnBuild, $cnVideo)
$kDaily = @("daily", "script", "collect", $cnDaily, $cnScript)

if (Contains-Any $textLower $kAll) {
  Invoke-Bat (Join-Path $root "scripts\run_all_headless.bat")
  Write-Output "intent=all; status=ok"
  exit 0
}

if (Contains-Any $textLower $kBuild) {
  Invoke-Bat (Join-Path $root "scripts\build_video_headless.bat")
  Write-Output "intent=build_video; status=ok"
  exit 0
}

if (Contains-Any $textLower $kDaily) {
  Invoke-Bat (Join-Path $root "scripts\run_daily_headless.bat")
  Write-Output "intent=run_daily; status=ok"
  exit 0
}

Write-Output "intent=unknown; status=noop; hint=supported: all/build/daily"
exit 0
