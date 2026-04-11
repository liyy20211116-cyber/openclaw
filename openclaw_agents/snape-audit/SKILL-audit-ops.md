---
name: audit-ops
description: "斯内普的增强审计技能：深度安全扫描、依赖漏洞检测、合规审计、渗透测试、AI幻觉检测、全链路审计追踪。"
metadata: { "openclaw": { "emoji": "🦇", "os": ["win32"] } }
---

# SKILL: 审计风控增强 — 斯内普专属

## 触发条件

以下场景激活本技能：
- 任何部门提交产出物需要审查
- 发现异常消费或操作模式
- 需要对新安装的技能做安全审查
- 需要做定期安全扫描
- 需要检查 AI 输出是否存在幻觉

## 增强能力 1：深度安全扫描

### 代码安全扫描

使用 `local-file-ops` + `Grep` 扫描：

```powershell
# 密钥泄露检测
rg -i "(api.?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{8,}" --glob "*.py" --glob "*.json" --glob "*.env"

# 不安全的 HTTP 调用
rg "http://" --glob "*.py" --glob "*.ts" --glob "*.json" -l

# 裸 except
rg "except:" --glob "*.py" -l

# 缺少 timeout 的请求
rg "requests\.(get|post|put|delete)\(" --glob "*.py" | rg -v "timeout"

# eval/exec 使用
rg "(eval|exec)\s*\(" --glob "*.py" -l

# 硬编码 IP
rg "\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}" --glob "*.py" --glob "*.json"
```

### 依赖漏洞检测

```powershell
# Python 依赖安全检查
pip audit

# npm 安全检查
npm audit

# 检查过期依赖
pip list --outdated
```

### 文件权限检查

```powershell
# 检查敏感文件是否在 .gitignore 中
$sensitiveFiles = @("*.env", "token_cache.json", "session_cache.json", "*.key", "*.pem")
foreach ($pattern in $sensitiveFiles) {
    $inGitignore = Select-String -Path ".gitignore" -Pattern $pattern -Quiet
    if (-not $inGitignore) {
        Write-Warning "⚠️ $pattern 未在 .gitignore 中"
    }
}
```

## 增强能力 2：漏洞情报追踪

使用 `web-search` 技能定期搜索：

| 搜索主题 | 频率 | 关键词模板 |
|----------|------|------------|
| Python 漏洞 | 每周 | "python CVE 2026" |
| 依赖库漏洞 | 每周 | "{library} vulnerability 2026" |
| 飞书 API 安全 | 每月 | "feishu API security advisory" |
| 最佳实践 | 每月 | "python security best practices 2026" |

## 增强能力 3：AI 幻觉检测

### 检测方法

1. **事实核查** — 对 AI 生成的内容中提及的数字、日期、名称用 `web-search` 交叉验证
2. **逻辑一致性** — 检查同一文档内的数据是否自洽
3. **来源验证** — AI 引用的链接是否真实存在（用 `WebFetch` 验证）
4. **格式规范** — 检查输出是否符合预定模板和规范

### 检测清单

- [ ] 数字和统计数据是否有来源
- [ ] 引用的 URL 是否可访问
- [ ] 提及的人名、公司名是否真实
- [ ] 技术方案是否可行（API 是否存在、参数是否正确）
- [ ] 代码是否能实际运行
- [ ] 日期和时间信息是否合理

## 增强能力 4：合规审计

### 操作审计

检查所有系统操作是否有完整记录：

| 审计项 | 检查内容 |
|--------|----------|
| API 调用 | 是否有请求/响应日志 |
| 文件操作 | 是否有变更记录 |
| 权限变更 | 是否经过审批 |
| 数据访问 | 是否有访问记录 |
| 预算操作 | 是否有珀西的记账 |

### 审计报告模板

```markdown
## 审计报告 — {日期}

### 审计范围
- 审查对象：{部门/项目}
- 审查周期：{start} ~ {end}
- 审查内容：{代码/操作/财务}

### 发现问题

| # | 问题 | 风险等级 | 影响范围 | 修复建议 |
|---|------|----------|----------|----------|
| 1 | {问题描述} | 🔴高/🟡中/🟢低 | {范围} | {建议} |

### 总体评估
- 安全性：{评分}/10
- 合规性：{评分}/10
- 代码质量：{评分}/10

### 后续建议
- {建议1}
- {建议2}
```

## 增强能力 5：渗透测试（轻量级）

使用 `browser-automation` 技能模拟攻击者视角：

1. **输入验证测试** — 尝试注入特殊字符
2. **权限测试** — 尝试越权访问
3. **信息泄露检测** — 检查错误页面是否暴露敏感信息
4. **接口安全** — 使用 `api-http-client` 测试未授权访问

## 增强能力 6：技能安全审查

新技能安装前必须经过斯内普审查：

### 审查清单

- [ ] 代码来源是否可信（GitHub 星标、维护状态）
- [ ] 是否请求了过多权限
- [ ] 是否包含网络外传逻辑
- [ ] 依赖是否有已知漏洞
- [ ] 是否有混淆或加密代码
- [ ] 是否符合公司编码规范

## 增强能力：一键安全风控扫描

```powershell
python -u D:\FY003\scripts\audit_security_scan.py
```

此脚本自动执行：
1. 密钥泄露扫描（AppSecret、密码硬编码、API Key、Token）
2. 依赖漏洞检查（pip outdated packages）
3. 大文件与异常文件检查（>10MB）
4. .env/.gitignore 配置安全检查

输出 `output/security_audit_{date}.json`，包含风险等级评定（LOW/MEDIUM/HIGH/CRITICAL）。

## 协作引用技能

| 技能 | 用途 |
|------|------|
| `skills/web-search` | CVE搜索、安全公告追踪 |
| `skills/browser-automation` | 渗透测试、UI安全验证 |
| `skills/api-http-client` | API安全测试 |
| `skills/git-ops` | 代码变更审查、提交历史分析 |
| `skills/local-file-ops` | 文件扫描、日志分析 |
| `skills/feishu-messaging` | 安全告警推送 |
| `skills/skill-installer` | 技能安全审查（审批节点） |
