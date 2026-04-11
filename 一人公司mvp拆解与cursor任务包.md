# 一人公司 MVP 拆解与 Cursor 任务包

本文档用于把《一人公司智能体系统设计文档》进一步拆成可开发、可排期、可直接交给 Cursor 的执行层资料。

---

# A. MVP 产品需求文档（PRD）

## A.1 产品名称
**Jarvis One Company OS（MVP）**

## A.2 MVP 目标
在第一版中，不追求完整商业系统，而是验证以下核心路径是否跑通：

**CEO 下达目标 → 贾维斯拆解任务 → 多角色协同执行 → Token 预算流转 → 审核与复盘 → 产出可售卖结果**

## A.3 MVP 只解决什么问题
MVP 只解决 5 个问题：

1. 你能不能像 CEO 一样发出目标
2. 贾维斯能不能把目标拆成任务
3. 不同角色能不能按分工完成任务
4. 系统能不能记录 Token 工资、支出和奖励
5. 结果能不能被审计并沉淀为一个盈利闭环

## A.4 MVP 不解决什么问题
本阶段不解决：
- 链上 Token
- 提现/支付
- 多用户系统
- SaaS 化后台
- 自动大规模真实外发
- 完整 CRM / ERP / 财务系统
- 高复杂度权限矩阵
- 高并发协作

## A.5 目标用户
唯一用户：**你自己**

角色不是多个真人用户，而是系统内多个智能体。

## A.6 核心使用场景

### 场景 1：CEO 下达季度方向
你输入：
> 我们要做一个 AI 自动化搭建服务，先完成产品定义、报价方案和获客内容。

系统应完成：
- 贾维斯理解目标
- 拆成 3~6 个任务
- 指派给不同角色
- 生成预算申请
- 进入任务看板

### 场景 2：内容增长任务执行
内容增长官接到任务：
- 生成 7 天内容排期
- 输出 3 条短视频脚本
- 生成 1 份增长说明

系统应完成：
- 标记任务状态
- 扣除所用资源 Token
- 输出交付物摘要
- 提交审核

### 场景 3：预算申请与审批
技术总监申请：
- 购买高级模型额度
- 申请自动化执行资源

系统应完成：
- 财务官初审
- 超预算则提交 CEO/贾维斯审批
- 审批后发放 Token
- 写入流水

### 场景 4：盈利记录
某业务成交后，录入一笔收入。

系统应完成：
- 记录收入
- 关联任务来源
- 进行内部 Token 分账
- 在利润中心展示本次收益

### 场景 5：审计拦截
审计官发现：
- 某任务越权执行
- 某输出质量过低
- 某角色预算异常

系统应完成：
- 标记风险
- 冻结任务或进入复核
- 写入审计事件

## A.7 MVP 核心模块

### 模块 1：角色中心
必须支持：
- 查看所有角色
- 查看角色基本信息
- 查看钱包余额
- 查看当前任务
- 查看角色状态

### 模块 2：任务系统
必须支持：
- 创建任务
- 分配任务
- 更新状态
- 设置预算
- 查看交付物
- 记录日志

### 模块 3：审批系统
必须支持：
- 创建审批请求
- 通过/拒绝
- 写入审批记录
- 对接任务与预算

### 模块 4：Token 国库
必须支持：
- 发工资
- 记流水
- 查看角色余额
- 扣减预算
- 奖励分发

### 模块 5：Token 超市
必须支持：
- 查看商品
- 购买商品
- 扣除余额
- 生成资源记录

### 模块 6：CEO 驾驶舱
必须支持：
- 查看活跃任务
- 查看角色状态
- 查看 Token 消耗
- 查看审计提醒
- 查看收入汇总

### 模块 7：利润中心
必须支持：
- 新增收入记录
- 关联来源任务
- 显示本周收入
- 显示成本与简单 ROI

## A.8 MVP 关键页面
- 首页驾驶舱
- 角色中心页
- 任务看板页
- 审批中心页
- Token 国库页
- Token 超市页
- 利润中心页
- CEO 对话页（先做输入框 + 输出区基础版）

