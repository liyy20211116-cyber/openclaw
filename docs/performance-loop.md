# 角色评分能力 + 盈利边界闭环 · 交付记录

> 首次交付：2026-04-23
> 产品原则：每一步都要回答"离赚到第一块钱 / 暴露盈利边界更近了吗"
> 本文统一跟踪评分链路 + 盈利边界两条 PR

---

## 一、Day 1 范围

只做"数据链路打通"，不动评分算法（维度升维放到 Day 2）。

## 二、本次修改文件清单

### 后端

- `jarvis-one-company-os/scripts/lib/performanceLoader.ts`（新增）
  - 从 `<dataRoot>/output/performance/*.json` 和 `<dataRoot>/output/performance_review_*.json` 读取最新一份评估
  - 统一 `agentFolder → agent.code` 映射（jarvis-coo → jarvis 等）
  - 容错解析两种历史 JSON 结构（有无 `summary` 包裹均可）
- `jarvis-one-company-os/scripts/lib/exportSnapshot.ts`（修改）
  - 导出 snapshot 时注入 `agent.performance` 与 `snapshot.performanceSummary`
- `jarvis-one-company-os/scripts/writeback-api.ts`（修改）
  - 新增 `POST /api/agents/performance` —— 返回最新评估
  - 新增 `POST /api/agents/performance/refresh` —— 触发 Python 脚本 + 重新导出 snapshot
  - 新增 `runPythonScript` 通用 helper

### 前端

- `jarvis-one-company-os/src/types.ts`（修改）
  - 新增 `PerformanceGrade / PerformanceBreakdown / AgentPerformance / PerformanceSummary` 类型
  - `Agent` 增加 `performance?: AgentPerformance`
  - `AppSnapshot` 增加 `performanceSummary?: PerformanceSummary`
- `jarvis-one-company-os/src/services/performanceService.ts`（新增）
  - `fetchLatestPerformance() / refreshPerformance()` 两个 API 封装
  - `gradeColor() / scoreColor()` 颜色工具
- `jarvis-one-company-os/src/components/AgentPerformanceChart.tsx`（重写）
  - 不再使用硬编码 `DEFAULT_AGENTS`
  - 默认从 snapshot.agents[].performance 取数
  - 新增"刷新评分"按钮，触发 refresh 端点并自动 reload
  - 空数据友好提示
- `jarvis-one-company-os/src/pages/DashboardPage.tsx`（修改）
  - 删除硬编码"绩效均分 74.3"，改为动态拼接（rated 数量、均分、A/B 分布）
- `jarvis-one-company-os/src/components/NotificationPanel.tsx`（重写）
  - 去除 5 条假通知
  - 改为基于 snapshot 动态产出：绩效评估、审计事件 open 计数、pending 审批计数
- `jarvis-one-company-os/src/pages/AgentsPage.tsx`（修改）
  - 去除 `(agent as any).performanceScore` 强类型转换
  - 改读 `agent.performance`
  - 新增"绩效维度明细"面板（展示 completeness/skills/... 每维分数 + 待提升标签）

## 三、验证

- `npx tsc --noEmit -p tsconfig.app.json` ✅ 通过
- `npx tsc --noEmit -p tsconfig.node.json` ✅ 通过
- `eslint` 对本次改动文件全绿（项目其它历史 lint 问题未在本次范围内）

## 四、运行方式

### 首次使用

1. 启动写回 API：`npm run db:writeback-api`（或 `npm run dev`）
2. 打开 CEO 驾驶舱 → 右下角"Agent 绩效概览"卡片 → 点击"刷新评分"
3. 后端会：
   - 运行 `openclaw_agents/neville-hr/skill_performance_review.py`
   - 把 JSON 读入 `exportSnapshot` 注入 agent.performance
   - 页面自动 reload，看到真实分数

### 依赖

- 系统已安装 Python 3（可通过环境变量 `PYTHON_EXECUTABLE` 指定路径）
- `openclaw_agents/` 目录在 `JARVIS_COMPANY_DATA_DIR`（默认：项目根 `..`）下

## 五、Day 1 未覆盖项（留给 Day 2）

| 项 | 说明 |
|---|---|
| 评分算法升维 | 加入 `task_completion / budget_discipline / compliance_delta / revenue_contribution` 四个业务维度 |
| 定时任务 | 每周一 09:00 跑全量，每日 09:00 跑增量 |
| 历史曲线 | 把多次评估保存到 DB（Prisma PerformanceReview 模型） |
| 角色互评 | Agent 间的交付质量互评接口 |

## 六、Day 2 Step A 已交付（2026-04-23）：盈利边界地图

