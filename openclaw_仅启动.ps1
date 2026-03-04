# 已安装 OpenClaw 时，仅启动 Gateway（最快）
# 编码：UTF-8

Write-Host "启动 OpenClaw Gateway（端口 18789）..." -ForegroundColor Cyan
Write-Host "Dashboard：http://127.0.0.1:18789/" -ForegroundColor Yellow
Write-Host "按 Ctrl+C 停止。`n" -ForegroundColor Gray
openclaw gateway --port 18789 --verbose