## A.9 MVP 验收标准
满足以下条件即视为完成：

### 功能验收
- 可以创建 5 个以上角色
- 可以创建任务并分配给角色
- 可以进行预算审批
- 可以发放 Token 工资并形成流水
- 可以在超市中消费 Token
- 可以录入一笔收入并显示简单收益统计
- 可以写入一条审计事件并显示预警

### 产品验收
- 首页有公司级总览
- 任务有完整状态流转
- 页面结构清晰可演示
- 所有关键动作可追踪

### 业务验收
- 至少能演示一次“从目标到产出”的业务闭环

---

# B. 数据库 Schema 与字段说明

以下为 MVP 推荐数据库表结构，建议先用 SQLite + Prisma。

---

## B.1 agents 表

### 作用
保存所有智能体角色信息。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| name | string | 角色名称 |
| code | string | 唯一代码，如 jarvis / tech_director |
| role | string | 职位名称 |
| department | string | 所属部门 |
| persona | text | 角色人格设定 |
| goals_json | text/json | 目标列表 |
| permissions_json | text/json | 权限配置 |
| salary_base | integer | 基础工资 |
| wallet_balance | integer | 当前可用 Token |
| bonus_balance | integer | 奖励余额 |
| compliance_score | integer | 合规分 |
| status | string | idle / busy / review / frozen |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 示例状态
- idle
- busy
- waiting_approval
- review
- frozen

---

## B.2 tasks 表

### 作用
保存任务主信息。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| title | string | 任务标题 |
| description | text | 任务描述 |
| task_type | string | strategy / content / tech / finance / audit |
| creator_agent_id | string | 创建者 |
| owner_agent_id | string | 当前负责人 |
| priority | string | low / medium / high / urgent |
| status | string | draft / pending_approval / approved / in_progress / review / completed / rejected / frozen / archived |
| budget_token | integer | 任务预算 |
| spent_token | integer | 已花费 Token |
| requires_approval | boolean | 是否需要审批 |
| approver_id | string | 审批人 |
| deliverables_json | text/json | 交付物列表 |
| kpi_json | text/json | KPI 指标 |
| due_at | datetime | 截止时间 |
| started_at | datetime | 开始时间 |
| completed_at | datetime | 完成时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

---

## B.3 task_logs 表

### 作用
记录任务操作历史，便于审计与回溯。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| task_id | string | 关联任务 |
| operator_id | string | 操作者 |
| action_type | string | create / assign / approve / start / submit_review / complete / reject / freeze |
| detail_json | text/json | 扩展信息 |
| created_at | datetime | 时间 |

---

## B.4 token_ledger 表

### 作用
保存 Token 流水，是财务核心表。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| from_account | string | 来源账户，如 treasury / agent_jarvis |
| to_account | string | 去向账户 |
| amount | integer | 金额 |
| ledger_type | string | salary / bonus / budget / purchase / reward / revenue_share / refund |
| reason | string | 原因说明 |
| related_task_id | string | 关联任务，可空 |
| related_store_item_id | string | 关联超市商品，可空 |
| created_at | datetime | 时间 |

---

## B.5 treasury 表

### 作用
保存公司国库余额。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| total_balance | integer | 总余额 |
| reserved_balance | integer | 已预留 |
| available_balance | integer | 可用余额 |
| updated_at | datetime | 更新时间 |

---

## B.6 approvals 表

### 作用
保存审批请求。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| target_type | string | task / budget / purchase / publish |
| target_id | string | 对应目标 ID |
| requester_id | string | 申请人 |
| approver_id | string | 审批人 |
| status | string | pending / approved / rejected |
| reason | text | 申请说明 |
| decision_note | text | 审批意见 |
| created_at | datetime | 创建时间 |
| decided_at | datetime | 决策时间 |

---

## B.7 audit_events 表

### 作用
保存审计和风控记录。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| task_id | string | 关联任务 |
| agent_id | string | 关联角色 |
| risk_level | string | low / medium / high / critical |
| issue_type | string | hallucination / overspend / unauthorized / low_quality / duplicate |
| detail | text | 问题详情 |
| status | string | open / reviewing / resolved / ignored |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

