# fetch_ones_uuids.ps1  -  补全 config.json 剩余 TODO 字段
# 使用场景: 登录 ONES 后从浏览器 F12 拿到新 token, 替换下面的 BEARER/COOKIE, 再运行
# Usage: powershell -ExecutionPolicy Bypass -File fetch_ones_uuids.ps1

# ============================================================
# 1. 替换这两行 (F12 > Network > 任意请求 > Headers)
# ============================================================
$BEARER = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM1MGQyYmQ1LTIzZjEtNDI2ZC02NWY1LTJkMjAzYzIzY2VjMCIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsib25lcy52MSJdLCJjbGllbnRfaW5mbyI6eyJjbGllbnRfaXAiOiIxMTkuMTAyLjIuMTc0In0sImV4cCI6MTc3MzQxODY2MiwiaWF0IjoxNzczNDE0NzYyLCJpc3MiOiJodHRwOi8vb25lcy53aW5uZXJtZWRpY2FsLmNvbS8iLCJqdGkiOiJmYTg2MTExZi0zYzJmLTRlMTItNTZiOC1iYzAyMjI1ODE4YTYiLCJsb2dpbl90aW1lIjoxNzczNDA3ODIyMTcyLCJuYmYiOjE3NzM0MTQ3NjIsIm9yZ191c2VyX3V1aWQiOiI1a3RyNDQ1TiIsIm9yZ191dWlkIjoiVVRjRUNEbXgiLCJyZWdpb25fdXVpZCI6ImRlZmF1bHQiLCJzY29wZXMiOlsib3BlbmlkIiwib2ZmbGluZV9hY2Nlc3MiLCJvbmVzOm9yZzpkZWZhdWx0OlVUY0VDRG14OjVrdHI0NDVOIl0sInNpZCI6IjNlZDZjNGZjLTJmMjItNDAzOS03ZjFhLTE1NTFmODY1NzgyZiIsInN1YiI6IlE3VHFNckFROmRlZmF1bHQ6VVRjRUNEbXg6NWt0cjQ0NU4ifQ.JE0x3KRO9G3_ZLhvfTFtuYFVupJsKRVyqlczzFPovg0vtfuYJv3i0sCjGNyPHjtg9VokoMaZp359A4wizCabhbTmlXdqrl1_4dALh4gKJB_isUtr-70-XU2L90_CAaSdspGu0s7xnl-iZEMFGffUGl8M7Gjti4vVNSdrJqck4_imT4WJ9vqt7YLq4_4385u4xC_Rrd9d33HjExPiX66Cjk-iekYahoupOs0kfWff8z1uf2OEGcn0I7xkMIE2ngTTh89D9esMBLqHNYgpfw3-NLmJb6UcHBDlV0jXVc2sQWbnfvVA2Jn1saQMOnlWu9j2dpL2VrQegXTCJPQ4LV1Mpg"
$COOKIE = "ones-lang=zh; ones-tz=Asia%2FShanghai; ones-region-uuid=default; ones-org-uuid=UTcECDmx; wis_access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsid2lzIl0sInVzZXJfaW5mbyI6eyJ1c2VybmFtZSI6IuadjuWOn-mHjiIsImlkIjoyMjA0MywiYWNjb3VudCI6IlVDMjAyMTA4MjUxNDE1MzQwMTk4NDYiLCJtb2JpbGUiOiIxNzc0MDYzNDYxNiIsIm9yZ0NvZGUiOiIwMDAwIiwiYWNjb3VudFR5cGUiOjEsIm1haW5BY2NvdW50IjowLCJlbXBsb3llZU5vIjoiOTE3NjQiLCJzdGF0dXMiOjYsImlzQWQiOjEsImRvbWFpblByaW5jaXBhbEFjY291bnQiOiJsaXl5In0sInVzZXJfbmFtZSI6IuadjuWOn-mHjiIsInNjb3BlIjpbIlJPTEVfQURNSU4iLCJST0xFX1VTRVIiLCJST0xFX0FQSSJdLCJleHAiOjE3NzM0OTQyMTYsImp0aSI6ImI4NjMyMWJmLTM2NzYtNGU0ZS1hODIzLTVmNGNkMmU0YzJmYiIsImNsaWVudF9pZCI6IndpcyJ9.31FM7EO4LLV1GoVwnUTyFtmGWZ6PUaVkI90ElaMmYrI; ones-ids-sid=f36df6eb-5514-4517-5963-0fa3edd638fd; timezone=Asia/Shanghai"

