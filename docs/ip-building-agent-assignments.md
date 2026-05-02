# IP 打造 — Agent 任务分配总表

> 9个 Agent 在 CEO 个人 IP 打造中的职责分工
> 执行周期：30天（2026-04-16 ~ 2026-05-16）

---

## 总览：谁干什么

```
CEO（你）
  ├── 最终审核 + 出镜录制 + 战略决策
  │
  ├── Jarvis COO ── 统筹协调 + 周报/月报 + 任务分发
  │     ├── Luna CGO ── 内容创作主力（日常运营全链路）
  │     ├── Hermione CTO ── 技术内容审核 + 代码演示素材
  │     ├── McGonagall CPO ── 服务包装 + 变现产品设计
  │     ├── Fred CSO ── 竞品分析 + 获客话术 + 社群运营
  │     ├── Percy CFO ── Token/成本追踪 + ROI计算
  │     ├── Snape CAO ── 内容合规审计 + 质量检查
  │     ├── Dobby CCO ── 用户反馈收集 + 评论区运营
  │     └── Neville HR ── 能力缺口分析 + 学习计划
  │
  └── [工作流引擎] ── 自动触发日常/周复盘流水线
```

---

## 各 Agent 详细任务

### 1. Jarvis COO — 总指挥

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| IP打造进度总览 | jarvis_company_status | 每日 | 状态看板 |
| 任务分发给各Agent | jarvis_dispatch_tasks | 每日 | 任务清单 |
| 生成CEO日报/周报 | jarvis_daily_report | 每日/每周 | 报告文档 |
| 飞书同步进度 | jarvis_feishu_msg | 每日 | 飞书消息 |
| Agent效率监控 | jarvis_observability | 每周 | 监控报告 |

**核心职责**：确保所有Agent按计划运转，及时发现瓶颈并协调资源。

---

### 2. Luna CGO — 内容创作主力 ⭐ 最核心

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| 抖音热点追踪 | luna_douyin_trending | 每日 | 热点报告 |
| 小红书话题研究 | luna_xhs_research | 每周2次 | 话题分析 |
| 内容日历生成 | luna_content_calendar_gen | 每周 | 排期表 |
| 视频脚本生成 | luna_draft_generator | 每日 | 抖音/小红书草稿 |
| 视频方案生成 | luna_video_generator | 每日 | 视频脚本+配置 |
| 跨平台改写 | luna_content_rewriter | 每日 | 多平台版本 |
| 竞品内容分析 | luna_xhs_competitor | 每周 | 竞品报告 |
| 运营数据看板 | luna_platform_ops_dashboard | 每周 | 全景看板 |
| 多平台发布 | luna_auto_publisher | 每日 | 发布记录 |
| 行业趋势分析 | luna_industry_analysis | 每周 | 趋势报告 |

**核心职责**：日产1-2条高质量内容，覆盖抖音/小红书/B站三个平台。

**Luna 的日常工作流**：
```
09:00 热点追踪 → 09:30 选题确认 → 10:00 草稿生成 →
10:30 跨平台改写 → 11:00 CEO审核 → 12:00/20:00 发布
```

---

### 3. Hermione CTO — 技术内容顾问

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| 技术内容审核 | hermione_code_review | 每条技术视频 | 审核意见 |
| 代码演示素材准备 | hermione_tech_analysis | 每周2次 | 代码片段+截图 |
| 系统功能演示脚本 | hermione_run_test | 每周 | 功能演示流程 |
| 竞品技术对比 | hermione_competitor_watch | 每周 | 技术对比报告 |
| 服务健康检查 | hermione_check_services | 每日 | 系统状态 |

**核心职责**：确保技术内容准确无误，提供代码级演示素材。

---

### 4. McGonagall CPO — 产品包装与变现

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| 服务产品化 | mcgonagall_service_packager | Day 25-30 | 服务包清单 |
| 需求分析 | mcgonagall_requirement_analysis | 按需 | 需求文档 |
| 用户故事提取 | mcgonagall_acceptance_check | 每周 | 用户场景 |
| 知识付费课程设计 | mcgonagall_topic_planner | Day 20-30 | 课程大纲 |

**核心职责**：将技术能力包装为可售卖的产品/服务/课程。

---

### 5. Fred CSO — 竞品分析与获客

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| 竞品定价分析 | fred_competitor_pricing | 每周 | 定价报告 |
| 获客话术生成 | fred_outreach_generator | Day 26-30 | 话术模板 |
| 线索评分 | fred_lead_scorer | 按需 | 线索清单 |
| 销售数据统计 | fred_sales_stats | 每周 | 销售报表 |

**核心职责**：研究同赛道竞品策略，为变现阶段准备获客方案。

---

### 6. Percy CFO — 成本与投产比

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| Token消耗追踪 | percy_token_report | 每周 | 消耗报表 |
| 内容ROI计算 | percy_roi_calculator | 每周 | ROI分析 |
| 投入产出预测 | percy_cost_tracker | 每月 | 预算规划 |

**核心职责**：追踪IP打造的Token成本，计算内容投入产出比。

---

### 7. Snape CAO — 质量审计

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| 内容合规检查 | snape_compliance_check | 每条内容 | 审核报告 |
| 数据真实性审计 | snape_revenue_audit | 每周 | 审计结果 |

**核心职责**：确保所有发布内容不含敏感信息、虚假数据或合规风险。

---

### 8. Dobby CCO — 用户互动

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| 评论情感分析 | dobby_feedback_collector | 每日 | 情感报告 |
| 用户满意度追踪 | dobby_satisfaction_survey | 每周 | 满意度数据 |
| 智能客服回复 | dobby_smart_cs | 持续 | 回复建议 |

**核心职责**：收集和分析用户反馈，优化内容方向。

---

### 9. Neville HR — 能力提升

| 任务 | 技能 | 频率 | 输出物 |
|------|------|------|--------|
| CEO能力缺口分析 | neville_capability_gap | Day 1 | 能力评估 |
| 学习计划制定 | neville_hr_report | Day 1 | 学习路线 |
| 团队成长报告 | neville_team_growth_report | 每月 | 成长报告 |

**核心职责**：识别CEO在短视频制作等方面的能力缺口，提供学习建议。

---

## 工作流自动化

### 日常流水线 — `ip_building_daily`
- **触发**：每天上午9点自动执行
- **流程**：热点追踪 → 话题研究 → 内容排期 → 草稿生成 → 视频脚本 → 跨平台改写 → 合规检查 → 发布 → 数据看板
- **预计Token消耗**：~8000/天
- **预计耗时**：~45分钟

### 周复盘流水线 — `ip_building_weekly_review`
- **触发**：每周日上午10点自动执行
- **流程**：产出统计 → 数据看板 → 视频分析 → 笔记分析 → 线索转化 → ROI计算 → 周报
- **预计Token消耗**：~6000/次
- **预计耗时**：~30分钟

---

## Token 预算估算（30天）

| 项目 | 日均Token | 月度合计 |
|------|----------|---------|
| 日常流水线(Luna为主) | 8,000 | 240,000 |
| 周复盘(全员) | 6,000×4 | 24,000 |
| 临时任务/突发热点 | — | 36,000 |
| **合计** | — | **~300,000** |

> 按主流API价格约 $0.01/1K token 估算，月度成本约 **$3** (约¥22)。
> 这就是"一人公司"的威力：9个Agent跑一个月，成本不到一杯咖啡。