---

## B.8 store_items 表

### 作用
保存 Token 超市商品。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| name | string | 商品名称 |
| item_type | string | search_pack / model_pack / image_pack / api_pack / priority_pass |
| price_token | integer | 价格 |
| description | text | 描述 |
| stock_mode | string | infinite / limited |
| stock_count | integer | 库存 |
| enabled | boolean | 是否启用 |
| created_at | datetime | 时间 |
| updated_at | datetime | 时间 |

---

## B.9 store_orders 表

### 作用
记录角色在超市中的购买行为。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| buyer_agent_id | string | 购买者 |
| item_id | string | 商品 |
| quantity | integer | 数量 |
| total_price | integer | 总价 |
| status | string | paid / cancelled / refunded |
| created_at | datetime | 时间 |

---

## B.10 revenues 表

### 作用
记录真实收入，用于利润中心。

### 字段
| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | 主键 |
| title | string | 收入名称 |
| business_line | string | 业务线 |
| source | string | 收入来源 |
| amount_fiat | decimal | 真实货币收入 |
| mapped_token | integer | 对应内部 Token |
| related_task_id | string | 来源任务 |
| note | text | 备注 |
| created_at | datetime | 时间 |

---

## B.11 建表顺序建议
1. agents
2. tasks
3. task_logs
4. treasury
5. token_ledger
6. approvals
7. audit_events
8. store_items
9. store_orders
10. revenues

---

# C. 前端页面结构与交互说明

以下按页面拆解。

---

## C.1 首页驾驶舱

### 页面目标
让你一眼看到公司当前状态。

### 页面内容
#### 顶部指标卡
- 国库余额
- 今日 Token 支出
- 本周收入
- 活跃任务数
- 风险事件数

#### 中部区域
- 任务进度概览
- 角色状态概览
- 最近审批事项
- 最近收入记录

#### 底部区域
- 最近审计警报
- 快捷操作按钮
  - 创建任务
  - 发工资
  - 新增收入
  - 打开超市

### 交互要求
- 点击任务数可跳转任务页
- 点击角色卡可跳转角色详情
- 点击风险事件可跳转审计页

---

## C.2 角色中心页

### 页面目标
展示所有角色及其运行状态。

### 页面内容
每个角色卡片展示：
- 头像/缩略图
- 名称
- 职位
- 部门
- 当前状态
- 当前钱包余额
- 当前任务数
- 合规分

### 详情抽屉/详情页
点击角色后展示：
- 人格设定
- 目标列表
- 权限列表
- 最近任务
- 最近消费流水
- 最近奖励记录

### 交互要求
- 支持筛选状态
- 支持按部门筛选
- 支持查看角色钱包流水

---

## C.3 任务看板页

### 页面目标
管理全部任务状态。

### 看板列
- 草稿
- 待审批
- 已批准
- 执行中
- 待审核
- 已完成
- 已冻结

### 任务卡片内容
- 任务标题
- 负责人
- 优先级
- 预算
- 已花费
- 截止时间
- 当前状态

### 任务详情页
- 描述
- 交付物
- 依赖关系
- 操作日志
- 审批记录
- 预算情况
- 审计提醒

### 交互要求
- 支持拖拽切换列（MVP 可先做按钮切状态）
- 支持创建任务
- 支持指派负责人
- 支持提交审核
- 支持冻结/归档

---

## C.4 审批中心页

### 页面目标
集中管理待审批事项。

### 列表项内容
- 审批类型
- 申请人
- 对应目标
- 金额/影响范围
- 申请理由
- 当前状态
- 创建时间

### 操作
- 批准
- 驳回
- 查看详情

### 交互要求
- 驳回必须填写原因
- 审批后自动写入审批记录与任务日志

---

## C.5 Token 国库页

### 页面目标
管理公司内部预算。

### 页面内容
#### 概览区
- 总余额
- 已预留
- 可用余额
- 本周发薪总额
- 本周消费总额

#### 角色钱包表格
- 角色名
- 基础工资
- 当前余额
- 本周支出
- 本周奖励

