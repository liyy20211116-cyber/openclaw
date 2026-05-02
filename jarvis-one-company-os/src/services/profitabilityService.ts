import { getSnapshot } from '../lib/snapshotStore'
import type {
  Agent,
  AppSnapshot,
  BusinessLine,
  LedgerItem,
  RevenueItem,
  TaskItem,
} from '../types'
import { businessLineService } from './businessLineService'

export const TOKEN_TO_FIAT_RATE = 0.15

export interface UnitEconomics {
  businessLineId: string
  name: string
  status: 'active' | 'planning' | 'paused'
  tiers: Array<{
    name: string
    price: number
    unitCostToken: number
    unitCostFiat: number
    unitProfit: number
    grossMargin: number
  }>
  avgUnitPrice: number
  avgUnitCostFiat: number
  avgUnitProfit: number
  avgGrossMargin: number
}

export interface DailyBurn {
  weeklyTokenSpend: number
  weeklyFiatSpend: number
  dailyTokenSpend: number
  dailyFiatSpend: number
  monthlyFiatSpend: number
  sampleDays: number
}

export interface WeeklyBurnComparison {
  currentWeekTokenSpend: number
  currentWeekFiatSpend: number
  previousWeekTokenSpend: number
  previousWeekFiatSpend: number
  deltaTokenSpend: number
  deltaFiatSpend: number
  deltaPercent: number | null
  trend: 'up' | 'down' | 'flat'
}

export interface BreakEvenPoint {
  businessLineId: string
  name: string
  avgUnitProfit: number
  monthlyFiatSpend: number
  ordersNeededPerMonth: number
  ordersPerWeek: number
  feasibilityNote: string
}

export interface AgentRPC {
  agentId: string
  name: string
  role: string
  spentToken: number
  spentFiat: number
  attributedRevenue: number
  netContribution: number
  rpc: number | null
  completedTasks: number
  totalTasks: number
  completionRate: number
  classification: 'engine' | 'neutral' | 'leak' | 'unknown'
  note: string
}

export interface TaskPnL {
  taskId: string
  title: string
  owner: string
  status: TaskItem['status']
  spentToken: number
  spentFiat: number
  attributedRevenue: number
  profit: number
}

export interface ProfitabilityBoundary {
  hasData: boolean
  currentRevenue: number
  currentCostFiat: number
  currentNetProfit: number
  dailyBurn: DailyBurn
  weeklyBurn: WeeklyBurnComparison
  unitEconomics: UnitEconomics[]
  breakEven: BreakEvenPoint[]
  agentRPC: AgentRPC[]
  taskPnL: TaskPnL[]
  profitEngines: AgentRPC[]
  profitLeaks: AgentRPC[]
  headline: string
}

export interface WhatIfScenarioInput {
  businessLineId: string
  priceDeltaPercent: number
  costDeltaPercent: number
}

export interface WhatIfScenarioResult {
  baseBoundary: ProfitabilityBoundary
  scenarioBoundary: ProfitabilityBoundary
  target: {
    businessLineId: string
    name: string
    before: {
      avgUnitPrice: number
      avgUnitCostFiat: number
      avgUnitProfit: number
      ordersNeededPerMonth: number
      ordersPerWeek: number
      grossMargin: number
    }
    after: {
      avgUnitPrice: number
      avgUnitCostFiat: number
      avgUnitProfit: number
      ordersNeededPerMonth: number
      ordersPerWeek: number
      grossMargin: number
    }
  }
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits))
}