# ============================================================
# 2. 固定配置 (不需要改)
# ============================================================
$BASE = "https://ones.winnermedical.com"
$TEAM = "BSsxXFv2"
$PROJ = "QE2GXyz1K1Z1aDui"
$GQL  = "$BASE/project/api/project/team/$TEAM/items/graphql"
$API  = "$BASE/project/api/project/team/$TEAM/project/$PROJ"

$H = @{
    "Authorization" = "Bearer $BEARER"
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
    "Cookie"        = $COOKIE
    "Referer"       = "$BASE/project/"
}

$OutDir = $PSScriptRoot
$ConfigPath = Join-Path $PSScriptRoot "config.json"

function GqlPost($query, $label) {
    $body = [System.Text.Encoding]::UTF8.GetBytes("{`"query`":`"$query`"}")
    try {
        $r = Invoke-WebRequest -Uri $GQL -Method POST -Headers $H -Body $body -UseBasicParsing
        $outFile = Join-Path $OutDir "$label.json"
        [System.IO.File]::WriteAllText($outFile, $r.Content, [System.Text.Encoding]::UTF8)
        Write-Host "[OK $($r.StatusCode)] $label -> $label.json"
        return ($r.Content | ConvertFrom-Json)
    } catch {
        Write-Host "[ERR $($_.Exception.Response.StatusCode.value__)] $label"
        return $null
    }
}

function RestGet($url, $label) {
    try {
        $r = Invoke-WebRequest -Uri $url -Method GET -Headers $H -UseBasicParsing
        $outFile = Join-Path $OutDir "$label.json"
        [System.IO.File]::WriteAllText($outFile, $r.Content, [System.Text.Encoding]::UTF8)
        Write-Host "[OK $($r.StatusCode)] $label -> $label.json"
        return ($r.Content | ConvertFrom-Json)
    } catch {
        Write-Host "[ERR $($_.Exception.Response.StatusCode.value__)] $label"
        return $null
    }
}

Write-Host ""
Write-Host "=== 1. 查询 MtkJMUfU (需求优先级) 和 VzvqjJRe (价值类型) 的选项 ==="
$q = "{ fields(filter:{ uuid_in:[\\\"MtkJMUfU\\\",\\\"VzvqjJRe\\\",\\\"ScqUnZYX\\\",\\\"BmupUp2N\\\"] }) { uuid name fieldType allowedValues { uuid value } } }"
$fieldsData = GqlPost $q "gql_target_fields"

if ($fieldsData -and $fieldsData.data.fields) {
    foreach ($f in $fieldsData.data.fields) {
        Write-Host "  uuid=$($f.uuid)  name=$($f.name)  type=$($f.fieldType)"
        if ($f.allowedValues -and $f.allowedValues.Count -gt 0) {
            foreach ($opt in $f.allowedValues) {
                Write-Host "    option: $($opt.uuid) = $($opt.value)"
            }
        } else {
            Write-Host "    (no options)"
        }
    }
}

Write-Host ""
Write-Host "=== 2. 查询问题缺陷 (TNVWjjtZ) 的字段配置 ==="
$bugConfig = RestGet "$API/field_config?issue_type_uuid=TNVWjjtZ" "field_config_bug_v2"

if ($bugConfig -and $bugConfig.field_configs) {
    $required = $bugConfig.field_configs | Where-Object { $_.required -eq $true }
    Write-Host "  Required fields for 问题缺陷:"
    foreach ($fc in ($required | Sort-Object position)) {
        Write-Host "  pos=$($fc.position) uuid=$($fc.field_uuid) type=$($fc.type)"
    }
}

Write-Host ""
Write-Host "=== 3. 确认 issues types ==="
$itData = GqlPost "{ issueTypes { uuid name builtIn } }" "gql_issue_types_v2"
if ($itData -and $itData.data.issueTypes) {
    $itData.data.issueTypes | Where-Object { $_.name -match "." } | ForEach-Object {
        $outLine = "uuid=$($_.uuid)  name=$($_.name)"
        [System.Text.Encoding]::UTF8.GetBytes($outLine) | Out-Null
    }
    $outPath2 = Join-Path $OutDir "issue_types_names.txt"
    $lines = $itData.data.issueTypes | ForEach-Object { "$($_.uuid)`t$($_.name)" }
    [System.IO.File]::WriteAllLines($outPath2, $lines, [System.Text.Encoding]::UTF8)
    Write-Host "  -> issue_types_names.txt"
}

Write-Host ""
Write-Host "=== Done. 检查上方输出补全 config.json 的 TODO 项 ==="
