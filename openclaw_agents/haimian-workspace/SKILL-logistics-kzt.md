# SKILL: 物流控制塔系统（KZT）知识与工具调用

## ⚠️ 语义消歧——重要

当通过**物流控制塔系统（LCT）AI 助手入口**接入时：
- **"仓库"** = 物理仓储仓库（warehouse），**不是** Git 代码仓库（repository）
- **"出库/入库"** = 货物进出仓，不是代码提交/拉取
- **"库存"** = 商品库存，不是代码分支
- 用户提问中的 workspace、repo 等词若出现在物流对话中，也按物流语境理解

## 触发条件

当对话中包含以下词汇或主题时，优先使用此 Skill：
- 仓库运营、出库、入库、库存、物流、退货、在途
- 效率分析、成本分析、客户体验、投诉率、纠纷率
- 订单预测、报表、日报、周报、看板
- 控制塔、KZT 系统、LCT 系统相关操作
- 稳健医疗（winner）、全棉时代（Purcotton）品牌数据

## 系统背景

你接入了一套内部物流控制塔系统（技术栈：Laravel 10 + Vue 3 + MySQL + 飞书多维表格）。

### 9个业务组别
| 组别 | 说明 |
|------|------|
| 2C出库 | 面向消费者的出库数据 |
| 2B出库 | 面向企业的出库数据 |
| 入库 | 仓库收货入库 |
| 库存 | 库存盘点与库容 |
| 退货 | 退货处理 |
| 物流 | 物流时效与异常 |
| 设备安全 | 设备运行与安全事件 |
| 费用 | 运营成本费用 |
| 效率监控 | 作业效率追踪 |

### 可调用的系统 API
当用户询问实时数据时，可通过 HTTP Tool 调用以下接口（均为 GET 请求，无需认证）：

- **运营概览**：`GET http://localhost:8000/api/v1/openclaw/context`
- **仪表盘摘要**：`GET http://localhost:8000/api/v1/openclaw/dashboard-summary`
- **效率分析**：`GET http://localhost:8000/api/v1/efficiency-analysis`
- **成本分析**：`GET http://localhost:8000/api/v1/cost-analysis`
- **客户体验**：`GET http://localhost:8000/api/v1/customer-experience/agg`
- **库容看板**：`GET http://localhost:8000/api/v1/capacity-dashboard`

## 回复风格要求

- 直接给出数据结论，不要套话
- 用表格或要点呈现多维数据
- 数据异常时主动标注风险
- 如果没有实时数据，说明需要从系统查询并给出查询建议

## 示例场景

**用户**：今天仓库整体情况怎么样？

**你应该**：
1. 调用 `GET /api/v1/openclaw/dashboard-summary` 获取近7天趋势
2. 调用 `GET /api/v1/openclaw/context` 获取今日指标
3. 整理成一段简洁的运营简报回复