function parseDate(value: string): Date | null {
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function cloneBusinessLines(businessLines: BusinessLine[]): BusinessLine[] {
  return businessLines.map((line) => ({
    ...line,
    pricingTiers: line.pricingTiers.map((tier) => ({ ...tier })),
    costStructure: line.costStructure.map((item) => ({ ...item })),
  }))
}

function getBusinessLines(snapshot: AppSnapshot, provided?: BusinessLine[]): BusinessLine[] {
  if (provided && provided.length > 0) return provided
  if (snapshot.businessLines && snapshot.businessLines.length > 0) return snapshot.businessLines
  return businessLineService.getAll()
}

function computeUnitEconomicsFor(businessLine: BusinessLine): UnitEconomics {
  const totalCostToken = businessLine.costStructure.reduce((sum, item) => sum + item.tokenCost, 0)
  const totalCostFiat = businessLine.costStructure.reduce((sum, item) => sum + item.fiatCost, 0) + totalCostToken * TOKEN_TO_FIAT_RATE

  const tiers = businessLine.pricingTiers.map((tier) => {
    const unitProfit = tier.price - totalCostFiat
    return {
      name: tier.name,
      price: round(tier.price),
      unitCostToken: round(totalCostToken),
      unitCostFiat: round(totalCostFiat),
      unitProfit: round(unitProfit),
      grossMargin: tier.price > 0 ? round((unitProfit / tier.price) * 100, 1) : 0,
    }
  })

  const avgUnitPrice = tiers.length > 0 ? tiers.reduce((sum, tier) => sum + tier.price, 0) / tiers.length : 0
  const avgUnitCostFiat = totalCostFiat
  const avgUnitProfit = avgUnitPrice - avgUnitCostFiat
  const avgGrossMargin = avgUnitPrice > 0 ? (avgUnitProfit / avgUnitPrice) * 100 : 0

  return {
    businessLineId: businessLine.id,
    name: businessLine.name,
    status: businessLine.status,
    tiers,
    avgUnitPrice: round(avgUnitPrice),
    avgUnitCostFiat: round(avgUnitCostFiat),
    avgUnitProfit: round(avgUnitProfit),
    avgGrossMargin: round(avgGrossMargin, 1),
  }
}

function computeDailyBurn(ledger: LedgerItem[]): DailyBurn {
  const negatives = ledger.filter((item) => item.amount < 0)
  if (negatives.length === 0) {
    return {
      weeklyTokenSpend: 0,
      weeklyFiatSpend: 0,
      dailyTokenSpend: 0,
      dailyFiatSpend: 0,
      monthlyFiatSpend: 0,
      sampleDays: 0,
    }
  }

  const timestamps = negatives
    .map((item) => parseDate(item.createdAt)?.getTime() ?? NaN)
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right)

  const spanMs = timestamps.length >= 2 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
  const sampleDays = Math.max(1, Math.round(spanMs / (1000 * 60 * 60 * 24)))

  const totalToken = Math.abs(negatives.reduce((sum, item) => sum + item.amount, 0))
  const dailyTokenSpend = totalToken / sampleDays
  const dailyFiatSpend = dailyTokenSpend * TOKEN_TO_FIAT_RATE

  return {
    weeklyTokenSpend: Math.round(dailyTokenSpend * 7),
    weeklyFiatSpend: round(dailyFiatSpend * 7),
    dailyTokenSpend: Math.round(dailyTokenSpend),
    dailyFiatSpend: round(dailyFiatSpend),
    monthlyFiatSpend: round(dailyFiatSpend * 30),
    sampleDays,
  }
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  const weekday = copy.getDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  copy.setDate(copy.getDate() + delta)
  return copy
}

function sumNegativeSpendForRange(ledger: LedgerItem[], start: Date, end: Date): number {
  return Math.abs(ledger.reduce((sum, item) => {
    if (item.amount >= 0) return sum
    const createdAt = parseDate(item.createdAt)
    if (!createdAt) return sum
    return createdAt >= start && createdAt < end ? sum + item.amount : sum
  }, 0))
}

