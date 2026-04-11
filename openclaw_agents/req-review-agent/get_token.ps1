# get_token.ps1 — 获取有效的 ONES Bearer Token
# 返回 token 字符串；若 Token 过期则自动弹窗引导用户刷新
# 用法：$token = & ".\get_token.ps1"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$result = python "$scriptDir\auto_token.py" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "无法获取 ONES Token：$result"
    exit 1
}

# 最后一行是 token
$lines = ($result -split "`n") | Where-Object { $_.Trim() -ne "" }
$token = $lines[-1].Trim()
Write-Output $token
