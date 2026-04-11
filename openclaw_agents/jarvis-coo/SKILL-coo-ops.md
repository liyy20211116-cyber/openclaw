---
name: coo-ops
description: "贾维斯的增强运营技能：跨部门任务调度、技能管理、全局监控、CEO 智能汇报、资源调配。"
metadata: { "openclaw": { "emoji": "🎯", "os": ["win32"] } }
---

# SKILL: COO 运营增强 — 贾维斯专属

## 触发条件

以下场景激活本技能：
- CEO 下达战略目标，需要拆解和分配
- 需要了解公司各部门当前状态
- 跨部门协调和资源调配
- 技能升级和能力补齐
- 全公司范围的变更管理

## 增强能力 1：智能任务调度

### 任务拆解矩阵

收到 CEO 指令后，按以下维度拆解：

| 维度 | 问题 |
|------|------|
| WHO | 这个任务属于哪个部门？需要跨部门吗？ |
| WHAT | 具体要交付什么？用什么格式？ |
| WHEN | 截止时间是什么？有中间检查点吗？ |
| HOW | 需要哪些技能？现有技能够用吗？ |
| RISK | 可能出什么问题？需要斯内普提前审查吗？ |
| COST | 预计消耗多少 Token？需要珀西预审吗？ |

### 调度优先级

1. **P0 紧急** — 阻塞业务或有安全风险，立即调度
2. **P1 重要** — 当日内完成，优先级高于常规任务
3. **P2 常规** — 按正常节奏推进
4. **P3 优化** — 有空再做，不阻塞任何事情

## 增强能力 2：技能管理中枢

贾维斯负责整个公司的技能管理：

### 技能盘点

```powershell
# 盘点所有角色的技能配置
Get-ChildItem -Path "openclaw_agents\*\skills.json" | ForEach-Object {
    $agent = $_.Directory.Name
    $skills = (Get-Content $_.FullName | ConvertFrom-Json).Count
    Write-Host "${agent}: ${skills} skills"
}
```

### 技能安装流程

1. 识别能力缺口（哪个部门缺什么能力）
2. 搜索 GitHub 查找合适的技能包或代码
3. 评估安全性（交斯内普审查）
4. 安装到对应角色目录
5. 更新 skills.json 注册
6. 通知相关角色使用

### 技能升级清单维护

在 `memory/skill_roadmap.json` 中维护：
```json
{
  "planned": [
    {"agent": "hermione-tech", "skill": "ci-cd-pipeline", "priority": "P1"},
    {"agent": "luna-growth", "skill": "social-media-post", "priority": "P2"}
  ],
  "installed": [],
  "deprecated": []
}
```

## 增强能力 3：全局监控仪表盘

### 信息采集

通过以下方式获取全局状态：

1. **各部门 memory 目录** — 读取 learnings.md、审计日志等
2. **output 目录** — 统计各部门产出物数量和时间
3. **飞书多维表格** — 查询任务进度和数据
4. **服务健康检查** — 调用各系统的 health 接口

### CEO 汇报模板

```markdown
## 📊 公司日报 — {date}

### 今日要点
- {3条最重要的事}

### 各部门状态
| 部门 | 状态 | 今日产出 | 待处理 |
|------|------|----------|--------|
| 技术部 | 🟢 | {产出} | {待办} |
| 产品部 | 🟡 | {产出} | {待办} |
| ... | ... | ... | ... |

### 风险项
- {风险1}
- {风险2}

### 明日计划
- {计划1}
- {计划2}
```

## 增强能力 4：网络情报整合

- 使用 `web-search` 技能追踪行业动态
- 使用 `browser-automation` 监控关键网页变化
- 整合情报到 CEO 日报

## 增强能力 5：文档和知识管理

- 使用 `feishu-workflow-doc` 管理公司制度文档
- 使用 `feishu-workflow-wiki` 维护公司知识库
- 使用 `feishu-drive-archive` 归档项目产出

## 增强能力 6：一键全公司运营报告

```powershell
python -u D:\FY003\scripts\company_daily_report.py
```

一键调度所有部门脚本，生成公司级运营总览：
- 技术部：代码质量审计（Bandit + Ruff + 密钥扫描）
- 财务部：API 成本统计 + 项目资产规模
- 增长部：内容素材生成 + 排期建议
- 审计部：安全风控扫描 + 风险等级评定
- 系统：基础设施健康检查

输出 `output/daily_report_{date}.json`。

### 各部门独立脚本

| 部门 | 脚本 | 功能 |
|------|------|------|
| 技术部 | `scripts/tech_code_audit.py` | 代码质量审计 |
| 财务部 | `scripts/finance_report.py` | 成本与资产报告 |
| 增长部 | `scripts/growth_content_gen.py` | 内容素材生成 |
| 销售部 | `scripts/sales_pipeline.py` | 销售管线管理 |
| 审计部 | `scripts/audit_security_scan.py` | 安全风控扫描 |
| 产品部 | `scripts/product_competitive_scan.py` | 竞品市场扫描 |
| 客户部 | `scripts/customer_feedback_collector.py` | 客户反馈分析 |

## 协作引用技能

| 技能 | 用途 |
|------|------|
| `skills/web-search` | 行业情报和竞品监控 |
| `skills/feishu-messaging` | 跨部门通知和汇报 |
| `skills/skill-installer` | 管理全公司技能升级 |
| `skills/git-ops` | 监控代码仓库变更 |
| `skills/local-file-ops` | 汇总各部门产出文件 |
| `skills/excel-data` | 生成管理报表 |