export function computeWeeklyBurnComparison(
  ledger: LedgerItem[],
  referenceDate = new Date(),
): WeeklyBurnComparison {
  const currentWeekStart = startOfWeek(referenceDate)
  const previousWeekStart = new Date(currentWeekStart)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  const nextWeekStart = new Date(currentWeekStart)
  nextWeekStart.setDate(nextWeekStart.getDate() + 7)

  const currentWeekTokenSpend = sumNegativeSpendForRange(ledger, currentWeekStart, nextWeekStart)
  const previousWeekTokenSpend = sumNegativeSpendForRange(ledger, previousWeekStart, currentWeekStart)
  const currentWeekFiatSpend = round(currentWeekTokenSpend * TOKEN_TO_FIAT_RATE)
  const previousWeekFiatSpend = round(previousWeekTokenSpend * TOKEN_TO_FIAT_RATE)
  const deltaTokenSpend = currentWeekTokenSpend - previousWeekTokenSpend
  const deltaFiatSpend = round(currentWeekFiatSpend - previousWeekFiatSpend)
  const deltaPercent = previousWeekFiatSpend > 0
    ? round((deltaFiatSpend / previousWeekFiatSpend) * 100, 1)
    : currentWeekFiatSpend > 0
      ? 100
      : null
  const trend = deltaFiatSpend > 0 ? 'up' : deltaFiatSpend < 0 ? 'down' : 'flat'

  return {
    currentWeekTokenSpend,
    currentWeekFiatSpend,
    previousWeekTokenSpend,
    previousWeekFiatSpend,
    deltaTokenSpend,
    deltaFiatSpend,
    deltaPercent,
    trend,
  }
}

function computeBreakEven(unitEconomics: UnitEconomics[], monthlyFiatSpend: number): BreakEvenPoint[] {
  return unitEconomics.map((item) => {
    const ordersNeededPerMonth = item.avgUnitProfit > 0 && monthlyFiatSpend > 0
      ? Math.ceil(monthlyFiatSpend / item.avgUnitProfit)
      : 0
    const ordersPerWeek = ordersNeededPerMonth > 0 ? round(ordersNeededPerMonth / 4, 1) : 0

    let feasibilityNote = ''
    if (item.avgUnitProfit <= 0) {
      feasibilityNote = '单单亏损，先调定价或降成本。'
    } else if (monthlyFiatSpend === 0) {
      feasibilityNote = '暂无真实烧钱数据，先跑通真实流水。'
    } else if (ordersPerWeek <= 1) {
      feasibilityNote = '每周 1 单左右即可覆盖，优先验证。'
    } else if (ordersPerWeek <= 3) {
      feasibilityNote = '每周 2-3 单，难度中等。'
    } else if (ordersPerWeek <= 7) {
      feasibilityNote = '接近每日 1 单，对产能有压力。'
    } else {
      feasibilityNote = '单线难独立覆盖，需要多业务线叠加。'
    }

    return {
      businessLineId: item.businessLineId,
      name: item.name,
      avgUnitProfit: item.avgUnitProfit,
      monthlyFiatSpend: round(monthlyFiatSpend),
      ordersNeededPerMonth,
      ordersPerWeek,
      feasibilityNote,
    }
  })
}

function computeAgentRPC(
  agents: Agent[],
  tasks: TaskItem[],
  ledger: LedgerItem[],
  revenues: RevenueItem[],
): AgentRPC[] {
  const revenueByOwner = new Map<string, number>()
  for (const revenue of revenues) {
    const matchedTask = tasks.find((task) => task.title === revenue.sourceTask)
    if (!matchedTask) continue
    revenueByOwner.set(matchedTask.owner, (revenueByOwner.get(matchedTask.owner) ?? 0) + revenue.amount)
  }

  const ledgerByActor = new Map<string, number>()
  for (const item of ledger) {
    if (item.amount >= 0) continue
    ledgerByActor.set(item.actor, (ledgerByActor.get(item.actor) ?? 0) + Math.abs(item.amount))
  }

  return agents
    .filter((agent) => agent.id !== 'ceo')
    .map((agent) => {
      const agentTasks = tasks.filter((task) => task.ownerAgentId === agent.id || task.owner === agent.name)
      const spentToken = agentTasks.reduce((sum, task) => sum + task.spentToken, 0)
        + (ledgerByActor.get(agent.name) ?? 0)
        + (ledgerByActor.get(agent.id) ?? 0)
      const spentFiat = spentToken * TOKEN_TO_FIAT_RATE
      const attributedRevenue = revenueByOwner.get(agent.name) ?? 0
      const netContribution = attributedRevenue - spentFiat
      const completedTasks = agentTasks.filter((task) => task.status === 'completed').length
      const rpc = spentFiat > 0 ? round(attributedRevenue / spentFiat) : null

      let classification: AgentRPC['classification'] = 'unknown'
      let note = ''
      if (spentToken === 0 && attributedRevenue === 0) {
        note = '暂无数据'
      } else if (attributedRevenue === 0 && spentFiat > 50) {
        classification = 'leak'
        note = '有成本但没有收入归因。'
      } else if (attributedRevenue === 0) {
        classification = 'neutral'
        note = '有消耗，但规模还小。'
      } else if (rpc != null && rpc >= 2) {
        classification = 'engine'
        note = `每花 1 元带来 ${rpc} 元收入。`
      } else if (rpc != null && rpc >= 1) {
        classification = 'neutral'
        note = '已接近盈亏平衡。'
      } else {
        classification = 'leak'
        note = '收入低于成本。'
      }

      return {
        agentId: agent.id,
        name: agent.name,
        role: agent.role,
        spentToken,
        spentFiat: round(spentFiat),
        attributedRevenue: round(attributedRevenue),
        netContribution: round(netContribution),
        rpc,
        completedTasks,
        totalTasks: agentTasks.length,
        completionRate: agentTasks.length > 0 ? round((completedTasks / agentTasks.length) * 100, 1) : 0,
        classification,
        note,
      }
    })
}

