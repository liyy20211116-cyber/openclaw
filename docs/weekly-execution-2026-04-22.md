# 一人公司项目本周执行版

> 周期：2026-04-22 至 2026-04-26
> 目标：先打通真实闭环，再补齐关键配置，最后完成本周交付项
> 口径：只保留主项目和当前运营链路的真实未完成项，不包含培训/归档文档中的历史清单

---

## 一、本周优先级

### P0：必须先完成

| ID | 事项 | 负责人 | 截止 | 完成标准 | 当前阻塞 |
|---|---|---|---|---|---|
| P0-1 | 跑通 1 条 OpenClaw 真实任务执行闭环 | hermione-tech | 2026-04-23 | 至少 1 条任务完成 `spawn -> 执行 -> 回写 -> 日志记录` | `processed_log.json` 为空，尚无成功案例 |
| P0-2 | 跑通 ONES 审核自动化端到端链路 | hermione-tech | 2026-04-23 | 从 `pending_reviews.json` 取 1 条记录，验证通过 -> 建单 -> 飞书回写 -> `processed_log.json` 写入 | Edge CDP、Token、WebSocket 回调、回写链路需联调 |
| P0-3 | 补齐关键集成配置 | 李原野 | 2026-04-23 | 飞书、抖音、小红书、B站、SMTP、收款码路径不再是 `TODO_*` | 账号凭据和二维码文件未齐 |
| P0-4 | 完成 2026-04-22 当天运营动作 | luna-growth / fred-sales / snape-audit | 2026-04-22 | 今日视频发布、昨日咨询处理、热点监控、Token Top3 审计全部落地 | 需要人手实际执行 |

### P1：本周内完成

| ID | 事项 | 负责人 | 截止 | 完成标准 | 依赖 |
|---|---|---|---|---|---|
| P1-1 | CEO 对话页接入真实 LLM | hermione-tech | 2026-04-25 | 可调用真实 LLM 拆解目标，规则引擎作为 fallback | P0-3 |
| P1-2 | 前端展示执行结果与错误日志 | hermione-tech | 2026-04-25 | 任务详情页可查看执行结果和失败原因 | P0-1 |
| P1-3 | 业务线数据持久化到 DB | hermione-tech | 2026-04-26 | `businessLines` CRUD 不再依赖前端默认数据 | 无 |
| P1-4 | Electron 生产打包验证 | hermione-tech | 2026-04-26 | 能产出 Windows `.exe` 并完成一次本地安装验证 | 无 |
| P1-5 | 一键启动脚本开箱即用验证 | hermione-tech | 2026-04-26 | 干净环境下可双击启动并正常可用 | P1-4 |
| P1-6 | 核心 service 单元测试补齐第一批 | hermione-tech | 2026-04-26 | 至少覆盖 `businessLineService`、`goalDecomposeService`、`dashboardService` | 无 |
| P1-7 | WP16 内容工厂 `cron` 实跨 + 备份 | hermione-tech | 2026-04-24 | 定时任务稳定运行，备份可验证 | P0-3 |
| P1-8 | WP21 抖音 10 条视频素材合成 | pack-content | 2026-04-24 | 10 条素材合成为可发布 MP4 | P0-3 |
| P1-9 | WP22 B站 15 分钟长视频录制 | 李原野 / pack-content | 2026-04-26 | 完成录制，或改为 AI 数字人方案并输出成片 | 素材和口播方案确定 |

### P2：可顺延

| ID | 事项 | 负责人 | 截止 | 完成标准 |
|---|---|---|---|---|
| P2-1 | 优化快照机制读写分离 | hermione-tech | 下周 | 减少写后全量导出 |
| P2-2 | 清理遗留文件 `mockData.ts`、`appDataService.ts` | hermione-tech | 下周 | 删除或归档不再使用代码 |

---

## 二、今天必须做（2026-04-22）

| 顺序 | 动作 | 负责人 | 输出物 |
|---|---|---|---|
| 1 | 交付并填写飞书、三平台 Cookie、SMTP、收款码路径 | 李原野 | 可用配置文件 / 凭据文件 |
| 2 | 启动 OpenClaw、Edge CDP、`card_action_handler.py`，执行 1 次真链路调试 | hermione-tech | 成功日志或明确失败点 |
| 3 | 发布今日视频 | luna-growth | 发布记录 / 链接 |
| 4 | 处理昨日新增咨询（>=3 条） | fred-sales | 跟进记录 |
| 5 | 热点聚合 + 对标监控 | luna-growth | 热点清单 |
| 6 | 抽样审计昨日 Token 消耗 Top3 | snape-audit | 审计记录 |

