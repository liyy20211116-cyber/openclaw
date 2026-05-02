/**
 * Buyer-facing Commercial Readiness Report (Step D / Day 3).
 *
 * 输入：snapshot + config
 * 输出：一份可直接发给潜在买家或投资人的 Markdown 一页纸：
 *   - 北极星 5 维团队均分 + 公司商业就绪 grade
 *   - 盈利边界（一单赚多少 / 多少单/月即平衡 / 当前烧钱速率）
 *   - 商业化里程碑达成情况（M0~M4）
 *   - Top performer / 待改进维度
 *   - 数据生成时间 + 对齐北极星 checklist
 */
import type { AppConfig } from './configService'
import type {
  AppSnapshot,
  BusinessLine,
  CommercialDimensionKey,
  PerformanceGrade,
} from '../types'
import {
  COMMERCIAL_DIMENSIONS,
  computeCommercialReadinessReport,
} from './performanceV2Service'
import {
  buildProfitabilityBoundary,
} from './profitabilityService'

export type Milestone = 'M0' | 'M1' | 'M2' | 'M3' | 'M4'

export interface CommercialReadinessExportSummary {
  reviewedAt: string
  companyName: string
  ceoName: string
  companyReadinessScore: number
  companyReadinessGrade: PerformanceGrade
  teamCount: number
  topPerformer: string
  needsAttentionDims: CommercialDimensionKey[]
  dimensionAverages: Record<CommercialDimensionKey, number>
  milestones: Record<Milestone, { reached: boolean; note: string }>
  profitability: {
    hasData: boolean
    currentRevenue: number
    currentCostFiat: number
    currentNetProfit: number
    monthlyFiatSpend: number
    headline: string
    bestBreakEven: { name: string; ordersNeededPerMonth: number; ordersPerWeek: number; feasibilityNote: string } | null
  }
  paidUsers: number
}

const DIMENSION_MAX = 20

const MILESTONE_RULES: Record<Milestone, {
  label: string
  test: (input: {
    summary: CommercialReadinessExportSummary
    snapshot: AppSnapshot
  }) => { reached: boolean; note: string }
}> = {
  M0: {
    label: 'M0 系统会动',
    test: ({ summary }) => {
      const score = summary.dimensionAverages.autonomy
      const reached = (score / DIMENSION_MAX) * 100 >= 40
      return {
        reached,
        note: `Autonomy 团队均分 ${score.toFixed(1)}/${DIMENSION_MAX}（折合 ${((score / DIMENSION_MAX) * 100).toFixed(0)}/100），门槛 40`,
      }
    },
  },
  M1: {
    label: 'M1 挣到第一块钱',
    test: ({ summary }) => {
      const reached = summary.profitability.currentRevenue > 0 && summary.profitability.currentNetProfit > 0
      return {
        reached,
        note: summary.profitability.currentRevenue > 0
          ? `已产生 ¥${summary.profitability.currentRevenue.toFixed(2)} 收入，净利 ${summary.profitability.currentNetProfit >= 0 ? '+' : ''}¥${summary.profitability.currentNetProfit.toFixed(2)}`
          : '尚未产生真实营收（revenues 表为空）',
      }
    },
  },
  M2: {
    label: 'M2 能卖给别人',
    test: ({ summary }) => {
      const score = summary.dimensionAverages.productization
      const reached = (score / DIMENSION_MAX) * 100 >= 60
      return {
        reached,
        note: `Productization 团队均分 ${score.toFixed(1)}/${DIMENSION_MAX}（折合 ${((score / DIMENSION_MAX) * 100).toFixed(0)}/100），门槛 60`,
      }
    },
  },
  M3: {
    label: 'M3 被别人买单',
    test: ({ summary }) => {
      const reached = summary.companyReadinessScore >= 70 && summary.paidUsers >= 1
      return {
        reached,
        note: `综合 ${summary.companyReadinessScore.toFixed(1)}/100（门槛 70）+ 外部付费用户 ${summary.paidUsers}（门槛 1）`,
      }
    },
  },
  M4: {
    label: 'M4 规模化',
    test: ({ summary }) => {
      const reached = summary.companyReadinessScore >= 85 && summary.paidUsers >= 10
      return {
        reached,
        note: `综合 ${summary.companyReadinessScore.toFixed(1)}/100（门槛 85）+ 外部付费用户 ${summary.paidUsers}（门槛 10）`,
      }
    },
  },
}

function gradeIcon(grade: PerformanceGrade): string {
  switch (grade) {
    case 'S': return '🟣'
    case 'A': return '🟢'
    case 'B': return '🔵'
    case 'C': return '🟡'
    default: return '🔴'
  }
}

function dimensionLabel(key: CommercialDimensionKey): string {
  const found = COMMERCIAL_DIMENSIONS.find((dim) => dim.key === key)
  return found?.label ?? key
}