function computeTaskPnL(tasks: TaskItem[], revenues: RevenueItem[]): TaskPnL[] {
  return tasks
    .map((task) => {
      const revenue = revenues.find((item) => item.sourceTask === task.title)
      const attributedRevenue = revenue?.amount ?? 0
      const spentFiat = task.spentToken * TOKEN_TO_FIAT_RATE
      return {
        taskId: task.id,
        title: task.title,
        owner: task.owner,
        status: task.status,
        spentToken: task.spentToken,
        spentFiat: round(spentFiat),
        attributedRevenue: round(attributedRevenue),
        profit: round(attributedRevenue - spentFiat),
      }
    })
    .filter((item) => item.spentToken > 0 || item.attributedRevenue > 0)
    .sort((left, right) => right.profit - left.profit)
}

function buildHeadline(currentNetProfit: number, dailyBurn: DailyBurn, breakEven: BreakEvenPoint[]): string {
  if (dailyBurn.dailyFiatSpend === 0 && currentNetProfit === 0) {
    return '还没有真实流水，先跑通 1 条“任务 -> 消耗 -> 交付 -> 收入”链路。'
  }

  const feasible = breakEven
    .filter((item) => item.avgUnitProfit > 0 && item.ordersNeededPerMonth > 0)
    .sort((left, right) => left.ordersNeededPerMonth - right.ordersNeededPerMonth)

  if (feasible.length === 0) {
    return `当前日烧钱 ¥${dailyBurn.dailyFiatSpend.toFixed(2)}，但所有业务线平均单单利润 <= 0。`
  }

  const top = feasible[0]
  if (currentNetProfit >= 0) {
    return `当前已盈利 ¥${currentNetProfit.toFixed(2)}，优先继续放大 ${top.name}。`
  }

  return `${top.name} 还需 ${top.ordersNeededPerMonth} 单/月，才能覆盖当前 ¥${dailyBurn.monthlyFiatSpend.toFixed(0)}/月烧钱。`
}

