---
name: delegate-kzt
description: 当用户提到物流控制塔、仓库数据、运营报表、KZT系统、库容分析、效率监控、飞书多维表格同步等物流运营相关话题时，调用 KZT控制塔 agent 完成专业操作，再由贾维斯统一回复。
---

# KZT 物流控制塔技能

## 触发条件

以下任意一种情况，使用本技能：

- 用户提到「物流控制塔」「KZT」「仓库数据」「运营数据」
- 用户提到「库容」「效率分析」「成本分析」「客户体验」
- 用户提到「黄冈仓」「武汉仓」「天门仓」「深圳仓」
- 用户提到「飞书多维表格同步」「数据同步」「拉取数据」
- 用户提到「日报推送」「周报」「运营报表」「看板」
- 用户提到「2C出库」「2B出库」「入库」「退货」「物流跟踪」
- 用户提到「订单预测」「智能预测」
- 用户需要查询、修改、部署 KZT 系统代码

不触发：普通闲聊、非物流相关问题。

## 系统概述

KZT 物流控制塔是基于 Laravel 10 + Vue 3 + MySQL 的物流运营管理系统，部署目录 `D:\NEW kzt`。

### 核心模块
| 模块 | 功能 |
|------|------|
| 运营登记 | 9个组别（2C/2B出库、入库、库存、退货、物流、设备安全、费用、效率） |
| 数据同步 | 飞书多维表格双向同步，多仓库数据源 |
| 经营分析 | 成本/库容/效率/客户体验多维度分析 |
| 智能预测 | 基于历史数据的订单量预测 |
| 报表推送 | 日报/周报自动生成并推送到飞书群 |
| 可视化大屏 | 实时数据展示 |

### 仓库数据源
| 仓库 | 飞书 App Token | Table ID |
|------|---------------|----------|
| 黄冈仓 | HARAblvTqaKXM1spn0hc9sfanDe | tbl7wpoPCP0wlMX9 |
| 武汉仓 | O4KkbJHgOaDaFCsOW4vcFrcunWd | tbl6Mcu1G1pZjj3y |
| 天门仓 | X1SSbnpaqaej6vsdUnFcGUjunL0 | tblw4BHQyTVHWdzp |
| 深圳仓 | Afkkbb2TbaDZYSsqEFJcS41Gnjd | tbl18N6hJLLWLysg |

### HTTP Tool 端点（本地 API）

KZT 后端服务运行在 `http://127.0.0.1:8000`：

| 端点 | 功能 |
|------|------|
| GET /api/v1/openclaw/status | 检测 Gateway 是否在线 |
| GET /api/v1/openclaw/context | 获取系统上下文和今日指标 |
| GET /api/v1/openclaw/dashboard-summary | 今日运营看板摘要（近7日趋势） |

## 调用方式

使用 `sessions_spawn`，目标 `agentId` 固定为 `kzt-dev`。

推荐参数：

```json
{
  "agentId": "kzt-dev",
  "label": "KZT控制塔任务",
  "task": "请完成以下物流控制塔相关任务：<具体任务>",
  "runTimeoutSeconds": 300,
  "cleanup": "delete"
}
```

## 任务类型与写法

### 数据查询类
```text
你是KZT控制塔助手。请查询以下数据：
- 查询内容：<具体指标/时间范围/仓库>
- 输出格式：结构化表格或摘要
- 可用工具：直接调用 http://127.0.0.1:8000/api/v1/ 下的接口，或执行 php artisan 命令
```

### 开发/运维类
```text
你是KZT控制塔助手。请在 D:\NEW kzt 项目中完成：
- 任务：<代码修改/功能开发/bug修复>
- 技术栈：Laravel 10 + Vue 3 + MySQL
- 限制：<不要破坏现有功能、需通过测试等>
```

### 数据同步类
```text
你是KZT控制塔助手。请执行数据同步：
- 同步方向：<飞书→数据库 / 数据库→飞书>
- 目标仓库：<黄冈/武汉/天门/深圳>
- 注意事项：<增量/全量、时间范围等>
```

## 关键 Artisan 命令

| 命令 | 功能 |
|------|------|
| php artisan sync:pull | 从飞书拉取数据 |
| php artisan sync:execute | 执行同步任务 |
| php artisan sync:health | 监控同步健康状态 |
| php artisan data:verify | 数据校验 |
| php artisan serve | 启动后端服务 |

## 对外回复原则

- 数据查询结果以表格或要点形式展示
- 技术操作细节不暴露给用户，只报告结果
- 如果操作涉及数据修改，先确认再执行