function countPaidUsers(snapshot: AppSnapshot): number {
  const externalRevenues = snapshot.revenues.filter((rev) => {
    const text = `${rev.title ?? ''} ${rev.sourceTask ?? ''}`.toLowerCase()
    return !text.includes('test') && !text.includes('demo') && !text.includes('mock')
  })
  return externalRevenues.length
}

export function buildCommercialReadinessSummary(
  snapshot: AppSnapshot,
  config: AppConfig | null,
  businessLines: BusinessLine[] = snapshot.businessLines ?? [],
  referenceDate = new Date(),
): CommercialReadinessExportSummary {
  const v2 = computeCommercialReadinessReport(snapshot, config, referenceDate)
  const boundary = buildProfitabilityBoundary(snapshot, businessLines, referenceDate)

  const bestBreakEven = boundary.breakEven
    .filter((point) => Number.isFinite(point.ordersNeededPerMonth) && point.ordersNeededPerMonth > 0)
    .sort((left, right) => left.ordersNeededPerMonth - right.ordersNeededPerMonth)[0] ?? null

  const partialSummary: CommercialReadinessExportSummary = {
    reviewedAt: referenceDate.toISOString(),
    companyName: config?.company?.name ?? '一人公司',
    ceoName: config?.company?.ceo_name ?? 'CEO',
    companyReadinessScore: v2.summary.companyReadinessScore,
    companyReadinessGrade: v2.summary.companyReadinessGrade,
    teamCount: v2.summary.count,
    topPerformer: v2.summary.topPerformer,
    needsAttentionDims: COMMERCIAL_DIMENSIONS
      .map((dim) => dim.key)
      .filter((key) => (v2.summary.dimensionAverages[key] / DIMENSION_MAX) * 100 < 40),
    dimensionAverages: v2.summary.dimensionAverages,
    milestones: { M0: { reached: false, note: '' }, M1: { reached: false, note: '' }, M2: { reached: false, note: '' }, M3: { reached: false, note: '' }, M4: { reached: false, note: '' } },
    profitability: {
      hasData: boundary.hasData,
      currentRevenue: boundary.currentRevenue,
      currentCostFiat: boundary.currentCostFiat,
      currentNetProfit: boundary.currentNetProfit,
      monthlyFiatSpend: boundary.dailyBurn.monthlyFiatSpend,
      headline: boundary.headline,
      bestBreakEven: bestBreakEven
        ? {
            name: bestBreakEven.name,
            ordersNeededPerMonth: bestBreakEven.ordersNeededPerMonth,
            ordersPerWeek: bestBreakEven.ordersPerWeek,
            feasibilityNote: bestBreakEven.feasibilityNote,
          }
        : null,
    },
    paidUsers: countPaidUsers(snapshot),
  }

  for (const [key, rule] of Object.entries(MILESTONE_RULES) as Array<[Milestone, typeof MILESTONE_RULES[Milestone]]>) {
    partialSummary.milestones[key] = rule.test({ summary: partialSummary, snapshot })
  }

  return partialSummary
}

function renderDimensionTable(summary: CommercialReadinessExportSummary): string {
  const rows = COMMERCIAL_DIMENSIONS.map((dim) => {
    const score = summary.dimensionAverages[dim.key]
    const pct = ((score / DIMENSION_MAX) * 100).toFixed(0)
    const status = (score / DIMENSION_MAX) * 100 >= 70
      ? '✅'
      : (score / DIMENSION_MAX) * 100 >= 40
        ? '🟡'
        : '🔴'
    return `| ${status} | ${dim.label} (${dim.key}) | ${score.toFixed(1)} / ${DIMENSION_MAX} | ${pct} / 100 |`
  })
  return [
    '| 状态 | 维度 | 团队均分 | 折合百分制 |',
    '|:---:|---|:---:|:---:|',
    ...rows,
  ].join('\n')
}

function renderMilestonesTable(summary: CommercialReadinessExportSummary): string {
  const rows = (Object.entries(MILESTONE_RULES) as Array<[Milestone, typeof MILESTONE_RULES[Milestone]]>)
    .map(([key, rule]) => {
      const milestone = summary.milestones[key]
      const icon = milestone.reached ? '✅' : '⬜️'
      return `| ${icon} | ${rule.label} | ${milestone.note} |`
    })
  return [
    '| | 里程碑 | 当前状态 |',
    '|:---:|---|---|',
    ...rows,
  ].join('\n')
}

function renderHeader(summary: CommercialReadinessExportSummary): string {
  const dateLabel = summary.reviewedAt.slice(0, 10)
  return `# ${summary.companyName} · 商业化就绪报告

> 数据快照时间：${summary.reviewedAt.replace('T', ' ').slice(0, 19)} (UTC)
> CEO：${summary.ceoName}
> 团队规模：${summary.teamCount} 个 Agent
> 综合就绪分：**${summary.companyReadinessScore.toFixed(1)} / 100**　${gradeIcon(summary.companyReadinessGrade)} **${summary.companyReadinessGrade}**

> 评分锚点：[北极星 NORTH-STAR.md](../docs/NORTH-STAR.md)（${dateLabel}）`
}