> 方向调整：Day 2 不再只是"给评分加维度"，而是围绕 CEO 设定的商业化方向——
> **让系统先跑通盈利链路、明确盈利边界，才能成为值钱的产品。**

### Step A 交付内容

- `src/services/profitabilityService.ts`（新增）
  - `getBoundary()` 一次产出 8 个关键结果：单位经济、每日烧钱、盈亏平衡、Agent RPC、任务 P&L、利润引擎、利润黑洞、一句话 headline
  - Token → ¥ 兑换固定 `0.15`，与 `businessLineService` 对齐
- `src/pages/ProfitabilityPage.tsx`（新增）
  - 大卡：累计收入 / 累计开销 / 净利润 / 烧钱速率
  - 业务线单位经济（每档定价的毛利 + 毛利率）
  - 盈亏平衡地图（每条业务线需要几单/月 + 可行性标签）
  - 利润引擎 Top 5 + 利润黑洞 Top 5
  - Agent 盈利能力全景表（RPC / 净贡献 / 完成率 / 分类）
  - 任务级 P&L Top 20
- `src/app/navigation.ts`（修改）：侧栏新增「盈利边界」入口（排在 CEO 对话之后）
- `src/App.tsx`（修改）：注册 `/profitability` 路由
- `src/pages/DashboardPage.tsx`（修改）
  - 去掉"自动化脚本 40+"、"服务目录 4 项"两张与盈利无关的摆设卡
  - 换成"盈利边界：X 单/月即平衡"（点击跳转 ProfitabilityPage）
  - 和"烧钱速率：¥X/日"两张反映商业现实的真实卡

### 关键设计洞察

**系统目前 `ledger: []`、`revenues: []` 全空** —— 这不是 bug，而是真实现实：
> 一单没赚、一分钱流水都没有。

因此 profitabilityService 必须在"没有真实流水"时也给出有价值的答案：
1. 用 businessLine 的 pricingTiers + costStructure **理论值**算出单单经济
2. 盈亏平衡基于**实际账本的烧钱速率**；若账本为空则明确告知"尚未产生真实流水"
3. Agent RPC 在无数据时会分类为 `unknown` 而不是瞎给分

### 验证

- `tsc --noEmit -p tsconfig.app.json` ✅
- `eslint --max-warnings 0`（本次改动 5 个文件）✅

### Day 2 Step B 已交付（2026-04-23）：评分 v2 TS 实现 + Prisma 持久化 + 历史曲线

> 方向：把评分算法从 Python 脚本升维成 TS 实现，共享 Prisma / profitabilityService 的数据源，并把每次评估写入数据库做历史曲线。

#### 维度锁定（9 维 / 总分 100）

| 分组 | 维度 | 权重 | 数据源 |
|---|---|---:|---|
| 资产（50） | completeness | 15 | IDENTITY.md / skills.json / memory 目录 |
| 资产 | skills | 10 | skills.json 条数 |
| 资产 | memory_activity | 10 | learnings.md 分段数 + 最近修改时间 |
| 资产 | scripts | 10 | agent 目录下 `.py` 文件数 |
| 资产 | growth | 5 | domain_knowledge.json / reflection_log.json |
| 商业（50） | task_completion | 15 | Prisma tasks（completed / assigned） |
| 商业 | budget_discipline | 10 | Prisma tasks（spentToken / budgetToken） |
| 商业 | compliance_delta | 10 | Prisma agents.complianceScore |
| 商业 | revenue_contribution | 15 | Prisma revenues / ledger（RPC 分档） |

Grade 阈值：S ≥ 90 / A ≥ 75 / B ≥ 60 / C ≥ 40 / D < 40。

#### 交付内容

**数据库**

- `prisma/schema.prisma` 新增 `PerformanceReview` 模型（9 维分数以 JSON 列存储，保留 metadata 回溯每次评估的 assignedTasks / spentToken / 收入等快照）
- 新迁移 `prisma/migrations/20260423000001_add_performance_review/migration.sql`
- `scripts/lib/prismaClient.ts` 的 `ensureSchema` 同步建表 + 两个索引（`agentCode+createdAt`、`createdAt`），保证干净环境首启可用

**后端**

- `scripts/lib/performanceEvaluator.ts`（新增）
  - `evaluateAllAgentsV2(prisma, { persist })`：纯 TS 9 维评分，可选写 DB
  - `dumpReportToJson(report)`：同时落 `output/performance/performance_review_*_v2.json`，保留与 v1 JSON 读取链路兼容
- `scripts/lib/performanceLoader.ts`（扩展）
  - `loadLatestPerformanceFromDb(prisma)` —— 从 `performance_reviews` 读每个 agent 的最新一行
  - `loadLatestPerformanceWithPrisma(prisma)` —— DB 优先、JSON 兜底
  - `loadPerformanceHistory(prisma, agentCode, limit)` —— 返回按时间升序的历史点
