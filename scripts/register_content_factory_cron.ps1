# register_content_factory_cron.ps1
# 注册 Jarvis OS 运营相关定时任务到 Windows 任务计划程序。
#
# 包含（v2）：
#   1. 每月 1 日 10:00  生成 Token 工资单海报
#   2. 每日 09:00       热点聚合 (OpenCLI → fallback)
#   3. 每日 09:15       对标账号监控
#   4. 每日 09:30       作战站会报告
#   5. 每日 09:45       CEO Dashboard
#   6. 每日 10:00       支付通道健康检查
#   7. 每日 02:00       项目一日一备份（凌晨安静时段）
#   8. 每周一 10:00     Skill 自进化扫描
#
# 用法：
#   pwsh -ExecutionPolicy Bypass scripts/register_content_factory_cron.ps1
#   pwsh scripts/register_content_factory_cron.ps1 -Remove  # 清理
#   pwsh scripts/register_content_factory_cron.ps1 -DryRun  # 仅打印

[CmdletBinding()]
param([switch]$Remove, [switch]$DryRun)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) { $PythonExe = 'python' }

$tasks = @(
    @{
        Name      = 'Jarvis_Salary_Poster_Monthly'
        Monthly   = $true
        DayOfMonth= 1
        Time      = '10:00'
        Script    = "$ProjectRoot\scripts\push_salary_poster_feishu.py"
        Args      = @()
        Desc      = 'Jarvis: 生成工资单海报并推送飞书（未配飞书则仅生成）'
    },
    @{
        Name      = 'Jarvis_Daily_Hot_Aggregator'
        Daily     = $true
        Time      = '09:00'
        Script    = "$ProjectRoot\scripts\hot_aggregator_fallback.py"
        Args      = @()
        Desc      = 'Jarvis: 每日 9 点聚合多平台热点（fallback 版）'
    },
    @{
        Name      = 'Jarvis_Daily_Competitor_Monitor'
        Daily     = $true
        Time      = '09:15'
        Script    = "$ProjectRoot\skills\opencli-bridge\scripts\competitor_monitor.py"
        Args      = @('--mock')
        Desc      = 'Jarvis: 每日 9:15 对标账号增量追踪'
    },
    @{
        Name      = 'Jarvis_Daily_Standup'
        Daily     = $true
        Time      = '09:30'
        Script    = "$ProjectRoot\scripts\operation_standup.py"
        Args      = @()
        Desc      = 'Jarvis: 每日 9:30 作战站会报告（WP + KPI）'
    },
    @{
        Name      = 'Jarvis_Daily_CEO_Dashboard'
        Daily     = $true
        Time      = '09:45'
        Script    = "$ProjectRoot\scripts\ceo_dashboard.py"
        Args      = @()
        Desc      = 'Jarvis: 每日 9:45 CEO 一页 Dashboard'
    },
    @{
        Name      = 'Jarvis_Daily_Payment_Check'
        Daily     = $true
        Time      = '10:00'
        Script    = "$ProjectRoot\scripts\payment_activation_check.py"
        Args      = @()
        Desc      = 'Jarvis: 每日 10 点支付通道健康检查'
    },
    @{
        Name      = 'Jarvis_Daily_Backup'
        Daily     = $true
        Time      = '02:00'
        Script    = "$ProjectRoot\scripts\backup_daily.py"
        Args      = @()
        Desc      = 'Jarvis: 每日 2 点全量备份 config/output/docs/skills/scripts'
    },
    @{
        Name      = 'Jarvis_Weekly_Skill_Distill'
        Weekly    = $true
        DayOfWeek = 'Monday'
        Time      = '10:00'
        Script    = "$ProjectRoot\scripts\skill_auto_distill.py"
        Args      = @()
        Desc      = 'Jarvis: 每周一 10 点 Skill 自进化扫描'
    }
)

function Remove-JarvisTasks {
    foreach ($t in $tasks) {
        $exists = Get-ScheduledTask -TaskName $t.Name -ErrorAction SilentlyContinue
        if ($exists) {
            if ($DryRun) {
                Write-Host "[dry] would remove $($t.Name)"
            }
            else {
                Unregister-ScheduledTask -TaskName $t.Name -Confirm:$false
                Write-Host "[-] removed $($t.Name)" -ForegroundColor Yellow
            }
        }
    }
}

function New-JarvisTrigger($t) {
    if ($t.Monthly) {
        # PowerShell 没有原生 Monthly 简便 API，这里退化为 Daily + 在脚本里做日期判断
        # 为简化，这里直接用 Daily 触发器，让脚本 (generate_salary_poster.py) 自行判断日期
        return New-ScheduledTaskTrigger -Daily -At $t.Time
    }
    if ($t.Weekly) {
        return New-ScheduledTaskTrigger -Weekly -DaysOfWeek $t.DayOfWeek -At $t.Time
    }
    if ($t.Daily) {
        return New-ScheduledTaskTrigger -Daily -At $t.Time
    }
    return $null
}

function Register-JarvisTasks {
    foreach ($t in $tasks) {
        $argStr = "`"$($t.Script)`""
        if ($t.Args.Count -gt 0) {
            $argStr = $argStr + ' ' + ($t.Args -join ' ')
        }

        $action = New-ScheduledTaskAction -Execute $PythonExe `
            -Argument $argStr `
            -WorkingDirectory $ProjectRoot

        $trigger = New-JarvisTrigger $t
        if ($null -eq $trigger) { continue }

        if ($DryRun) {
            Write-Host "[dry] $($t.Name) @ $($t.Time)"
            Write-Host "      -> $PythonExe $argStr"
            continue
        }

        Unregister-ScheduledTask -TaskName $t.Name -Confirm:$false -ErrorAction SilentlyContinue
        Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $trigger `
            -Description $t.Desc -User $env:USERNAME -RunLevel Limited | Out-Null
        Write-Host "[+] $($t.Name) @ $($t.Time)" -ForegroundColor Green
    }
}

if ($Remove) {
    Remove-JarvisTasks
    exit 0
}

Write-Host "=== Jarvis OS 运营定时任务注册 (v2 · 8 项) ===" -ForegroundColor Cyan
Register-JarvisTasks

Write-Host ""
Write-Host "完成。查看已注册：" -ForegroundColor Cyan
Write-Host "  Get-ScheduledTask -TaskName 'Jarvis_*' | Select-Object TaskName, State"
Write-Host "清理：pwsh scripts/register_content_factory_cron.ps1 -Remove"
Write-Host ""
Write-Host "CEO 提示：Monthly 任务用 Daily 触发，但 generate_salary_poster.py" -ForegroundColor DarkGray
Write-Host "         内部会自行判断是否为每月 1 号，非 1 号当天自动跳过。" -ForegroundColor DarkGray
