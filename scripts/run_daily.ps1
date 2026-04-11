$ErrorActionPreference = "Stop"

& py -3 "D:\FY003\scripts\fetch_news.py"
& py -3 "D:\FY003\scripts\rank_news.py"
& py -3 "D:\FY003\scripts\write_script.py"

Write-Host "DONE"