- `scripts/lib/exportSnapshot.ts`：快照导出改走 `loadLatestPerformanceWithPrisma(prisma)`
- `scripts/writeback-api.ts`
  - `POST /api/agents/performance`：DB 优先
  - `POST /api/agents/performance/refresh`：body `{ "version": "v1" | "v2" }`，默认 `v2`；v2 走 TS 评估 + 持久化；v1 保留 Python 脚本兜底
  - 新增 `POST /api/agents/performance/history`：入参 `{ agentCode, limit }`

**前端**

- `src/types.ts` 新增 `PerformanceHistoryPoint`
- `src/services/performanceService.ts`
  - `refreshPerformance({ version? })`：默认 v2，可显式降级 v1
  - `fetchPerformanceHistory(agentCode, limit)`：新端点封装
- `src/components/PerformanceSparkline.tsx`（新增）：纯 SVG sparkline，不引入任何新依赖；显示数据点 tooltip、变化 Δ、首尾日期
- `src/pages/AgentsPage.tsx`：选中 agent 的详情面板内集成 sparkline，使用派生状态（`historyByAgent` map）规避 react-hooks `set-state-in-effect`

#### 验证

- `npx prisma generate` ✅ 生成 `PerformanceReview` 模型
- `npx tsc --noEmit -p tsconfig.node.json` ✅
- `npx tsc --noEmit -p tsconfig.app.json` ✅
- `eslint --max-warnings 0` 对本次改动的 7 个文件 ✅（`writeback-api.ts` 原有 8 条 no-empty / no-unused-vars 与本次交付无关，保持原状）

> 注：如遇 better-sqlite3 NODE_MODULE_VERSION 不匹配导致 `db:export` 报 `ERR_DLOPEN_FAILED`，与本次改动无关，运行 `npm rebuild better-sqlite3 --build-from-source` 即可恢复。

### Day 2 Step C 已交付（2026-04-23）：周比 + What-If + 周报脚本 + 定时刷新

#### 交付内容

- `src/services/profitabilityService.ts`
  - 抽出纯函数 `buildProfitabilityBoundary()`，统一给页面、脚本、测试复用
  - 新增 `computeWeeklyBurnComparison()`：按周比较本周 vs 上周烧钱
  - 新增 `simulateBoundaryWhatIf()`：支持业务线价格/成本百分比变动后的盈亏平衡重算
  - 新增 `buildProfitabilityWeeklyReport()`：输出 Markdown 周报正文
- `src/pages/DashboardPage.tsx`
  - 烧钱速率卡片改为展示“本周 vs 上周”与环比
- `src/pages/ProfitabilityPage.tsx`
  - 新增 What-If 模拟器：选择业务线，输入价格/成本变动，即时重算平均客单价、单单利润、盈亏平衡线、毛利率
  - 新增本周烧钱速率卡片：展示本周、上周与环比
- `scripts/lib/exportSnapshot.ts`
  - 新增 `buildAppSnapshot()`，让脚本端可以直接拿到与前端一致的 snapshot 数据
- `scripts/export-profitability-weekly.ts`（新增）
  - 生成 `docs/profitability-weekly-YYYY-MM-DD.md`
- `desktop/electron/schedulerService.ts`
  - 新增内建任务 `__performance_refresh_v2__`
  - 调用 `/api/agents/performance/refresh`，每周定时跑 v2 刷新
- `config/app-config.json`
  - 增加“绩效评分刷新”周一 09:00 定时任务
- `package.json`
  - 增加 `npm run report:profitability-weekly`

#### 验证

- `npx tsx scripts/test-profitability-step-c.ts`：覆盖 What-If、周比、周报导出正文
- `npx tsc --noEmit -p tsconfig.app.json`
- `npx tsc --noEmit -p tsconfig.node.json`
- `npx eslint src/pages/DashboardPage.tsx src/pages/ProfitabilityPage.tsx src/services/profitabilityService.ts scripts/export-profitability-weekly.ts scripts/test-profitability-step-c.ts desktop/electron/schedulerService.ts`

### 北极星 Step D 已交付（2026-05-02）：买家版商业化就绪报告（CLI + 单测）

> 方向：把 5 维 + 盈利边界 + 商业化里程碑合成一份**可直接发给潜在买家或投资人**的 Markdown 一页纸，作为对外口径锚点。

#### 交付内容