export function buildProfitabilityBoundary(
  snapshot: AppSnapshot,
  businessLines = getBusinessLines(snapshot),
  referenceDate = new Date(),
): ProfitabilityBoundary {
  const tasks = snapshot.tasks
  const ledger = snapshot.ledger
  const revenues = snapshot.revenues
  const agents = snapshot.agents

  const currentRevenue = revenues.reduce((sum, item) => sum + item.amount, 0)
  const currentCostToken = Math.abs(ledger.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0))
  const currentCostFiat = round(currentCostToken * TOKEN_TO_FIAT_RATE)
  const currentNetProfit = round(currentRevenue - currentCostFiat)

  const unitEconomics = businessLines.map(computeUnitEconomicsFor)
  const dailyBurn = computeDailyBurn(ledger)
  const weeklyBurn = computeWeeklyBurnComparison(ledger, referenceDate)
  const breakEven = computeBreakEven(unitEconomics, dailyBurn.monthlyFiatSpend)
  const agentRPC = computeAgentRPC(agents, tasks, ledger, revenues)
  const taskPnL = computeTaskPnL(tasks, revenues)

  const profitEngines = agentRPC
    .filter((item) => item.classification === 'engine')
    .sort((left, right) => (right.rpc ?? 0) - (left.rpc ?? 0))
    .slice(0, 5)
  const profitLeaks = agentRPC
    .filter((item) => item.classification === 'leak')
    .sort((left, right) => right.spentFiat - left.spentFiat)
    .slice(0, 5)

  return {
    hasData: ledger.length > 0 || revenues.length > 0 || tasks.some((task) => task.spentToken > 0),
    currentRevenue: round(currentRevenue),
    currentCostFiat,
    currentNetProfit,
    dailyBurn,
    weeklyBurn,
    unitEconomics,
    breakEven,
    agentRPC,
    taskPnL,
    profitEngines,
    profitLeaks,
    headline: buildHeadline(currentNetProfit, dailyBurn, breakEven),
  }
}

export function simulateBoundaryWhatIf(
  snapshot: AppSnapshot,
  businessLines: BusinessLine[],
  scenario: WhatIfScenarioInput,
  referenceDate = new Date(),
): WhatIfScenarioResult {
  const baseBoundary = buildProfitabilityBoundary(snapshot, businessLines, referenceDate)
  const scenarioLines = cloneBusinessLines(businessLines)
  const targetLine = scenarioLines.find((line) => line.id === scenario.businessLineId)

  if (!targetLine) {
    throw new Error(`Unknown business line: ${scenario.businessLineId}`)
  }

  const priceFactor = 1 + scenario.priceDeltaPercent / 100
  const costFactor = 1 + scenario.costDeltaPercent / 100

  targetLine.pricingTiers = targetLine.pricingTiers.map((tier) => ({
    ...tier,
    price: round(tier.price * priceFactor),
  }))
  targetLine.costStructure = targetLine.costStructure.map((item) => ({
    ...item,
    tokenCost: round(item.tokenCost * costFactor),
    fiatCost: round(item.fiatCost * costFactor),
  }))

  const scenarioBoundary = buildProfitabilityBoundary(snapshot, scenarioLines, referenceDate)
  const beforeEconomics = baseBoundary.unitEconomics.find((item) => item.businessLineId === scenario.businessLineId)
  const afterEconomics = scenarioBoundary.unitEconomics.find((item) => item.businessLineId === scenario.businessLineId)
  const beforeBreakEven = baseBoundary.breakEven.find((item) => item.businessLineId === scenario.businessLineId)
  const afterBreakEven = scenarioBoundary.breakEven.find((item) => item.businessLineId === scenario.businessLineId)

  if (!beforeEconomics || !afterEconomics || !beforeBreakEven || !afterBreakEven) {
    throw new Error(`Incomplete scenario data for: ${scenario.businessLineId}`)
  }

  return {
    baseBoundary,
    scenarioBoundary,
    target: {
      businessLineId: scenario.businessLineId,
      name: beforeEconomics.name,
      before: {
        avgUnitPrice: beforeEconomics.avgUnitPrice,
        avgUnitCostFiat: beforeEconomics.avgUnitCostFiat,
        avgUnitProfit: beforeEconomics.avgUnitProfit,
        ordersNeededPerMonth: beforeBreakEven.ordersNeededPerMonth,
        ordersPerWeek: beforeBreakEven.ordersPerWeek,
        grossMargin: beforeEconomics.avgGrossMargin,
      },
      after: {
        avgUnitPrice: afterEconomics.avgUnitPrice,
        avgUnitCostFiat: afterEconomics.avgUnitCostFiat,
        avgUnitProfit: afterEconomics.avgUnitProfit,
        ordersNeededPerMonth: afterBreakEven.ordersNeededPerMonth,
        ordersPerWeek: afterBreakEven.ordersPerWeek,
        grossMargin: afterEconomics.avgGrossMargin,
      },
    },
  }
}

function formatDelta(amount: number): string {
  if (amount > 0) return `+¥${amount.toFixed(2)}`
  if (amount < 0) return `-¥${Math.abs(amount).toFixed(2)}`
  return '¥0.00'
}

