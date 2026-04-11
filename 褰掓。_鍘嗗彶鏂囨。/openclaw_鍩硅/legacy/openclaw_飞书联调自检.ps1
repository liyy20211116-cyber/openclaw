$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Write-WarnMsg($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERR ] $msg" -ForegroundColor Red }

$global:HasError = $false

function Check-Command {
  param(
    [string]$Name,
    [string]$Hint
  )
  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    Write-Ok "命令可用: $Name"
    return $true
  } else {
    Write-Err "命令不可用: $Name"
    if ($Hint) { Write-WarnMsg $Hint }
    $global:HasError = $true
    return $false
  }
}

Write-Info "开始执行 OpenClaw + 飞书联调自检..."

# 1) 基础命令检查
$hasNode = Check-Command -Name "node" -Hint "请先安装 Node.js >= 22: https://nodejs.org/"
$hasNpm = Check-Command -Name "npm" -Hint "npm 通常随 Node.js 一起安装。"
$hasOpenclaw = Check-Command -Name "openclaw" -Hint "请执行: npm install -g openclaw@latest"

# 2) Node 版本检查
if ($hasNode) {
  try {
    $nodeVerRaw = (node -v)
    $nodeVer = $nodeVerRaw -replace '^v', ''
    $major = [int]($nodeVer.Split('.')[0])
    if ($major -ge 22) {
      Write-Ok "Node.js 版本符合要求: $nodeVerRaw"
    } else {
      Write-Err "Node.js 版本过低: $nodeVerRaw (要求 >= 22)"
      $global:HasError = $true
    }
  } catch {
    Write-Err "无法获取 Node.js 版本: $($_.Exception.Message)"
    $global:HasError = $true
  }
}

# 3) openclaw 版本与基础命令
if ($hasOpenclaw) {
  try {
    $openclawVer = openclaw --version
    Write-Ok "OpenClaw 版本: $openclawVer"
  } catch {
    Write-WarnMsg "无法读取 openclaw 版本，继续检查其他项。"
  }

  try {
    $null = openclaw plugins list
    Write-Ok "插件列表命令可执行: openclaw plugins list"
  } catch {
    Write-WarnMsg "插件列表命令执行失败，请检查 openclaw 安装状态。"
  }

  try {
    $status = openclaw gateway status 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "网关状态命令可执行: openclaw gateway status"
      Write-Host $status
    } else {
      Write-WarnMsg "gateway status 返回非 0，可能网关未启动。"
      Write-Host $status
    }
  } catch {
    Write-WarnMsg "无法获取网关状态，可能尚未安装/启动网关服务。"
  }
}

# 4) 配置文件存在性检查（不读取敏感值）
$configPath = Join-Path $env:USERPROFILE ".openclaw\openclaw.json"
if (Test-Path $configPath) {
  Write-Ok "检测到配置文件: $configPath"
} else {
  Write-WarnMsg "未检测到配置文件: $configPath"
  Write-WarnMsg "可通过 'openclaw channels add' 交互创建飞书配置。"
}

# 5) 输出建议
Write-Host ""
Write-Info "建议下一步命令："
Write-Host "  openclaw plugins install @openclaw/feishu"
Write-Host "  openclaw channels add"
Write-Host "  openclaw gateway restart"
Write-Host "  openclaw logs --follow"

Write-Host ""
if ($global:HasError) {
  Write-Err "自检完成：存在阻断项，请先修复后再联调。"
  exit 1
} else {
  Write-Ok "自检完成：环境基本可用于飞书联调。"
  exit 0
}