- `src/services/commercialReadinessReportService.ts`（新增，纯函数）
  - `buildCommercialReadinessSummary(snapshot, config, businessLines, referenceDate)` —— 汇总 5 维团队均分、盈利边界、付费用户数与 M0–M4 里程碑判定
  - `renderCommercialReadinessMarkdown(summary)` —— 渲染中文 Markdown 一页纸（含「对齐北极星」checklist）
  - `buildCommercialReadinessReport(...)` —— 上述两步组合
- `scripts/export-commercial-readiness.ts`（新增 CLI）
  - 从 Prisma + `config/app-config.json` 读取真实数据
  - 输出 `docs/commercial-readiness-YYYY-MM-DD.md`
  - 同时打印综合分、Grade、Top performer、达成的里程碑摘要
- `package.json`
  - 新增 `npm run report:commercial-readiness`
  - `npm test` 增加 `test-commercial-readiness-export.ts`
- `scripts/test-commercial-readiness-export.ts`（新增单测）
  - 覆盖：5 维团队均分、盈亏平衡 best-pick、付费用户识别、M1 里程碑判定、空账本兜底（输出"ledger / revenues 表为空"提示）

#### Markdown 报告结构

1. Header：公司名 / CEO / 团队规模 / 综合就绪分（带颜色图标）+ 北极星锚点链接
2. 一、北极星 5 维团队均分（含状态色 + 头号选手 + 重点改进维度）
3. 二、盈利边界（累计收入/开销/净利、月烧钱、最易盈亏平衡业务线）
4. 三、商业化里程碑（M0–M4 状态表，每条附判定理由）
5. 四、对外口径建议（按 Grade 自动给出可签 / 可演示 / 暂缓签单的口径）
6. 五、对齐北极星 Checklist（5 维逐项打钩）

#### 验证

- `npx tsx scripts/test-commercial-readiness-export.ts`：单测通过
- `npm test`：30 项全部通过（含本次新增）
- `npm run build`：tsc + vite 通过

#### 已知限制

- `npm run report:commercial-readiness` 直接跑 CLI 时，会和 `npm run report:profitability-weekly` 一样依赖 `buildAppSnapshot` 能正常拉 Prisma；当前本机 dev.db 中存在历史 `taskType: 'coo_ops'` 与新 enum 不匹配的脏数据（pre-existing），需要先 `prisma migrate dev` 或清洗该字段。报告生成逻辑本身已被单测覆盖，不依赖具体 enum。

### 北极星 Step B 已交付（2026-04-23）：5 维商业就绪评分前端版

#### 交付内容

- `docs/NORTH-STAR.md`
  - 固化 5 维评分：`autonomy / revenue_contribution / intelligence / execution / productization`
  - 追加前端即时评分代理口径，明确页面展示与后端持久化评分的关系
- `jarvis-one-company-os/src/services/performanceV2Service.ts`（新增）
  - 纯前端即时计算商业就绪分
  - 团队均分、降档规则、最低维度识别统一收口到这里
- `jarvis-one-company-os/src/components/CommercialReadinessRadar.tsx`（新增）
  - 使用 `recharts` Radar 画 5 维商业就绪雷达图
- `jarvis-one-company-os/src/pages/AgentsPage.tsx`
  - 选中 Agent 后并列展示：
    - v2 商业就绪评分 + 5 维拆分 + 雷达图
    - v1 持久化绩效评分 + 历史曲线
- `jarvis-one-company-os/src/pages/DashboardPage.tsx`
  - 「Agent 团队」卡改为「商业就绪」卡，展示 v2 团队均分与 grade 分布
- `jarvis-one-company-os/README.md`
  - 增补北极星 v2 商业就绪能力说明与周报脚本入口
- `jarvis-one-company-os/scripts/test-performance-v2-service.ts`（新增）
  - 覆盖 5 维评分、团队摘要、收入差异和低分降档

#### 验证

- `npx tsx scripts/test-performance-v2-service.ts`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npx eslint src/pages/AgentsPage.tsx src/pages/DashboardPage.tsx src/components/CommercialReadinessRadar.tsx src/services/performanceV2Service.ts scripts/test-performance-v2-service.ts`

---

## 七、历史规划（保留，仅参考）

> 以下是 Day 1 写下的 Day 2 原计划。实际执行方向已由 CEO 明确调整为先做盈利边界。

1. ~~新增 `openclaw_agents/neville-hr/skill_performance_review_v2.py`（保留 v1 作为兜底）~~ → 改为 Step B 用 TS 实现
2. ~~新 v2 读取 `dev.db`（SQLite）统计真实任务完成率等~~ → Step B 沿用
3. writeback-api 的 refresh 端点增加 `version` 参数可选 v1/v2
4. Prisma 新增 `PerformanceReview` 模型 → 迁移 → 每次刷新写一行
5. AgentsPage 增加"历史曲线"mini chart
