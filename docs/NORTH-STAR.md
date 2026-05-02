# 北极星 · Jarvis One Company OS

> 所有未来的功能、评分、优化、重构，都必须回答：
> **"这一步让它更接近下面这个画像了吗？"**
> 不能回答"是"的动作，就**立刻停手**。

---

## 一、核心画像

**一人公司 = 自主运行 + 自主盈利 + 聪明大脑 + 灵活手脚 → 可商业化产品**

拆成 5 条可度量的能力：

| # | 能力 | 一句话定义 | 典型反例（要被砍掉的东西） |
|---|---|---|---|
| 1 | **自主运行 Autonomy** | 不依赖 CEO 手动派单，系统自己能跑起来、动起来 | 需要 CEO 每天手动点「跑任务」 |
| 2 | **自主盈利 Revenue** | Agent 的工作能直接映射到真金白银的 ROI | 文件产出一堆但 ledger/revenues 全空 |
| 3 | **聪明大脑 Intelligence** | 决策质量：任务完成率 × 合规 × 无冻结 | 任务永远在 draft，或被 audit 冻结一堆 |
| 4 | **灵活手脚 Execution** | 执行纪律：按时率 × 预算吻合度 × 技能覆盖 | 预算总超标，技能一半是 mock |
| 5 | **可商业化 Productization** | 交付可复用：SkillOutput 标准化 + 文档完整度 | 产出只在本机有，别的一人公司装不起来 |

---

## 二、评分口径（从 Day 2 Step B 起生效）

### 2.1 维度权重

| 维度 | 分数 | 度量来源 |
|---|:---:|---|
| 自主运行 Autonomy | 20 | heartbeat 主动提案数 + 自发创建任务数 |
| 自主盈利 Revenue | 20 | `profitabilityService.getBoundary().agentRPC`（直接用） |
| 聪明大脑 Intelligence | 20 | 完成率 × 合规分 × (1 − 冻结率) |
| 灵活手脚 Execution | 20 | 按时率 × min(1, budget/spent) × skill_ref 真实跑通率 |
| 可商业化 Productization | 20 | SkillOutput 适配率 + IDENTITY/SKILL 文档完整度 |
| **合计** | 100 | — |

### 2.2 Grade 边界

| Grade | 门槛 | 含义 |
|---|:---:|---|
| S | ≥ 85 | 可以作为一人公司商业化模板 |
| A | 70–84 | 商业化就绪，但某 1 个维度仍拖后腿 |
| B | 55–69 | 能跑，但离可售卖还差关键闭环 |
| C | 40–54 | 只能演示，不能交付 |
| D | < 40 | 半成品 |

### 2.3 整体 = 团队加权平均，但**任何单维度 < 40 分 → 整体 grade 降一档**

防止"偏科天才"——如果一个 Agent 自主盈利满分但自主运行 0 分，它不是商业化就绪。

### 2.4 前端即时评分代理口径（`src/services/performanceV2Service.ts`）

这套口径用于页面实时展示、Dashboard 团队卡、AgentsPage 雷达图与 Day 3 对外「商业化就绪分」。

| 维度 | 前端即时计算代理 |
|---|---|
| Autonomy | 自建任务占比 + 非审批依赖占比 + 任务流动率（`in_progress/review/completed`） |
| Revenue | `profitabilityService.buildProfitabilityBoundary().agentRPC` 的 RPC 与净贡献组合 |
| Intelligence | 完成率 × 合规分 × 无冻结率 |
| Execution | 按时率 × 预算吻合度 × `app-config.task_types/capabilities` 覆盖率 |
| Productization | `skills_file/task_types/capabilities` 标准化程度 + persona/goals/role 文档完整度 |

说明：

- 前端版是**实时代理指标**，目标是让 CEO 当场判断「这个 Agent 离可卖还差哪一维」。
- 后端持久化版如需对外正式披露，可在 Day 3 沿用同一 5 维，但允许接入更严格的数据源（比如 SkillOutput 文件、文档扫描结果、heartbeat 真实提案日志）。

---

## 三、每日自检（每次开发/优化前问自己）

1. ☐ 这个改动让 **Autonomy** 分数上升了吗？
2. ☐ 这个改动让 **Revenue** 分数上升了吗？
3. ☐ 这个改动让 **Intelligence** 分数上升了吗？
4. ☐ 这个改动让 **Execution** 分数上升了吗？
5. ☐ 这个改动让 **Productization** 分数上升了吗？

至少 1 项打勾才动手。任何"看起来高级但不在这 5 维里"的改动，延后。

---

## 四、禁区

以下类型的工作**不要主动做**，除非明显服务于上面 5 维：

- 纯视觉优化（暗色模式、字体调整等，除非阻碍 CEO 下决策）
- 技术炫技（引入新框架、新状态管理，除非旧方案阻碍商业化）
- 功能膨胀（加一堆没人用的页面）
- 过度抽象（在第一个商业化用户落地前搞多租户）

---

## 五、商业化里程碑（对外可讲的故事）

| 里程碑 | 含义 | 判定标准 |
|---|---|---|
| **M0 系统会动** | 自主运行 >= 40 | heartbeat 每天自动跑一轮，不需要 CEO 干预 |
| **M1 挣到第一块钱** | 自主盈利 >= 40 | `revenues` 表出现第一条真实营收，ROI > 0 |
| **M2 能卖给别人** | 可商业化 >= 60 | 别的一人公司 `git clone` + `bat` 启动即可跑起来 |
| **M3 被别人买单** | 综合 >= 70 + 外部付费用户 >= 1 | 第一个非 CEO 用户真实付费 |
| **M4 规模化** | 综合 >= 85 | ≥ 10 个付费用户，系统承载无压力 |

---

## 六、锚定方式

- 本文件路径固定：`docs/NORTH-STAR.md`
- 在 `README.md` 顶部设置链接，所有新 contributor 必读
- 在 `src/services/performanceV2Service.ts`（北极星评分服务）的顶部注释链接此文件
- 每周评分报告 header 必须附"对齐北极星" checklist

---

_最后更新：2026-04-23，由 CEO 亲自锚定。_