---

## 三、48 小时内完成（2026-04-23 至 2026-04-24）

| 事项 | 负责人 | 完成条件 |
|---|---|---|
| OpenClaw 真实闭环跑通 | hermione-tech | `processed_log.json` 出现首条成功记录 |
| ONES 审核自动化闭环跑通 | hermione-tech | 飞书回写 ONES 链接和编号成功 |
| WP16 `cron` + 备份 | hermione-tech | 任务自动执行并保留备份 |
| WP21 抖音 10 条视频素材合成 | pack-content | 10 条 MP4 可用 |

---

## 四、本周剩余时间完成（2026-04-25 至 2026-04-26）

| 事项 | 负责人 | 完成条件 |
|---|---|---|
| CEO 对话页接入真实 LLM | hermione-tech | 对话页可调用真实模型 |
| 执行结果前端可视化 | hermione-tech | 任务详情页能查看执行结果 |
| 业务线写回 DB | hermione-tech | `businessLines` CRUD 入库 |
| Electron 打包与开箱验证 | hermione-tech | `.exe` 产出并验证双击可用 |
| 第一批核心 service 单测 | hermione-tech | 核心测试可稳定通过 |
| WP22 B站长视频 | 李原野 / pack-content | 完成长视频成片 |

---

## 五、阻塞清单

| 阻塞项 | 影响范围 | 解除方式 |
|---|---|---|
| `config/integrations.json` 仍有大量 `TODO_*` | 飞书通知、平台发布、邮件触达、收款链路无法实跑 | 2026-04-23 前补齐全部关键字段 |
| ONES 自动化链路无成功 `processed_log.json` | 无法证明真实端到端闭环 | 先手动触发 1 条通过流程并记录结果 |
| Electron 打包状态文档口径不一致 | 易误判“已完成” | 统一以 `docs/开发进度与计划.md` 为唯一口径 |
| B站长视频仍依赖 CEO 口播方案 | WP22 无法按时收口 | 2026-04-24 前二选一：真人口播 or AI 数字人 |

---

## 六、建议执行顺序

1. 先解配置阻塞，再做真实链路联调。
2. 真实链路一旦跑通，立即补前端结果展示与日志展示。
3. 再做 LLM 接入和 DB 持久化，避免先做“看起来更高级”但无法验收的部分。
4. Electron 打包放到周后半段，但本周必须收口，否则交付口径继续冲突。

---

## 七、周末验收标准（2026-04-26）

- 至少 1 条 OpenClaw 真实任务闭环成功。
- ONES 审核自动化出现首条成功处理日志。
- 关键集成配置不再存在 `TODO_*` 阻塞项。
- 本周 3 个 pending 工作包中，至少完成 WP16 和 WP21，WP22 明确落地方案。
- CEO 对话页、执行结果前端展示、Electron 打包验证三项至少完成 2 项。

---

## 八、追加交付（2026-04-23 新增）

### 角色评分能力闭环 · Day 1 已交付

- 前端绩效展示不再是硬编码：
  - Dashboard 的"绩效均分 74.3"改为动态统计
  - AgentPerformanceChart 不再使用 DEFAULT_AGENTS
  - NotificationPanel 假通知已清理
- 新增 API `/api/agents/performance` 和 `/api/agents/performance/refresh`
- Agent 类型新增 `performance` 字段并在 exportSnapshot 注入
- 详细记录：`docs/performance-loop.md`

### 盈利边界地图 · Day 2 Step A 已交付（2026-04-23）

> 按 CEO 方向明确调整：产品化商业化的前提是**先跑通盈利链路、暴露盈利边界**。

- 新增 `src/services/profitabilityService.ts`：统一计算单位经济、烧钱速率、盈亏平衡、Agent RPC、任务 P&L、利润引擎/黑洞
- 新增 `src/pages/ProfitabilityPage.tsx`：完整"盈利边界地图"页面
- 侧栏新增「盈利边界」入口、路由 `/profitability`
- Dashboard 替换"自动化脚本 40+ / 服务目录 4 项"两张摆设卡 → "盈利边界 X 单/月"+"烧钱速率 ¥/日"
- 明确提示 `ledger/revenues` 为空时的现实含义："先跑出 1 条真实流水"

### 下一步（Day 2 Step B）

评分 v2（TS 实现）+ Prisma 持久化历次评估，让评分真正反映"谁赚钱/谁烧钱"。详见 `docs/performance-loop.md` 第六节末尾。
