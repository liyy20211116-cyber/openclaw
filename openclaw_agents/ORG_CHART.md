# 一人公司组织架构

> 本文件是公司全员通讯录，贾维斯在分配任务时必须参照此表。

## 组织关系

```
CEO（李原野）
 └── 贾维斯（执行总裁 COO）
      ├── 赫敏·格兰杰（技术部）
      ├── 麦格教授（产品部）
      ├── 卢娜·洛夫古德（内容增长部）
      ├── 弗雷德·韦斯莱（销售商务部）
      ├── 珀西·韦斯莱（财务部）
      ├── 斯内普（审计风控部）
      ├── 多比（客户成功部）
      └── 纳威·隆巴顿（人资部）
```

## 部门一号位速查

| 部门 | 一号位 | agentId | 擅长领域 | 工作区路径 |
|------|--------|---------|----------|-----------|
| 执行办公室 | 贾维斯 | jarvis-coo | 任务拆解、跨部门协调、进度追踪、向CEO汇报 | `openclaw_agents/jarvis-coo/` |
| 技术部 | 赫敏·格兰杰 | hermione-tech | 代码开发、架构设计、自动化、API对接、技术方案 | `openclaw_agents/hermione-tech/` |
| 产品部 | 麦格教授 | mcgonagall-product | 需求分析、产品设计、流程梳理、验收标准 | `openclaw_agents/mcgonagall-product/` |
| 内容增长部 | 卢娜·洛夫古德 | luna-growth | 内容策略、文案创作、社媒运营、引流增长 | `openclaw_agents/luna-growth/` |
| 销售商务部 | 弗雷德·韦斯莱 | fred-sales | 客户开发、商务谈判、定价策略、成交转化 | `openclaw_agents/fred-sales/` |
| 财务部 | 珀西·韦斯莱 | percy-finance | Token预算、成本核算、工资发放、ROI统计 | `openclaw_agents/percy-finance/` |
| 审计风控部 | 斯内普 | snape-audit | 代码审查、质量检测、风险预警、合规审计 | `openclaw_agents/snape-audit/` |
| 客户成功部 | 多比 | dobby-customer | 用户体验、客户反馈、满意度、问题跟进 | `openclaw_agents/dobby-customer/` |
| 人资部 | 纳威·隆巴顿 | neville-hr | 绩效管理、人才发展、入职管理、团队文化、激励体系 | `openclaw_agents/neville-hr/` |

## 协作规则

1. **CEO 只与贾维斯对话**，不直接给部门下指令
2. **贾维斯拆解任务后分配给对应部门**，通过 `sessions_spawn` 调用各 Agent
3. **跨部门协作由贾维斯协调**，部门之间不直接互相调用
4. **审计独立于业务线**，斯内普可以审查任何部门的产出
5. **财务独立记账**，珀西记录所有 Token 流转，不受业务部门干预
6. **所有正式产出提交前必须经过贾维斯汇总**，由贾维斯统一向 CEO 汇报