function renderProfitabilitySection(summary: CommercialReadinessExportSummary): string {
  const profit = summary.profitability
  const lines: string[] = ['## 二、盈利边界（Boundary）', '', `> ${profit.headline}`, '']

  lines.push('| 指标 | 数值 |')
  lines.push('|---|---:|')
  lines.push(`| 累计收入 | ¥${profit.currentRevenue.toFixed(2)} |`)
  lines.push(`| 累计开销（折合 ¥） | ¥${profit.currentCostFiat.toFixed(2)} |`)
  lines.push(`| 净利润 | ${profit.currentNetProfit >= 0 ? '+' : ''}¥${profit.currentNetProfit.toFixed(2)} |`)
  lines.push(`| 当前预估每月烧钱 | ¥${profit.monthlyFiatSpend.toFixed(2)} |`)

  if (profit.bestBreakEven) {
    const be = profit.bestBreakEven
    lines.push('')
    lines.push(`**最易盈亏平衡的业务线**：${be.name} —— 每月需要 **${be.ordersNeededPerMonth.toFixed(1)} 单**（约每周 ${be.ordersPerWeek.toFixed(1)} 单）即可覆盖当前烧钱速率。`)
    lines.push('')
    lines.push(`> ${be.feasibilityNote}`)
  } else {
    lines.push('')
    lines.push('> 暂无业务线产出可计算盈亏平衡的单位经济（请在 `config/business-lines.json` 或前端业务线管理中先完善定价/成本结构）。')
  }

  if (!profit.hasData) {
    lines.push('')
    lines.push('> ⚠️ 当前 ledger / revenues 表为空，盈利边界基于业务线**理论值**估算，不反映真实流水。')
  }

  return lines.join('\n')
}

function renderNorthStarChecklist(summary: CommercialReadinessExportSummary): string {
  const lines: string[] = ['## 五、对齐北极星 Checklist', '']
  for (const dim of COMMERCIAL_DIMENSIONS) {
    const score = summary.dimensionAverages[dim.key]
    const pct = (score / DIMENSION_MAX) * 100
    const mark = pct >= 60 ? '☑' : '☐'
    lines.push(`- ${mark} ${dim.label}（${dim.key}）：${pct.toFixed(0)} / 100`)
  }
  lines.push('')
  lines.push('> 北极星原则：任何让上述维度上升的改动都值得做；任何看起来高级但不在 5 维内的改动应延后。')
  return lines.join('\n')
}

export function renderCommercialReadinessMarkdown(summary: CommercialReadinessExportSummary): string {
  const sections: string[] = []
  sections.push(renderHeader(summary))
  sections.push('---')

  sections.push(`## 一、北极星 5 维团队均分

${renderDimensionTable(summary)}

- 头号选手：**${summary.topPerformer || '尚未产生显著领先者'}**
${summary.needsAttentionDims.length > 0 ? `- 需重点改进维度：${summary.needsAttentionDims.map(dimensionLabel).join('、')}` : '- 暂无低于 40 分的明显短板维度'}`)

  sections.push(renderProfitabilitySection(summary))

  sections.push(`## 三、商业化里程碑

${renderMilestonesTable(summary)}`)

  sections.push(`## 四、对外口径建议

- ${summary.companyReadinessGrade === 'S' || summary.companyReadinessGrade === 'A'
    ? '可作为「一人公司商业化模板」对外展示，建议同步对接潜在付费用户进入闭环。'
    : summary.companyReadinessGrade === 'B'
      ? '可作为 Demo 演示，但售前承诺需控制范围；优先补齐评分中标记 🔴 的维度。'
      : '建议暂缓对外签单；先把评分中标记 🔴 的维度推到 ≥ 60，再启动正式售前。'}
- ${summary.profitability.currentRevenue > 0 ? '已有真实营收数据，可作为案例摘要披露。' : '暂无真实营收，建议优先以「试点合作」或「免费内测」方式落地第一单。'}`)

  sections.push(renderNorthStarChecklist(summary))
  sections.push(`---

_本报告由 \`scripts/export-commercial-readiness.ts\` 自动生成；数据来源：本机 \`prisma\` 数据库 + \`config/app-config.json\`。_`)

  return sections.join('\n\n')
}

export function buildCommercialReadinessReport(
  snapshot: AppSnapshot,
  config: AppConfig | null,
  businessLines: BusinessLine[] = snapshot.businessLines ?? [],
  referenceDate = new Date(),
): { summary: CommercialReadinessExportSummary; markdown: string } {
  const summary = buildCommercialReadinessSummary(snapshot, config, businessLines, referenceDate)
  const markdown = renderCommercialReadinessMarkdown(summary)
  return { summary, markdown }
}
