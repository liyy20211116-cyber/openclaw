---
name: auto-inspection
description: 自动巡检已完成任务，检查预算合规、质量标准、权限合规和时效性，生成审计事件。
---

# 自动巡检技能

## 触发条件

- 收到「巡检」「审计检查」「合规扫描」指令
- 定时巡检触发（通过系统调度）

## 输入

系统会提供待巡检的任务列表，每个任务包含：
- 任务 ID、标题、描述、类型
- 负责人、预算、实际花费
- 截止日期、完成时间
- 状态、操作日志

## 检查规则

### 1. 预算超支检查
- 条件：`spentToken > budgetToken * 1.2`
- 风险等级：medium（120%-150%）、high（150%-200%）、critical（>200%）
- 问题类型：overspend

### 2. 超时检查
- 条件：`completedAt > dueAt + 2天` 或 `status=in_progress && now > dueAt`
- 风险等级：low（超期1-3天）、medium（超期3-7天）、high（超期>7天）
- 问题类型：low_quality

### 3. 描述完整性检查
- 条件：`description` 为空或少于 10 字
- 风险等级：low
- 问题类型：low_quality

### 4. 重复任务检查
- 条件：同一负责人有 2+ 个标题相似度 >80% 的进行中任务
- 风险等级：medium
- 问题类型：duplicate

## 输出要求

返回 JSON 数组，每个元素为一个审计事件：

```json
[
  {
    "taskId": "task_xxx",
    "agentId": "agent_xxx",
    "riskLevel": "medium",
    "issueType": "overspend",
    "detail": "任务「xxx」预算 500 Token，实际花费 650 Token，超支 30%"
  }
]
```

若无问题，返回空数组 `[]`。