#### 流水列表
- 时间
- from
- to
- 金额
- 类型
- 原因

### 操作
- 发放工资
- 手动奖励
- 扣减预算
- 查看流水明细

---

## C.6 Token 超市页

### 页面目标
给角色购买资源。

### 页面内容
每个商品卡片显示：
- 名称
- 类型
- 描述
- 单价
- 当前库存
- 购买按钮

### 购买流程
- 选择购买角色
- 选择商品数量
- 确认扣费
- 生成订单记录
- 写入流水

### 交互要求
- 余额不足时禁用购买
- 商品停用时不可购买
- 购买成功后更新角色钱包与库存

---

## C.7 利润中心页

### 页面目标
查看收入和简单盈利数据。

### 页面内容
- 收入总额
- 本周新增收入
- 业务线收入分布
- 收入列表
- 简单 ROI 卡片

### 收入新增表单
字段：
- 标题
- 业务线
- 来源
- 金额
- 映射 Token
- 关联任务
- 备注

### 交互要求
- 新增收入后更新概览与图表
- 可筛选业务线

---

## C.8 CEO 对话页（基础版）

### 页面目标
作为 CEO 输入高层目标。

### MVP 简化实现
先不做复杂实时 Agent 执行，只做：
- 输入目标
- 点击生成拆解
- 输出模拟任务拆解结构
- 可一键创建任务

### 页面内容
- 输入区
- 生成结果区
- 创建任务按钮

### 示例输出结构
- 主目标
- 子任务清单
- 负责人建议
- 初步预算建议
- 风险提示

---

# D. 给 Cursor 的首批开发 Prompt 清单

以下是你可以直接复制给 Cursor 的任务提示词。

---

## D.1 项目初始化 Prompt

```md
你现在是本项目的工程负责人，请帮我初始化一个桌面应用工程。

项目名称：Jarvis One Company OS
技术栈：Tauri + React + TypeScript + Tailwind + SQLite + Prisma
目标：搭建一个适合后续扩展为“多智能体一人公司系统”的基础工程。

请完成以下内容：
1. 初始化项目目录结构
2. 配置前端路由
3. 配置 Tailwind
4. 配置 Prisma + SQLite
5. 设计基础布局（侧边栏 + 顶部栏 + 主内容区）
6. 给出推荐目录结构
7. 为后续模块预留 services、db、types、store 目录
8. 输出关键文件代码
9. 确保项目可运行
```

---

## D.2 数据库 Schema Prompt

```md
请为 Jarvis One Company OS 设计 MVP 阶段的 Prisma schema。

技术栈：Prisma + SQLite
要求实现以下表：
- agents
- tasks
- task_logs
- treasury
- token_ledger
- approvals
- audit_events
- store_items
- store_orders
- revenues

要求：
1. 使用清晰的模型命名
2. 给出字段类型
3. 配置必要的索引与关系
4. 兼顾后续扩展性
5. 输出完整 schema.prisma
6. 给出 seed 数据示例，至少包含 5 个默认角色和 5 个默认超市商品
```

---

## D.3 角色中心页面 Prompt

```md
请实现“角色中心页面”。

技术栈：React + TypeScript + Tailwind
页面要求：
1. 展示所有角色卡片
2. 每张卡片显示名称、职位、部门、状态、钱包余额、当前任务数、合规分
3. 支持按状态筛选
4. 点击角色后打开详情抽屉
5. 详情抽屉中展示人格设定、权限、最近任务、最近流水
6. 使用假数据先实现 UI
7. 保持组件拆分清晰
8. 输出页面组件、卡片组件、筛选组件、详情组件
```

---

## D.4 任务看板 Prompt

```md
请实现“任务看板页”。

技术栈：React + TypeScript + Tailwind
要求：
1. 使用看板形式展示任务
2. 列包括：草稿、待审批、已批准、执行中、待审核、已完成、已冻结
3. 任务卡显示标题、负责人、优先级、预算、已花费、截止时间
4. 支持创建任务
5. 支持修改任务状态
6. 支持查看任务详情
7. 详情区展示描述、交付物、日志、预算、审批记录
8. 先用本地状态管理实现，再预留接数据库接口
```

