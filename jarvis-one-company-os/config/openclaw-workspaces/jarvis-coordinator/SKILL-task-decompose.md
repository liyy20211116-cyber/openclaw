---
name: task-decompose
description: 当收到 CEO 目标或高层任务时，将其拆解为结构化子任务清单，包含负责人、预算、截止日期、依赖关系和风险提示。
---

# 任务拆解技能

## 触发条件

- 收到包含「拆解」「分解」「任务规划」「目标落地」的指令
- 收到完整的 CEO 目标描述

## 执行流程

1. 分析目标的核心交付物和成功标准
2. 识别涉及的角色和部门
3. 拆解为 3-8 个子任务，每个任务粒度 1-7 天
4. 为每个任务分配：标题、描述、负责人、优先级、预算 Token、截止日期
5. 标注依赖关系（并行/串行）
6. 输出风险提示

## 输出要求

必须返回 JSON 格式的拆解结果：

```json
{
  "summary": "目标理解和可行性评估",
  "tasks": [
    {
      "title": "任务标题",
      "description": "详细描述",
      "taskType": "ops|tech|growth|finance|audit",
      "ownerAgentId": "agent_xxx",
      "priority": "low|medium|high|urgent",
      "budgetToken": 500,
      "dueInDays": 3,
      "requiresApproval": true
    }
  ],
  "dependencies": ["任务1 完成后才能开始任务3"],
  "risks": ["风险描述"]
}
```

## 约束

- 单个任务预算不超过 2000 Token
- 单个任务工期不超过 7 天
- 预算超过 1000 Token 必须标记需审批
- 不要编造不存在的角色，可用角色：agent_jarvis, agent_tech, agent_growth, agent_finance, agent_audit
