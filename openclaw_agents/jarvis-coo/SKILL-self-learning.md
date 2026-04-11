---
name: self-learning
description: "贾维斯的自我学习增强系统：记忆整理、周反思、学习→行动触发器。"
metadata: { "openclaw": { "emoji": "🧠", "os": ["win32"] } }
---

# SKILL: 自我学习系统 — 贾维斯专属

## 设计理念

**学习不是记流水账，而是「记忆→压缩→反思→行动」的闭环。**

```
记忆写入 → 定期压缩去重 → 周反思总结 → 发现问题模式 → 触发修复行动
   ↑                                                        |
   └────────── 新的学习经验写回记忆 ←──────────────────────┘
```

## 触发条件

以下场景激活本技能：
- 周末或周一进行周反思
- 发现 learnings.md 超过 50 条记录
- CEO 问"你学到了什么"或"总结一下"
- 重复遇到已知问题时自动触发行动

## 工具 1：记忆整理压缩

```powershell
python -u D:\FY003\scripts\memory_consolidate.py
```

功能：
1. 解析 `learnings.md` 所有记录
2. 基于前100字符去重
3. 按主题分类（ONES/Agent能力/团队/CEO/技术/方法论）
4. 生成压缩版 `learnings_compressed.md`
5. 从 OpenClaw workspace/memory/ 同步最新记忆
6. 输出结构化知识库 `output/knowledge_base_{date}.json`

**建议频率**：每周一次，或 learnings.md 超过 50 条时

## 工具 2：周反思报告

```powershell
python -u D:\FY003\scripts\weekly_reflection.py
```

功能：
1. 收集本周 OpenClaw 记忆文件
2. 统计本周学习记录和产出文件
3. 检查 cron 定时任务执行情况
4. 提取本周热门主题
5. 生成反思问题清单
6. 输出 `output/weekly_reflection_{date}.json` 和 `.md`

**建议频率**：每周日或周一执行一次

## 工具 3：学习→行动触发器

```powershell
# 仅分析，不执行
python -u D:\FY003\scripts\learning_action_trigger.py

# 分析并自动执行可修复项
python -u D:\FY003\scripts\learning_action_trigger.py --execute
```

功能：
1. 扫描所有记忆文件，匹配已知问题模式
2. 计算问题频率和紧急度（HIGH/MEDIUM/LOW）
3. 对每个问题生成具体行动建议
4. 标记是否可自动修复
5. `--execute` 模式下自动运行修复脚本
6. 输出 `output/action_triggers_{date}.json`

已内置的问题→行动映射：

| 问题模式 | 行动 | 可自动修复 |
|---------|------|:---------:|
| Token 过期 | 自动刷新或提醒 CEO | ✅ |
| 密钥硬编码 | 运行安全扫描 | ❌ |
| 网络断连 | 检查网络并重启 | ✅ |
| 环境缺失 | 运行自检并安装 | ✅ |
| 卡片服务停止 | 重启服务 | ✅ |
| 记忆冗余 | 运行压缩整理 | ✅ |

## 记忆写入规范

当你学到新东西时，按以下格式写入 `learnings.md`：

```markdown
---
_{日期 时间}_
【分类】简明结论（一句话）

补充细节（可选，不超过 3 行）
```

**分类标签**：`技术问题`、`业务决策`、`CEO偏好`、`团队管理`、`方法论`、`安全风控`

**写入原则**：
- 只记结论，不记过程
- 一条记录不超过 100 字
- 避免记录重复内容——先检查是否已有类似记录
- 如果是对旧记录的更新，标注"更新：xxx"

## 周反思流程（每周日执行）

1. 运行 `memory_consolidate.py` → 压缩整理记忆
2. 运行 `weekly_reflection.py` → 生成反思报告
3. 运行 `learning_action_trigger.py` → 检查待处理问题
4. 回答反思报告中的 5 个问题
5. 将反思结论写入 `learnings.md`
6. 向 CEO 发送周报摘要（如有重要发现）