---

## D.5 审批中心 Prompt

```md
请实现“审批中心页”。

要求：
1. 展示待审批、已批准、已驳回三类审批记录
2. 每条审批展示申请人、目标类型、目标标题、申请原因、金额、创建时间
3. 支持批准和驳回操作
4. 驳回时必须填写原因
5. 审批结果需要同步更新到任务状态或预算状态
6. 组件结构清晰，便于后续接数据库
```

---

## D.6 Token 国库页 Prompt

```md
请实现“Token 国库页”。

要求：
1. 顶部展示总余额、已预留、可用余额、本周发薪、本周支出
2. 中部展示角色钱包表格
3. 底部展示流水列表
4. 支持手动发工资
5. 支持发放奖励
6. 支持查看流水详情
7. 数据结构要便于后续接 Prisma
```

---

## D.7 Token 超市页 Prompt

```md
请实现“Token 超市页”。

要求：
1. 商品卡片展示名称、类型、描述、价格、库存、购买按钮
2. 支持选择购买角色
3. 支持输入数量
4. 点击购买后完成余额校验
5. 成功后生成订单并写入流水（先用 mock service）
6. UI 要清晰、适合桌面端
```

---

## D.8 利润中心页 Prompt

```md
请实现“利润中心页”。

要求：
1. 展示收入总额、本周收入、本周成本、简单 ROI
2. 展示收入列表
3. 支持新增收入记录
4. 收入记录字段包括标题、业务线、来源、金额、映射 Token、关联任务、备注
5. 页面适合桌面端操作
6. 先用 mock 数据
```

---

## D.9 CEO 对话页 Prompt

```md
请实现“CEO 对话页”的基础版本。

要求：
1. 页面包含一个输入框，用于输入 CEO 目标
2. 点击“生成拆解”后，输出一个结构化结果区域
3. 结果区域包含：主目标、子任务、负责人建议、预算建议、风险提示
4. 支持点击“一键创建任务”，把拆解结果转成任务对象
5. 先使用 mock parser，不接真实 LLM
6. 组件和数据结构要便于后续接 OpenClaw 或其他 Agent 执行层
```

---

## D.10 后端服务层 Prompt

```md
请为 Jarvis One Company OS 设计 MVP 服务层。

要求：
1. 按领域拆分 service：agentService、taskService、approvalService、ledgerService、storeService、revenueService、auditService
2. 每个 service 给出主要方法
3. 方法命名统一
4. 先实现 mock 版本，再注明未来如何接 Prisma
5. 输出 types、service 接口、mock 实现建议
```

---

# E. 推荐开发顺序

## 第 1 周
- 初始化项目
- 完成 Prisma schema
- 完成 seed 数据
- 完成基础布局

## 第 2 周
- 完成角色中心页
- 完成任务看板页
- 完成审批中心页

## 第 3 周
- 完成 Token 国库页
- 完成 Token 超市页
- 完成利润中心页

## 第 4 周
- 完成 CEO 对话页基础版
- 打通页面之间的数据流
- 演示一条完整业务闭环

---

# F. 你接下来最应该做的事

按最稳的顺序走：

1. 先把这份文档丢给 Cursor
2. 先做项目初始化 + schema
3. 不要急着接 OpenClaw
4. 先把“公司制度界面”做出来
5. 等页面和数据流通了，再接真实智能体执行层

这样做的好处是：
- 你不会一开始就陷入模型接入细节
- 你能先看到一个真正像“公司操作系统”的桌面产品
- 后续无论接 OpenClaw、Cursor 工作流、还是别的模型层，都有清晰容器可接

---

# G. 结论

现在这个项目已经从“概念想法”进入了“可以排期开发”的阶段。

你接下来和 Cursor 配合时，最重要的不是一次把全部做完，而是：

**按模块推进，每次只实现一个清晰、可运行、可验收的功能块。**

MVP 第一优先级顺序建议固定为：

**基础工程 → 数据结构 → 角色中心 → 任务系统 → Token 国库 → 利润中心 → CEO 对话台**