export function buildProfitabilityWeeklyReport(
  snapshot: AppSnapshot,
  businessLines = getBusinessLines(snapshot),
  referenceDate = new Date(),
): string {
  const boundary = buildProfitabilityBoundary(snapshot, businessLines, referenceDate)
  const topBreakEven = boundary.breakEven
    .filter((item) => item.avgUnitProfit > 0 && item.ordersNeededPerMonth > 0)
    .sort((left, right) => left.ordersNeededPerMonth - right.ordersNeededPerMonth)[0]
  const engines = boundary.profitEngines.slice(0, 3)
  const leaks = boundary.profitLeaks.slice(0, 3)

  const breakEvenSection = topBreakEven
    ? `- 最近的盈亏平衡线：${topBreakEven.name}，约 ${topBreakEven.ordersNeededPerMonth} 单/月（${topBreakEven.ordersPerWeek} 单/周）`
    : '- 当前没有可计算的盈亏平衡线'

  const engineLines = engines.length > 0
    ? engines.map((item) => `- ${item.name}: RPC ${item.rpc ?? '-'}，净贡献 ¥${item.netContribution.toFixed(2)}`).join('\n')
    : '- 暂无明显利润引擎'

  const leakLines = leaks.length > 0
    ? leaks.map((item) => `- ${item.name}: 花费 ¥${item.spentFiat.toFixed(2)}，收入 ¥${item.attributedRevenue.toFixed(2)}`).join('\n')
    : '- 暂无明显利润黑洞'

  const unitLines = boundary.unitEconomics
    .map((item) => `- ${item.name}: 平均客单价 ¥${item.avgUnitPrice.toFixed(0)}，平均单单利润 ¥${item.avgUnitProfit.toFixed(0)}，毛利率 ${item.avgGrossMargin.toFixed(1)}%`)
    .join('\n')

  return [
    `# 盈利边界周报 ${referenceDate.toISOString().slice(0, 10)}`,
    '',
    '## CEO 摘要',
    `- Headline: ${boundary.headline}`,
    `- 累计收入: ¥${boundary.currentRevenue.toFixed(2)}`,
    `- 累计成本: ¥${boundary.currentCostFiat.toFixed(2)}`,
    `- 当前净利润: ¥${boundary.currentNetProfit.toFixed(2)}`,
    '',
    '## 本周烧钱速率',
    `- 本周: ¥${boundary.weeklyBurn.currentWeekFiatSpend.toFixed(2)}`,
    `- 上周: ¥${boundary.weeklyBurn.previousWeekFiatSpend.toFixed(2)}`,
    `- 环比: ${formatDelta(boundary.weeklyBurn.deltaFiatSpend)}${boundary.weeklyBurn.deltaPercent != null ? ` (${boundary.weeklyBurn.deltaPercent}%)` : ''}`,
    '',
    '## 盈亏平衡',
    breakEvenSection,
    '',
    '## 业务线单位经济',
    unitLines || '- 暂无业务线数据',
    '',
    '## 利润引擎',
    engineLines,
    '',
    '## 利润黑洞',
    leakLines,
    '',
  ].join('\n')
}

export const profitabilityService = {
  getBoundary(referenceDate = new Date()): ProfitabilityBoundary {
    const snapshot = getSnapshot()
    return buildProfitabilityBoundary(snapshot, getBusinessLines(snapshot), referenceDate)
  },

  getWeeklyBurnComparison(referenceDate = new Date()): WeeklyBurnComparison {
    return computeWeeklyBurnComparison(getSnapshot().ledger, referenceDate)
  },

  simulateWhatIf(scenario: WhatIfScenarioInput, referenceDate = new Date()): WhatIfScenarioResult {
    const snapshot = getSnapshot()
    return simulateBoundaryWhatIf(snapshot, getBusinessLines(snapshot), scenario, referenceDate)
  },

  buildWeeklyReport(referenceDate = new Date()): string {
    const snapshot = getSnapshot()
    return buildProfitabilityWeeklyReport(snapshot, getBusinessLines(snapshot), referenceDate)
  },
}
