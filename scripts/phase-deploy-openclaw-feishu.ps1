param(
    [ValidateSet("P1","P2","P3","P4","P5","ALL")]
    [string]$Phase = "ALL"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Title($text) {
    Write-Host ""
    Write-Host "==== $text ====" -ForegroundColor Cyan
}

function Invoke-Step($name, $scriptBlock) {
    Write-Host ""
    Write-Host "[STEP] $name" -ForegroundColor Yellow
    & $scriptBlock
}

function Invoke-P1 {
    Write-Title "P1 Environment checks"
    Invoke-Step "Check Node version" { node -v }
    Invoke-Step "Check npm version" { npm -v }
    Invoke-Step "Check if openclaw exists" {
        $cmd = Get-Command openclaw -ErrorAction SilentlyContinue
        if ($null -eq $cmd) {
            Write-Host "openclaw is not installed yet. Continue with P2." -ForegroundColor DarkYellow
        } else {
            Write-Host "openclaw found: $($cmd.Source)" -ForegroundColor Green
        }
    }
}

function Invoke-P2 {
    Write-Title "P2 Install OpenClaw and model auth"
    Write-Host "Run these commands in WSL2:"
    Write-Host "  npm install -g openclaw@latest"
    Write-Host "  openclaw onboard --install-daemon"
    Write-Host "  openclaw models auth login --provider openai-codex"
    Write-Host "  openclaw models set openai-codex/gpt-5.3-codex"
    Write-Host "  openclaw models list"
    Write-Host ""
    Write-Host "P2 needs internet and interactive OAuth login." -ForegroundColor DarkYellow
}

function Invoke-P3 {
    Write-Title "P3 Feishu app and channel binding"
    Write-Host "Complete in Feishu console:"
    Write-Host "  1) Enable bot capability"
    Write-Host "  2) Enable event subscription"
    Write-Host "  3) Grant minimal message permissions"
    Write-Host "  4) Add bot to a test group"
    Write-Host ""
    Write-Host "Ensure local env vars:"
    Write-Host "  FEISHU_APP_ID"
    Write-Host "  FEISHU_APP_SECRET"
}

function Invoke-P4 {
    Write-Title "P4 Integration test and canary"
    Write-Host "Gateway command:"
    Write-Host "  openclaw gateway --port 18789 --verbose"
    Write-Host ""
    Write-Host "Test cases:"
    Write-Host "  1) DM message -> should reply"
    Write-Host "  2) Group without mention -> should not trigger"
    Write-Host "  3) Group with mention -> should trigger and reply"
    Write-Host "  4) Multi-turn chat -> context should continue"
}

function Invoke-P5 {
    Write-Title "P5 Operations"
    Write-Host "Recommended ongoing tasks:"
    Write-Host "  - run openclaw doctor weekly"
    Write-Host "  - rotate FEISHU_APP_SECRET every 30-90 days"
    Write-Host "  - review allowlist and trigger rules"
}

switch ($Phase) {
    "P1" { Invoke-P1; break }
    "P2" { Invoke-P2; break }
    "P3" { Invoke-P3; break }
    "P4" { Invoke-P4; break }
    "P5" { Invoke-P5; break }
    "ALL" {
        Invoke-P1
        Invoke-P2
        Invoke-P3
        Invoke-P4
        Invoke-P5
        break
    }
}

Write-Host ""
Write-Host "Done. See openclaw-feishu-分阶段开发任务.md for details." -ForegroundColor Green
