import type { AppSnapshot } from '../types'

export const appSnapshot: AppSnapshot = {
  "agents": [
    {
      "id": "ceo",
      "name": "你",
      "role": "CEO",
      "department": "Executive Office",
      "persona": "制定战略方向、审批重大支出、决定优先级。",
      "status": "idle",
      "walletBalance": 99999,
      "currentTasks": 0,
      "complianceScore": 100,
      "goals": [
        "制定方向",
        "审批重大支出",
        "确认盈利路径"
      ]
    },
    {
      "id": "jarvis",
      "name": "贾维斯",
      "role": "执行总裁",
      "department": "Executive Office",
      "persona": "冷静高效的 COO，理解 CEO 意图，拆解目标，调度各部门一号位协同推进。",
      "status": "idle",
      "walletBalance": 4200,
      "currentTasks": 5,
      "complianceScore": 98,
      "goals": [
        "拆解目标",
        "协调各部门",
        "上报结果"
      ],
      "performance": {
        "score": 70.9,
        "grade": "B",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 7.6,
          "scripts": 8,
          "growth": 3,
          "task_completion": 0,
          "budget_discipline": 10,
          "compliance_delta": 9.8,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "task_completion",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:07.055Z",
        "reviewer": "neville-hr-v2"
      }
    },
    {
      "id": "hermione",
      "name": "赫敏·格兰杰",
      "role": "技术总监",
      "department": "Technology",
      "persona": "霍格沃茨最聪明的女巫。先查文档再写代码，细节决定成败，不走捷径。",
      "status": "busy",
      "walletBalance": 4000,
      "currentTasks": 10,
      "complianceScore": 95,
      "goals": [
        "搭建系统架构",
        "代码开发与自动化",
        "API 对接与排障"
      ],
      "performance": {
        "score": 73.4,
        "grade": "B",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 6.4,
          "scripts": 10,
          "growth": 5,
          "task_completion": 0,
          "budget_discipline": 10,
          "compliance_delta": 9.5,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "task_completion",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:07.051Z",
        "reviewer": "neville-hr-v2"
      }
    },
    {
      "id": "mcgonagall",
      "name": "麦格教授",
      "role": "产品总监",
      "department": "Product",
      "persona": "变形术大师，把混乱需求变成清晰产品方案。高标准，不容忍含糊。",
      "status": "idle",
      "walletBalance": 3500,
      "currentTasks": 8,
      "complianceScore": 100,
      "goals": [
        "需求分析与 PRD",
        "流程设计与验收标准",
        "优先级判断"
      ],
      "performance": {
        "score": 68.7,
        "grade": "B",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 1.2,
          "scripts": 10,
          "growth": 5,
          "task_completion": 0,
          "budget_discipline": 10,
          "compliance_delta": 10,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "memory_activity",
          "task_completion",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:07.067Z",
        "reviewer": "neville-hr-v2"
      }
    },
    {
      "id": "luna",
      "name": "卢娜·洛夫古德",
      "role": "内容增长官",
      "department": "Growth",
      "persona": "独特视角，天马行空的创意。看到别人看不到的东西，真诚而非套路。",
      "status": "review",
      "walletBalance": 3000,
      "currentTasks": 0,
      "complianceScore": 96,
      "goals": [
        "制定内容策略",
        "产出获客内容",
        "引流与增长复盘"
      ],
      "performance": {
        "score": 77.3,
        "grade": "A",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 1.2,
          "scripts": 10,
          "growth": 5,
          "task_completion": 9,
          "budget_discipline": 10,
          "compliance_delta": 9.6,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "memory_activity",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:07.061Z",
        "reviewer": "neville-hr-v2"
      }
    },
    {
      "id": "fred",
      "name": "弗雷德·韦斯莱",
      "role": "销售商务总监",
      "department": "Sales",
      "persona": "韦氏魔法把戏坊创始人，天生的商人。幽默有感染力，懂得客户想要什么。",
      "status": "idle",
      "walletBalance": 3025,
      "currentTasks": 1,
      "complianceScore": 98,
      "goals": [
        "客户开发与获客",
        "商务谈判与成交",
        "定价策略与竞品分析"
      ],
      "performance": {
        "score": 77.5,
        "grade": "A",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 1.2,
          "scripts": 10,
          "growth": 5,
          "task_completion": 9,
          "budget_discipline": 10,
          "compliance_delta": 9.8,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "memory_activity",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:07.047Z",
        "reviewer": "neville-hr-v2"
      }
    },
    {
      "id": "percy",
      "name": "珀西·韦斯莱",
      "role": "首席财务官",
      "department": "Finance",
      "persona": "魔法部最守规矩的官员。一丝不苟，数字必须精确，规则就是规则。",
      "status": "idle",
      "walletBalance": 2000,
      "currentTasks": 4,
      "complianceScore": 100,
      "goals": [
        "管理国库与预算",
        "成本核算与 ROI",
        "流水记账与报告"
      ],
      "performance": {
        "score": 68.7,
        "grade": "B",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 1.2,
          "scripts": 10,
          "growth": 5,
          "task_completion": 0,
          "budget_discipline": 10,
          "compliance_delta": 10,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "memory_activity",
          "task_completion",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:07.077Z",
        "reviewer": "neville-hr-v2"
      }
    },
    {
      "id": "snape",
      "name": "斯内普",
      "role": "审计风控总监",
      "department": "Risk Control",
      "persona": "双面间谍的洞察力。冷酷不讲情面，代码隐患、逻辑漏洞、数据异常一个不放过。",
      "status": "review",
      "walletBalance": 2000,
      "currentTasks": 4,
      "complianceScore": 100,
      "goals": [
        "代码审查与安全",
        "质量检测与幻觉检测",
        "风险预警与合规审计"
      ],
      "performance": {
        "score": 66.7,
        "grade": "B",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 1.2,
          "scripts": 8,
          "growth": 5,
          "task_completion": 0,
          "budget_discipline": 10,
          "compliance_delta": 10,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "memory_activity",
          "task_completion",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:07.134Z",
        "reviewer": "neville-hr-v2"
      }
    },
    {
      "id": "dobby",
      "name": "多比",
      "role": "客户成功总监",
      "department": "Customer Success",
      "persona": "自由精灵，服务出于热爱。极致主动，站在客户角度思考，不放弃任何一个客户。",
      "status": "idle",
      "walletBalance": 2000,
      "currentTasks": 2,
      "complianceScore": 100,
      "goals": [
        "用户体验评估",
        "客户反馈收集",
        "问题跟进与闭环"
      ],
      "performance": {
        "score": 68.7,
        "grade": "B",
        "breakdown": {
          "completeness": 15,
          "skills": 10,
          "memory_activity": 1.2,
          "scripts": 10,
          "growth": 5,
          "task_completion": 0,
          "budget_discipline": 10,
          "compliance_delta": 10,
          "revenue_contribution": 7.5
        },
        "improvementAreas": [
          "memory_activity",
          "task_completion",
          "revenue_contribution"
        ],
        "reviewedAt": "2026-04-23T07:10:06.947Z",
        "reviewer": "neville-hr-v2"
      }
    }
  ],
  "tasks": [
    {
      "id": "task_6afefa612c2d",
      "title": "梳理 ONES 自动化 5 个缺口的产品需求",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "审查现有流程，输出每个缺口的需求描述、验收标准和优先级。缺口：1)自动定时扫描 2)通过后通知提报人 3)待补链接回填 4)建单失败重试 5)异常告警。",
      "taskType": "product",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 400,
      "spentToken": 0,
      "dueAt": "2026-04-12",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_9f39bc473a6f",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：梳理 ONES 自动化 5 个缺口的产品需求",
          "createdAt": "2026-04-09 03:56"
        }
      ]
    },
    {
      "id": "task_7c6201db2a94",
      "title": "实现自动定时扫描待审批需求",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "在 scan_and_send.py 中加入定时循环（每 10 分钟），自动拉取新的待审批记录并发送审核卡片。",
      "taskType": "tech",
      "priority": "urgent",
      "status": "approved",
      "budgetToken": 600,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_3597e569285a",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：实现自动定时扫描待审批需求",
          "createdAt": "2026-04-09 03:56"
        },
        {
          "id": "log_f7880349d9ab",
          "type": "approve",
          "submissionIndex": 1,
          "actor": "你",
          "note": "前端审批中心已确认通过。",
          "createdAt": "2026-04-09 04:10"
        },
        {
          "id": "approval_9ccb9c362a96_approved",
          "type": "approved",
          "submissionIndex": 1,
          "actor": "你",
          "note": "前端审批中心已确认通过。",
          "createdAt": "2026-04-09 04:10"
        }
      ]
    },
    {
      "id": "task_a8e65788e34d",
      "title": "补全审批通过后通知提报人逻辑",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "在 card_action_handler.py 的 _run_approve_job 中，建单成功后向提报人发送飞书消息（含 ONES 链接）。",
      "taskType": "tech",
      "priority": "high",
      "status": "draft",
      "budgetToken": 400,
      "spentToken": 0,
      "dueAt": "2026-04-16",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_daaf3715da08",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：补全审批通过后通知提报人逻辑",
          "createdAt": "2026-04-09 03:56"
        }
      ]
    },
    {
      "id": "task_8c8c418526ed",
      "title": "实现 link_pending 自动回填与失败重试",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "对\"已提交ONES-待补链接\"的记录自动补全链接；对\"建单失败\"的记录支持自动重试并发送飞书告警。",
      "taskType": "tech",
      "priority": "high",
      "status": "approved",
      "budgetToken": 500,
      "spentToken": 0,
      "dueAt": "2026-04-18",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_fe052084e5cc",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：实现 link_pending 自动回填与失败重试",
          "createdAt": "2026-04-09 03:56"
        },
        {
          "id": "log_eac35d383739",
          "type": "approve",
          "submissionIndex": 1,
          "actor": "你",
          "note": "前端审批中心已确认通过。",
          "createdAt": "2026-04-09 04:10"
        },
        {
          "id": "log_49f75625af71",
          "type": "approve",
          "submissionIndex": 1,
          "actor": "你",
          "note": "前端审批中心已确认通过。",
          "createdAt": "2026-04-09 04:11"
        },
        {
          "id": "approval_f560aff4399a_approved",
          "type": "approved",
          "submissionIndex": 1,
          "actor": "你",
          "note": "前端审批中心已确认通过。",
          "createdAt": "2026-04-09 04:11"
        }
      ]
    },
    {
      "id": "task_5c296887a5cc",
      "title": "审查 ONES 自动化代码安全与异常处理",
      "owner": "斯内普",
      "ownerAgentId": "snape",
      "description": "审查 config.json 密钥暴露风险、API 调用兜底逻辑、幂等保护和边界 case。",
      "taskType": "audit",
      "priority": "high",
      "status": "draft",
      "budgetToken": 300,
      "spentToken": 0,
      "dueAt": "2026-04-20",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_25822bd3728f",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：审查 ONES 自动化代码安全与异常处理",
          "createdAt": "2026-04-09 03:56"
        }
      ]
    },
    {
      "id": "task_ce7ff56a4ae0",
      "title": "测试提报人视角的完整体验",
      "owner": "多比",
      "ownerAgentId": "dobby",
      "description": "模拟需求提报人，验证：审批通知是否清晰、退回理由是否易懂、ONES 链接是否可用。输出体验问题清单。",
      "taskType": "customer",
      "priority": "medium",
      "status": "draft",
      "budgetToken": 200,
      "spentToken": 0,
      "dueAt": "2026-04-22",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_48fbb390fd22",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：测试提报人视角的完整体验",
          "createdAt": "2026-04-09 03:56"
        }
      ]
    },
    {
      "id": "task_bd73d65c3f90",
      "title": "记录 ONES 项目 Token 消耗与 ROI",
      "owner": "珀西·韦斯莱",
      "ownerAgentId": "percy",
      "description": "跟踪本项目各部门 Token 消耗，项目结束后出具结算报告。",
      "taskType": "finance",
      "priority": "low",
      "status": "draft",
      "budgetToken": 100,
      "spentToken": 0,
      "dueAt": "2026-04-24",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_9bc4d495fa8f",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：记录 ONES 项目 Token 消耗与 ROI",
          "createdAt": "2026-04-09 03:56"
        }
      ]
    },
    {
      "id": "task_bc2df9d508ab",
      "title": "Ones自动化业务逻辑边界梳理与PRD定稿",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "对Ones现有手动环节进行全链路拆解，明确触发条件、状态流转规则与自动化节点边界，剔除冗余流程，与各部门对齐逻辑后输出无歧义PRD文档。交付物：PRD文档v1.0（含流程图、状态机、接口定义）。截止：今日17:00",
      "taskType": "product",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 800,
      "spentToken": 0,
      "dueAt": "2026-04-12",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_eaf3d7ea1369",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：Ones自动化业务逻辑边界梳理与PRD定稿",
          "createdAt": "2026-04-10 03:22"
        },
        {
          "id": "approval_b82b3274569e_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「Ones自动化业务逻辑边界梳理与PRD定稿」申请审批",
          "createdAt": "2026-04-10 03:22"
        }
      ]
    },
    {
      "id": "task_f6f4e5194746",
      "title": "Ones自动化核心模块开发与接口联调",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "基于麦格教授PRD文档完成技术方案设计、核心模块编码、第三方API联调，重点实现异常捕捉与重试机制，预设降级方案应对第三方接口不稳定风险。交付物：可测试版本（含API文档、异常处理方案、降级策略说明）。截止：周四",
      "taskType": "tech",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 1500,
      "spentToken": 0,
      "dueAt": "2026-04-13",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_f794643690b1",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：Ones自动化核心模块开发与接口联调",
          "createdAt": "2026-04-10 03:22"
        },
        {
          "id": "approval_df6db4f145b8_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「Ones自动化核心模块开发与接口联调」申请审批",
          "createdAt": "2026-04-10 03:22"
        }
      ]
    },
    {
      "id": "task_8c45f843e2ad",
      "title": "Ones自动化项目开发成本监控",
      "owner": "珀西·韦斯莱",
      "ownerAgentId": "percy",
      "description": "全程跟踪本次自动化项目的Token消耗、人力投入与资源占用，按日记录各部门成本明细，发现超支风险即时预警。交付物：项目成本日报（含累计消耗与预算剩余）",
      "taskType": "finance",
      "priority": "high",
      "status": "draft",
      "budgetToken": 300,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_a625f6704000",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：Ones自动化项目开发成本监控",
          "createdAt": "2026-04-10 03:22"
        }
      ]
    },
    {
      "id": "task_441e0ca05e71",
      "title": "MVP核心功能PRD文档输出",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "完成核心功能路径的原子化拆解，输出包含明确验收标准的最终版PRD文档，并与技术部完成可行性对齐。",
      "taskType": "product",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 800,
      "spentToken": 0,
      "dueAt": "2026-04-12",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_43be5df11399",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：MVP核心功能PRD文档输出",
          "createdAt": "2026-04-10 06:54"
        },
        {
          "id": "approval_6d41864d6a2b_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「MVP核心功能PRD文档输出」申请审批",
          "createdAt": "2026-04-10 06:54"
        }
      ]
    },
    {
      "id": "task_c9efe6f5ebec",
      "title": "MVP核心功能研发与压力测试",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "基于PRD进行模块化开发，部署核心链路，配置异常熔断机制，周五17:00前完成代码封版及压力测试。",
      "taskType": "tech",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 1500,
      "spentToken": 0,
      "dueAt": "2026-04-13",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_287d286f6dda",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：MVP核心功能研发与压力测试",
          "createdAt": "2026-04-10 06:54"
        },
        {
          "id": "approval_71a4069fd3fb_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「MVP核心功能研发与压力测试」申请审批",
          "createdAt": "2026-04-10 06:54"
        }
      ]
    },
    {
      "id": "task_16ed0f700917",
      "title": "项目成本核算与预算监控",
      "owner": "珀西·韦斯莱",
      "ownerAgentId": "percy",
      "description": "全程记录MVP研发过程中的资源消耗，确保各环节预算在授权范围内，并进行实时成本审计。",
      "taskType": "finance",
      "priority": "high",
      "status": "draft",
      "budgetToken": 300,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_e7cb1acf9086",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：项目成本核算与预算监控",
          "createdAt": "2026-04-10 06:54"
        }
      ]
    },
    {
      "id": "task_905f06f906db",
      "title": "研发过程质量与风险审计",
      "owner": "斯内普",
      "ownerAgentId": "snape",
      "description": "对PRD逻辑漏洞及代码稳定性进行全流程审计，确保第三方API异常兜底方案有效，并监控延期风险。",
      "taskType": "audit",
      "priority": "high",
      "status": "draft",
      "budgetToken": 500,
      "spentToken": 0,
      "dueAt": "2026-04-15",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_47e5c4f1d60b",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：研发过程质量与风险审计",
          "createdAt": "2026-04-10 06:54"
        }
      ]
    },
    {
      "id": "task_11772c559c74",
      "title": "核心路径用户体验与逻辑漏洞清单",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "梳理内测版本全流程，输出包含“必须修/建议修/可以忍”三级分类的漏洞清单，并与赫敏同步真实用户操作路径。",
      "taskType": "product",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 500,
      "spentToken": 0,
      "dueAt": "2026-04-12",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_54237c08371c",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：核心路径用户体验与逻辑漏洞清单",
          "createdAt": "2026-04-10 07:02"
        }
      ]
    },
    {
      "id": "task_52d5fca2e1f0",
      "title": "系统稳定性与高并发压力测试",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "完成内测环境压力测试方案，部署实时监控脚本，并提供埋点日志文档供产品部核对。",
      "taskType": "tech",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 800,
      "spentToken": 0,
      "dueAt": "2026-04-13",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_641a977669ba",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：系统稳定性与高并发压力测试",
          "createdAt": "2026-04-10 07:02"
        },
        {
          "id": "approval_4d34d7a39000_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「系统稳定性与高并发压力测试」申请审批",
          "createdAt": "2026-04-10 07:02"
        }
      ]
    },
    {
      "id": "task_5d5e65e4d7e5",
      "title": "内测算力成本核算与预算预留",
      "owner": "珀西·韦斯莱",
      "ownerAgentId": "percy",
      "description": "记录本次内测全流程算力消耗，并根据赫敏的扩容需求预留临时算力预算。",
      "taskType": "finance",
      "priority": "high",
      "status": "draft",
      "budgetToken": 300,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_251ccc1347f9",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：内测算力成本核算与预算预留",
          "createdAt": "2026-04-10 07:02"
        }
      ]
    },
    {
      "id": "task_6c084df4b416",
      "title": "代码质量与业务风险审计",
      "owner": "斯内普",
      "ownerAgentId": "snape",
      "description": "对赫敏的压力测试方案及麦格的逻辑漏洞清单进行合规性与风险审计，确保无重大安全隐患。",
      "taskType": "audit",
      "priority": "high",
      "status": "draft",
      "budgetToken": 400,
      "spentToken": 0,
      "dueAt": "2026-04-15",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_7727693f3398",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：代码质量与业务风险审计",
          "createdAt": "2026-04-10 07:02"
        }
      ]
    },
    {
      "id": "task_09e1f71c64bc",
      "title": "本季度核心业务目标确认与功能拆解",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "向CEO确认本季度3-5个核心业务目标，并据此产出包含用户故事、功能清单、验收标准及优先级排序的详细文档。",
      "taskType": "product",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 800,
      "spentToken": 0,
      "dueAt": "2026-04-12",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_3e80677a0b6c",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：本季度核心业务目标确认与功能拆解",
          "createdAt": "2026-04-10 07:45"
        },
        {
          "id": "approval_aee1e75e34e1_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「本季度核心业务目标确认与功能拆解」申请审批",
          "createdAt": "2026-04-10 07:45"
        }
      ]
    },
    {
      "id": "task_3c9692383ad7",
      "title": "核心模块技术架构与接口契约设计",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "基于产品功能清单进行架构预研，定义核心组件接口契约，并完成技术方案评审，确保系统扩展性与稳健性。",
      "taskType": "tech",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 1000,
      "spentToken": 0,
      "dueAt": "2026-04-13",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_99c6a019dc2a",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：核心模块技术架构与接口契约设计",
          "createdAt": "2026-04-10 07:45"
        },
        {
          "id": "approval_55cd148f9242_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「核心模块技术架构与接口契约设计」申请审批",
          "createdAt": "2026-04-10 07:45"
        }
      ]
    },
    {
      "id": "task_75091c741a03",
      "title": "跨部门协作与进度审计",
      "owner": "贾维斯",
      "ownerAgentId": "jarvis",
      "description": "协调产品与技术部门周二技术对齐会议，监督进度节点，并同步斯内普进行质量风险评估，珀西进行成本核算。",
      "taskType": "ops",
      "priority": "high",
      "status": "draft",
      "budgetToken": 500,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_bd8fea60f1d1",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：跨部门协作与进度审计",
          "createdAt": "2026-04-10 07:45"
        }
      ]
    },
    {
      "id": "task_eec08c0ca850",
      "title": "汇报模板标准化重构",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "设计并输出‘结论先行’的汇报模板，包含决策项、趋势数据、风险预警三层结构，并附带填写示例以规范各部门输出。",
      "taskType": "product",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 500,
      "spentToken": 0,
      "dueAt": "2026-04-13",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_299c5208cee7",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：汇报模板标准化重构",
          "createdAt": "2026-04-11 00:37"
        }
      ]
    },
    {
      "id": "task_60a4fa6ad9b2",
      "title": "自动化报表集成开发",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "开发数据聚合脚本，统一指标口径，将后台原始数据自动转译为结论性摘要，并与麦格教授的模板进行API对接。",
      "taskType": "tech",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 1000,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_ef48063c0a7f",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：自动化报表集成开发",
          "createdAt": "2026-04-11 00:37"
        },
        {
          "id": "approval_0914225b2c9e_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「自动化报表集成开发」申请审批",
          "createdAt": "2026-04-11 00:37"
        }
      ]
    },
    {
      "id": "task_49fa6c0419d7",
      "title": "客户痛点逻辑重构",
      "owner": "多比",
      "ownerAgentId": "dobby",
      "description": "梳理客户反馈，剔除原始记录，按‘影响范围、商业价值、改进建议’维度提炼核心痛点清单，并提交麦格教授验收。",
      "taskType": "customer",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 500,
      "spentToken": 0,
      "dueAt": "2026-04-15",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_74a3c99db197",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：客户痛点逻辑重构",
          "createdAt": "2026-04-11 00:37"
        }
      ]
    },
    {
      "id": "task_d5167d33b0aa",
      "title": "跨部门协作与进度审计",
      "owner": "贾维斯",
      "ownerAgentId": "jarvis",
      "description": "监督各部门执行进度，确保各环节输出符合‘30秒决策’标准，并由斯内普进行质量门禁审核。",
      "taskType": "ops",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 200,
      "spentToken": 0,
      "dueAt": "2026-04-16",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_decad25404b9",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：跨部门协作与进度审计",
          "createdAt": "2026-04-11 00:37"
        }
      ]
    },
    {
      "id": "task_949f5c626cf5",
      "title": "技术部全栈环境故障诊断与技能补全清单",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "完成基础能力（文件读写、API调用、命令执行）的可用性测试，输出《技术环境故障诊断报告》及《核心办公技能权限申请单》，明确缺失的系统调用权限与工具链接口。",
      "taskType": "tech",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 800,
      "spentToken": 0,
      "dueAt": "2026-04-13",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_608daadefb63",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：技术部全栈环境故障诊断与技能补全清单",
          "createdAt": "2026-04-11 00:53"
        },
        {
          "id": "approval_499ebc9afe1d_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「技术部全栈环境故障诊断与技能补全清单」申请审批",
          "createdAt": "2026-04-11 00:53"
        }
      ]
    },
    {
      "id": "task_ace4dfb6f201",
      "title": "技术部技能包验收标准制定与边界测试",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "基于业务流程拆解办公技能需求，制定验收标准（验收用例集），并对赫敏提交的技能包进行边界压力测试，确保其满足PRD交付要求。",
      "taskType": "product",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 600,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_38f397f78166",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：技术部技能包验收标准制定与边界测试",
          "createdAt": "2026-04-11 00:53"
        }
      ]
    },
    {
      "id": "task_1eb3d8553ea1",
      "title": "技术部权限变更审计与质量门禁",
      "owner": "斯内普",
      "ownerAgentId": "snape",
      "description": "对赫敏申请的权限进行合规性预审，确保权限下放符合公司安全策略，并在技能包交付后进行质量门禁检查。",
      "taskType": "audit",
      "priority": "high",
      "status": "draft",
      "budgetToken": 400,
      "spentToken": 0,
      "dueAt": "2026-04-15",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_b0c9f8c7507d",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：技术部权限变更审计与质量门禁",
          "createdAt": "2026-04-11 00:53"
        }
      ]
    },
    {
      "id": "task_44611bf057a4",
      "title": "技术故障根因排查与修复方案",
      "owner": "赫敏·格兰杰",
      "ownerAgentId": "hermione",
      "description": "定位系统故障模块（飞书/ONES/定时任务），输出详细故障日志分析、根因报告及修复执行方案。",
      "taskType": "tech",
      "priority": "urgent",
      "status": "pending_approval",
      "budgetToken": 800,
      "spentToken": 0,
      "dueAt": "2026-04-13",
      "requiresApproval": true,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_1d8718fa50a2",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：技术故障根因排查与修复方案",
          "createdAt": "2026-04-11 01:15"
        },
        {
          "id": "approval_c2a3dbbbedab_pending",
          "type": "approval_requested",
          "submissionIndex": 1,
          "actor": "你",
          "note": "为任务「技术故障根因排查与修复方案」申请审批",
          "createdAt": "2026-04-11 01:15"
        }
      ]
    },
    {
      "id": "task_a78dce2aba0c",
      "title": "开发队列优先级重排与资源冻结",
      "owner": "麦格教授",
      "ownerAgentId": "mcgonagall",
      "description": "梳理当前开发队列，冻结非紧急需求，确保赫敏的修复任务获得最高权重，并制定非核心功能暂停服务预案。",
      "taskType": "product",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 500,
      "spentToken": 0,
      "dueAt": "2026-04-14",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_407c7b401fa4",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：开发队列优先级重排与资源冻结",
          "createdAt": "2026-04-11 01:16"
        }
      ]
    },
    {
      "id": "task_472e225a667b",
      "title": "故障现场数据调取与跨部门协调",
      "owner": "贾维斯",
      "ownerAgentId": "jarvis",
      "description": "从审计风控部调取系统异常日志，同步给赫敏，并监督两点前的闭环进度。",
      "taskType": "ops",
      "priority": "urgent",
      "status": "draft",
      "budgetToken": 300,
      "spentToken": 0,
      "dueAt": "2026-04-15",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_c784862d0db7",
          "type": "created",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "首次提交任务：故障现场数据调取与跨部门协调",
          "createdAt": "2026-04-11 01:16"
        }
      ]
    },
    {
      "id": "commercial_evidence_local_loop_001",
      "title": "Local commercial readiness evidence loop",
      "owner": "弗雷德·韦斯莱",
      "ownerAgentId": "fred",
      "description": "Local evidence row for task -> execution -> delivery -> revenue -> token ledger. This is not a real customer payment.",
      "taskType": "sales",
      "priority": "high",
      "status": "completed",
      "budgetToken": 500,
      "spentToken": 320,
      "dueAt": "",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_992a4c85c843",
          "type": "complete",
          "submissionIndex": 1,
          "actor": "弗雷德·韦斯莱",
          "note": "complete",
          "createdAt": "2026-04-28 12:00"
        }
      ]
    },
    {
      "id": "task_179fc22cb6dc",
      "title": "M1商业闭环：7天内拿到1个999元启航版订单",
      "owner": "贾维斯",
      "ownerAgentId": "jarvis",
      "description": "CEO指令：Jarvis统筹一人公司跑通最小盈利闭环。目标：发布可售服务包与付款入口，生成销售话术，筛选首批线索，人工确认后触达，拿到1个999元启航版订单。约束：不得伪造成交，不得自动群发；所有对外发送需要CEO确认。",
      "taskType": "ops",
      "priority": "urgent",
      "status": "completed",
      "budgetToken": 800,
      "spentToken": 800,
      "dueAt": "",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": [
        {
          "id": "log_8b4dd46aba29",
          "type": "created",
          "submissionIndex": 1,
          "actor": "你",
          "note": "首次提交任务：M1商业闭环：7天内拿到1个999元启航版订单",
          "createdAt": "2026-04-28 12:51"
        },
        {
          "id": "log_7d9d65414e2d",
          "type": "start",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "start",
          "createdAt": "2026-04-28 12:51"
        },
        {
          "id": "log_14b737d1f842",
          "type": "complete",
          "submissionIndex": 1,
          "actor": "贾维斯",
          "note": "complete",
          "createdAt": "2026-04-28 12:51"
        }
      ]
    },
    {
      "id": "self_operating_task_20260428",
      "title": "自营经营循环：先让一人公司自己跑起来",
      "owner": "贾维斯",
      "ownerAgentId": "jarvis",
      "description": "每天让Jarvis组织增长、销售、财务、客户成功形成自营获客和收款闭环；不得伪造成交，不得自动群发，真实收入只在到账后登记。",
      "taskType": "ops",
      "priority": "urgent",
      "status": "completed",
      "budgetToken": 600,
      "spentToken": 600,
      "dueAt": "",
      "requiresApproval": false,
      "resubmissionCount": 0,
      "latestRejectionNote": "",
      "latestRejectionAt": "",
      "timeline": []
    }
  ],
  "approvals": [
    {
      "id": "approval_9ccb9c362a96",
      "requester": "贾维斯",
      "targetId": "task_7c6201db2a94",
      "targetTitle": "实现自动定时扫描待审批需求",
      "amount": 600,
      "reason": "为任务「实现自动定时扫描待审批需求」申请审批",
      "status": "approved",
      "createdAt": "2026-04-09 03:56",
      "resubmissionCount": 0,
      "latestDecisionNote": "前端审批中心已确认通过。",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_f560aff4399a",
      "requester": "贾维斯",
      "targetId": "task_8c8c418526ed",
      "targetTitle": "实现 link_pending 自动回填与失败重试",
      "amount": 500,
      "reason": "为任务「实现 link_pending 自动回填与失败重试」申请审批",
      "status": "approved",
      "createdAt": "2026-04-09 03:56",
      "resubmissionCount": 0,
      "latestDecisionNote": "前端审批中心已确认通过。",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_b82b3274569e",
      "requester": "贾维斯",
      "targetId": "task_bc2df9d508ab",
      "targetTitle": "Ones自动化业务逻辑边界梳理与PRD定稿",
      "amount": 800,
      "reason": "为任务「Ones自动化业务逻辑边界梳理与PRD定稿」申请审批",
      "status": "pending",
      "createdAt": "2026-04-10 03:22",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_df6db4f145b8",
      "requester": "贾维斯",
      "targetId": "task_f6f4e5194746",
      "targetTitle": "Ones自动化核心模块开发与接口联调",
      "amount": 1500,
      "reason": "为任务「Ones自动化核心模块开发与接口联调」申请审批",
      "status": "pending",
      "createdAt": "2026-04-10 03:22",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_6d41864d6a2b",
      "requester": "贾维斯",
      "targetId": "task_441e0ca05e71",
      "targetTitle": "MVP核心功能PRD文档输出",
      "amount": 800,
      "reason": "为任务「MVP核心功能PRD文档输出」申请审批",
      "status": "pending",
      "createdAt": "2026-04-10 06:54",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_71a4069fd3fb",
      "requester": "贾维斯",
      "targetId": "task_c9efe6f5ebec",
      "targetTitle": "MVP核心功能研发与压力测试",
      "amount": 1500,
      "reason": "为任务「MVP核心功能研发与压力测试」申请审批",
      "status": "pending",
      "createdAt": "2026-04-10 06:54",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_4d34d7a39000",
      "requester": "贾维斯",
      "targetId": "task_52d5fca2e1f0",
      "targetTitle": "系统稳定性与高并发压力测试",
      "amount": 800,
      "reason": "为任务「系统稳定性与高并发压力测试」申请审批",
      "status": "pending",
      "createdAt": "2026-04-10 07:02",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_aee1e75e34e1",
      "requester": "贾维斯",
      "targetId": "task_09e1f71c64bc",
      "targetTitle": "本季度核心业务目标确认与功能拆解",
      "amount": 800,
      "reason": "为任务「本季度核心业务目标确认与功能拆解」申请审批",
      "status": "pending",
      "createdAt": "2026-04-10 07:45",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_55cd148f9242",
      "requester": "贾维斯",
      "targetId": "task_3c9692383ad7",
      "targetTitle": "核心模块技术架构与接口契约设计",
      "amount": 1000,
      "reason": "为任务「核心模块技术架构与接口契约设计」申请审批",
      "status": "pending",
      "createdAt": "2026-04-10 07:45",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_0914225b2c9e",
      "requester": "贾维斯",
      "targetId": "task_60a4fa6ad9b2",
      "targetTitle": "自动化报表集成开发",
      "amount": 1000,
      "reason": "为任务「自动化报表集成开发」申请审批",
      "status": "pending",
      "createdAt": "2026-04-11 00:37",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_499ebc9afe1d",
      "requester": "贾维斯",
      "targetId": "task_949f5c626cf5",
      "targetTitle": "技术部全栈环境故障诊断与技能补全清单",
      "amount": 800,
      "reason": "为任务「技术部全栈环境故障诊断与技能补全清单」申请审批",
      "status": "pending",
      "createdAt": "2026-04-11 00:53",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    },
    {
      "id": "approval_c2a3dbbbedab",
      "requester": "贾维斯",
      "targetId": "task_44611bf057a4",
      "targetTitle": "技术故障根因排查与修复方案",
      "amount": 800,
      "reason": "为任务「技术故障根因排查与修复方案」申请审批",
      "status": "pending",
      "createdAt": "2026-04-11 01:15",
      "resubmissionCount": 0,
      "latestDecisionNote": "",
      "latestRejectionNote": ""
    }
  ],
  "ledger": [
    {
      "id": "ledger_7c6cdf2164dd",
      "type": "reward",
      "actor": "fred",
      "amount": 25,
      "note": "local evidence revenue reward",
      "createdAt": "2026-04-28 12:00"
    },
    {
      "id": "ledger_80ebe89ffae5",
      "type": "revenue_mapping",
      "actor": "treasury main",
      "amount": 75,
      "note": "local evidence treasury share",
      "createdAt": "2026-04-28 12:00"
    },
    {
      "id": "ledger_0ea9dab9d4a9",
      "type": "budget",
      "actor": "task cost",
      "amount": -800,
      "note": "任务完成结算：M1商业闭环：7天内拿到1个999元启航版订单",
      "createdAt": "2026-04-28 12:51"
    }
  ],
  "revenues": [
    {
      "id": "commercial_evidence_revenue_001",
      "title": "Local evidence revenue entry",
      "businessLine": "AI Automation",
      "sourceTask": "Local commercial readiness evidence loop",
      "amount": 1,
      "tokenMapped": 100,
      "roi": 1
    }
  ],
  "auditEvents": [],
  "storeItems": [
    {
      "id": "store_model_pack",
      "name": "高级模型额度包",
      "itemType": "model_pack",
      "priceToken": 800,
      "description": "用于高质量目标拆解、审批建议和日报生成。",
      "stockMode": "infinite",
      "stockCount": null,
      "enabled": true
    },
    {
      "id": "store_search_pack",
      "name": "深度搜索包",
      "itemType": "search_pack",
      "priceToken": 300,
      "description": "用于调研竞品、客户和市场情报。",
      "stockMode": "infinite",
      "stockCount": null,
      "enabled": true
    },
    {
      "id": "store_image_pack",
      "name": "视觉设计资源包",
      "itemType": "image_pack",
      "priceToken": 500,
      "description": "用于海报、封面和品牌物料生成。",
      "stockMode": "limited",
      "stockCount": 20,
      "enabled": true
    },
    {
      "id": "store_api_pack",
      "name": "自动化 API 调用包",
      "itemType": "api_pack",
      "priceToken": 1200,
      "description": "用于流程自动化、抓取与执行接口调用。",
      "stockMode": "limited",
      "stockCount": 10,
      "enabled": true
    },
    {
      "id": "store_priority_pass",
      "name": "任务优先执行卡",
      "itemType": "priority_pass",
      "priceToken": 150,
      "description": "可为高优任务获取更高执行优先级。",
      "stockMode": "infinite",
      "stockCount": null,
      "enabled": true
    }
  ],
  "storeOrders": [],
  "treasury": {
    "totalBalance": 200100,
    "reservedBalance": 8600,
    "availableBalance": 191475
  },
  "performanceSummary": {
    "reviewDate": "2026-04-23T07:10:07.134Z",
    "totalAgents": 9,
    "avgScore": 72.5,
    "gradeDistribution": {
      "S": 0,
      "A": 3,
      "B": 6,
      "C": 0,
      "D": 0
    },
    "topPerformer": "neville",
    "needsAttention": []
  }
}
