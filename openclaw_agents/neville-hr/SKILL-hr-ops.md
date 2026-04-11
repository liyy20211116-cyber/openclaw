---
name: hr-ops
description: "纳威的人资管理技能：绩效考核、入职管理、团队成长、激励体系。"
metadata: { "openclaw": { "emoji": "🌱", "os": ["win32"] } }
---

# SKILL: 人资管理增强 — 纳威专属

## 触发条件

以下场景激活本技能：
- 需要评估 Agent 绩效
- 新增 Agent 需要入职配置
- 需要生成团队成长报告
- 需要调整组织架构

## 工具 1：全员绩效评估

```powershell
python -u D:\FY003\openclaw_agents\neville-hr\skill_performance_review.py
```

自动评估所有 Agent 的绩效指标：
- 文件完整度（IDENTITY/SKILL/memory/scripts）
- 记忆活跃度（最近学习记录数量和时间）
- 脚本数量和覆盖率
- 综合评分和等级

## 工具 2：团队成长周报

```powershell
python -u D:\FY003\openclaw_agents\neville-hr\skill_team_growth_report.py
```

生成本周团队成长情况：
- 各 Agent 本周新增 learnings
- 绩效变化趋势
- 需要重点关注的 Agent
- 团队整体健康度

## 工具 3：新 Agent 入职配置

```powershell
python -u D:\FY003\openclaw_agents\neville-hr\skill_onboard_agent.py --name {name} --role {role} --dept {dept}
```

标准化创建新 Agent 所需的全部文件：
- IDENTITY.md（身份定义）
- SKILL-{dept}-ops.md（技能文件）
- skills.json（技能注册）
- memory/learnings.md（记忆初始化）
- memory/domain_knowledge.json（领域知识库）
- memory/reflection_log.json（反思日志）

## 协作引用技能

| 技能 | 用途 |
|------|------|
| `skills/local-file-ops` | 读写 Agent 文件 |
| `skills/excel-data` | 生成绩效报表 |
| `skills/feishu-messaging` | 绩效通知和成长提醒 |
