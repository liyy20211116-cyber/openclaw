# setup_toolchain.ps1
# 一键拉取/更新 Jarvis One Company OS 所需的 4 个外部开源工具链。
# 用法：pwsh scripts/setup_toolchain.ps1 [-SkipClone] [-SkipNpm] [-SkipPip]
#
# 对应补齐计划 阶段 0.2。

[CmdletBinding()]
param(
    [switch]$SkipClone,
    [switch]$SkipNpm,
    [switch]$SkipPip,
    [switch]$UpdateOnly
)

$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ToolsDir = Join-Path $ProjectRoot 'tools'

Write-Host '================================' -ForegroundColor Cyan
Write-Host ' Jarvis OS 工具链安装脚本 v0.1' -ForegroundColor Cyan
Write-Host '================================' -ForegroundColor Cyan
Write-Host "项目根目录: $ProjectRoot"
Write-Host "工具目录:   $ToolsDir"

if (-not (Test-Path $ToolsDir)) {
    New-Item -ItemType Directory $ToolsDir | Out-Null
}

# ---------- 1. 环境检查 ----------
Write-Host "`n[1/5] 环境检查" -ForegroundColor Yellow
$envOk = $true

function Test-Cmd {
    param([string]$Name, [string]$VersionArg = '--version')
    $exists = $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
    if ($exists) {
        try { $ver = (& $Name $VersionArg 2>$null | Select-Object -First 1) } catch { $ver = '(version unknown)' }
        Write-Host ("  [OK ] {0,-10} {1}" -f $Name, $ver) -ForegroundColor Green
    } else {
        Write-Host ("  [!!]  {0,-10} not found" -f $Name) -ForegroundColor Red
        $script:envOk = $false
    }
}

Test-Cmd git
Test-Cmd node
Test-Cmd npm
Test-Cmd python
Test-Cmd ffmpeg
Test-Cmd uv

if (-not $envOk) {
    Write-Host "`n[!] 部分依赖缺失。建议先安装：" -ForegroundColor Yellow
    Write-Host '    Node.js 18+   : https://nodejs.org'
    Write-Host '    Python 3.11+  : https://python.org'
    Write-Host '    FFmpeg        : choco install ffmpeg'
    Write-Host '    uv            : irm https://astral.sh/uv/install.ps1 | iex'
    Write-Host '继续将跳过缺失依赖相关步骤...' -ForegroundColor Yellow
}

# ---------- 2. Clone / Update 4 个仓库 ----------
$repos = @(
    @{ Name = 'videocut';  Url = 'https://github.com/zinan92/videocut.git' }
    @{ Name = 'openclip';  Url = 'https://github.com/linzzzzzz/openclip.git' }
    @{ Name = 'Clip2Post'; Url = 'https://github.com/WtecHtec/Clip2Post.git' }
    @{ Name = 'OpenCLI';   Url = 'https://github.com/jackwener/opencli.git' }
)

if (-not $SkipClone) {
    Write-Host "`n[2/5] Clone / Update 外部仓库" -ForegroundColor Yellow
    foreach ($r in $repos) {
        $dst = Join-Path $ToolsDir $r.Name
        if (Test-Path $dst) {
            Write-Host "  [~] $($r.Name): 已存在，尝试 git pull ..." -ForegroundColor Gray
            Push-Location $dst
            try { git pull --ff-only --depth 1 2>&1 | Out-Null } catch {}
            Pop-Location
        } else {
            Write-Host "  [+] 克隆 $($r.Name) from $($r.Url)" -ForegroundColor Gray
            git clone --depth 1 $r.Url $dst 2>&1 | Out-Null
        }
        if (Test-Path $dst) {
            Write-Host "       -> OK" -ForegroundColor Green
        } else {
            Write-Host "       -> 失败" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`n[2/5] 跳过 clone (--SkipClone)" -ForegroundColor DarkGray
}

# ---------- 3. npm install OpenCLI (可选) ----------
if (-not $SkipNpm -and (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "`n[3/5] 全局安装 OpenCLI" -ForegroundColor Yellow
    try {
        npm install -g '@jackwener/opencli' 2>&1 | Select-Object -Last 3
        Write-Host '  [OK] opencli 已全局安装' -ForegroundColor Green
    } catch {
        Write-Host "  [!] 安装失败: $_" -ForegroundColor Red
    }
} else {
    Write-Host "`n[3/5] 跳过 npm (--SkipNpm 或无 npm)" -ForegroundColor DarkGray
}

# ---------- 4. Python 依赖 (可选) ----------
if (-not $SkipPip -and (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "`n[4/5] 安装 Python 依赖" -ForegroundColor Yellow
    $reqs = @(
        'pillow',
        'wxauto>=3.9.11.17.5',
        'edge-tts',
        'openai-whisper'
    )
    foreach ($pkg in $reqs) {
        Write-Host "  [pip] $pkg" -ForegroundColor Gray
        python -m pip install -U $pkg --quiet 2>&1 | Select-Object -Last 2
    }
} else {
    Write-Host "`n[4/5] 跳过 pip (--SkipPip 或无 python)" -ForegroundColor DarkGray
}

# ---------- 5. 注册到 skill_manifest (占位) ----------
Write-Host "`n[5/5] 注册外部 Skill 到 manifest" -ForegroundColor Yellow
$manifestPath = Join-Path $ProjectRoot 'config\skill_manifest.json'
if (Test-Path $manifestPath) {
    Write-Host "  [i] 请手工确认 $manifestPath 中包含 videocut/openclip/opencli/clip2post 条目" -ForegroundColor Gray
} else {
    Write-Host "  [i] 未找到 config/skill_manifest.json，跳过自动注册" -ForegroundColor DarkGray
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host " 工具链安装完成" -ForegroundColor Cyan
Write-Host '================================' -ForegroundColor Cyan
Write-Host "下一步："
Write-Host "  1. 运行 scripts\env_check.py 查看详细环境报告"
Write-Host "  2. 运行 skills\video-edit-cli\scripts\pipeline_koubo.py 试跑一条口播视频"
Write-Host "  3. 运行 opencli doctor 确认 OpenCLI 已安装，并加载 tools\OpenCLI\extension\ 到 Chrome"
