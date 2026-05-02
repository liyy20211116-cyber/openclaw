# skills/opencli-bridge/scripts/install.ps1
# 安装 OpenCLI 命令行 + Chrome 扩展（阶段 2.3 配套）。

[CmdletBinding()]
param([switch]$SkipNpm)

$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$ExtDir = Join-Path $ProjectRoot 'tools\OpenCLI\extension'

Write-Host "=== OpenCLI 安装 ===" -ForegroundColor Cyan

if (-not $SkipNpm) {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host "[1/3] npm install -g @jackwener/opencli" -ForegroundColor Yellow
        npm install -g '@jackwener/opencli' 2>&1 | Select-Object -Last 3
    } else {
        Write-Host "[!] 未检测到 npm，请先装 Node.js 18+" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n[2/3] 检查 Chrome 扩展目录" -ForegroundColor Yellow
if (Test-Path $ExtDir) {
    Write-Host "    扩展在：$ExtDir"
    Write-Host "    请手工：打开 chrome://extensions，启用'开发者模式'，点'加载已解压的扩展'，选上面这个目录"
} else {
    Write-Host "    [!] 找不到 tools/OpenCLI/extension，请先运行 scripts/setup_toolchain.ps1" -ForegroundColor Red
}

Write-Host "`n[3/3] 健康检查" -ForegroundColor Yellow
if (Get-Command opencli -ErrorAction SilentlyContinue) {
    opencli doctor 2>&1 | Select-Object -Last 10
} else {
    Write-Host "    [!] opencli 命令未安装成功" -ForegroundColor Red
}

Write-Host "`n=== 完成 ===" -ForegroundColor Cyan
Write-Host "试跑："
Write-Host "  opencli hackernews top --limit 5"
Write-Host "  python skills/opencli-bridge/scripts/hot_aggregator.py --mock"
