# skills/video-edit-cli/scripts/install_all.ps1
# 一键拉取视频剪辑相关的 3 个开源项目 + 装依赖（阶段 2.2 配套）。
# 本脚本是 scripts/setup_toolchain.ps1 的子集，专门用于补齐视频剪辑能力。
#
# 用法：
#   pwsh skills/video-edit-cli/scripts/install_all.ps1
#   pwsh skills/video-edit-cli/scripts/install_all.ps1 -SkipPip

[CmdletBinding()]
param([switch]$SkipPip, [switch]$SkipClone)

$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$ToolsDir = Join-Path $ProjectRoot 'tools'

Write-Host "=== 视频剪辑工具链安装 ===" -ForegroundColor Cyan
Write-Host "项目根: $ProjectRoot"
Write-Host "工具目录: $ToolsDir"

if (-not (Test-Path $ToolsDir)) {
    New-Item -ItemType Directory $ToolsDir | Out-Null
}

$repos = @(
    @{ Name = 'videocut';  Url = 'https://github.com/zinan92/videocut.git';   Why = '口播剪辑 7 件套' }
    @{ Name = 'openclip';  Url = 'https://github.com/linzzzzzz/openclip.git'; Why = '长视频高光提取' }
    @{ Name = 'Clip2Post'; Url = 'https://github.com/WtecHtec/Clip2Post.git'; Why = '视频转文章 + TTS' }
)

if (-not $SkipClone) {
    foreach ($r in $repos) {
        $dst = Join-Path $ToolsDir $r.Name
        Write-Host ""
        Write-Host ">>> $($r.Name) ($($r.Why))" -ForegroundColor Yellow
        if (Test-Path $dst) {
            Write-Host "    已存在，pull 最新..." -ForegroundColor Gray
            Push-Location $dst
            git pull --ff-only --depth 1 2>&1 | Select-Object -Last 2
            Pop-Location
        } else {
            git clone --depth 1 $r.Url $dst 2>&1 | Select-Object -Last 2
        }
    }
}

if (-not $SkipPip -and (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "`n>>> Python 依赖" -ForegroundColor Yellow
    $pkgs = @('edge-tts', 'openai-whisper', 'requests', 'pillow')
    foreach ($p in $pkgs) {
        Write-Host "    pip install $p"
        python -m pip install -U $p --quiet 2>&1 | Select-Object -Last 1
    }
}

if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "`n[OK] FFmpeg 已就绪" -ForegroundColor Green
} else {
    Write-Host "`n[!] FFmpeg 未找到，建议：choco install ffmpeg" -ForegroundColor Yellow
}

Write-Host "`n=== 完成 ===" -ForegroundColor Cyan
Write-Host "验证："
Write-Host "  python scripts/env_check.py --save-report"
Write-Host "  python skills/video-edit-cli/scripts/wrap_tts.py --list-voices"
Write-Host "  python skills/video-edit-cli/scripts/wrap_videocut.py --info"
