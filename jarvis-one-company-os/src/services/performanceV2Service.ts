/**
 * North Star scoring v2.
 * Source of truth: ../../docs/NORTH-STAR.md
 *
 * Frontend v2 is intentionally "即时计算":
 * - revenue comes from profitabilityService
 * - task/compliance/ledger signals come from snapshot
 * - productization uses frontend-available proxy signals from app-config + agent metadata
 */
import { getSnapshot } from '../lib/snapshotStore'
import type { AppConfig, AgentConfig } from './configService'
import { getCachedConfig } from './configService'
import { buildProfitabilityBoundary } from './profitabilityService'
import type {
  Agent,
  AgentCommercialReadiness,
  AppSnapshot,
  CommercialDimensionKey,
  CommercialReadinessBreakdown,
  CommercialReadinessSummary,
  PerformanceGrade,
  TaskItem,
} from '../types'

export const COMMERCIAL_DIMENSIONS: Array<{ key: CommercialDimensionKey; label: string }> = [
  { key: 'autonomy', label: '自主运行' },
  { key: 'revenue_contribution', label: '自主盈利' },
  { key: 'intelligence', label: '聪明大脑' },
  { key: 'execution', label: '灵活手脚' },
  { key: 'productization', label: '可商业化' },
]

const DIMENSION_MAX = 20

interface CommercialReadinessReport {
  records: AgentCommercialReadiness[]
  summary: CommercialReadinessSummary
}

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function parseDueAt(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toGrade(score: number): PerformanceGrade {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 55) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function downgradeGrade(grade: PerformanceGrade): PerformanceGrade {
  switch (grade) {
    case 'S': return 'A'
    case 'A': return 'B'
    case 'B': return 'C'
    case 'C': return 'D'
    default: return 'D'
  }
}

function applyDimensionFloor(score: number, breakdown: CommercialReadinessBreakdown): PerformanceGrade {
  const baseGrade = toGrade(score)
  const hitFloor = Object.values(breakdown).some((value) => (value / DIMENSION_MAX) * 100 < 40)
  return hitFloor ? downgradeGrade(baseGrade) : baseGrade
}

function emptyBreakdown(): CommercialReadinessBreakdown {
  return {
    autonomy: 0,
    revenue_contribution: 0,
    intelligence: 0,
    execution: 0,
    productization: 0,
  }
}

function getAgentConfig(config: AppConfig | null | undefined, agentId: string): AgentConfig | null {
  return config?.agents.find((item) => item.id === agentId) ?? null
}

function getAgentTasks(snapshot: AppSnapshot, agent: Agent): TaskItem[] {
  return snapshot.tasks.filter((task) => task.ownerAgentId === agent.id || task.owner === agent.name)
}

function budgetFit(task: TaskItem): number {
  if (task.budgetToken <= 0) return task.spentToken <= 0 ? 1 : 0
  const ratio = task.spentToken / task.budgetToken
  return clamp(1 - Math.abs(1 - ratio))
}

function autonomyScore(tasks: TaskItem[], agent: Agent): number {
  if (tasks.length === 0) return 0
  const createdBySelfRate = tasks.filter((task) => {
    const createdEvent = task.timeline?.find((item) => item.type === 'created' || item.type === 'resubmitted')
    return createdEvent?.actor === agent.name
  }).length / tasks.length
  const flowRate = tasks.filter((task) => ['in_progress', 'review', 'completed'].includes(task.status)).length / tasks.length
  const independentRate = tasks.filter((task) => !task.requiresApproval).length / tasks.length
  return round(average([createdBySelfRate, flowRate, independentRate]) * DIMENSION_MAX)
}

function intelligenceScore(tasks: TaskItem[], complianceScore: number): number {
  if (tasks.length === 0) return 0
  const completionRate = tasks.filter((task) => task.status === 'completed').length / tasks.length
  const noFreezeRate = 1 - (tasks.filter((task) => task.status === 'frozen').length / tasks.length)
  const complianceRate = clamp(complianceScore / 100)
  return round(completionRate * noFreezeRate * complianceRate * DIMENSION_MAX)
}

function executionScore(tasks: TaskItem[], cfg: AgentConfig | null, referenceDate: Date): number {
  if (tasks.length === 0) return 0
  const onTimeRate = tasks.filter((task) => {
    if (task.status === 'completed') return true
    const dueAt = parseDueAt(task.dueAt)
    return dueAt ? dueAt >= referenceDate : false
  }).length / tasks.length
  const budgetFitRate = average(tasks.map(budgetFit))
  const typedTasks = tasks.filter((task) => task.taskType != null)
  const skillCoverageRate = typedTasks.length > 0
    ? typedTasks.filter((task) => cfg?.task_types.includes(task.taskType!)).length / typedTasks.length
    : clamp(((cfg?.capabilities.length ?? 0) + (cfg?.task_types.length ?? 0)) / 4)
  return round(onTimeRate * budgetFitRate * skillCoverageRate * DIMENSION_MAX)
}

function productizationScore(agent: Agent, cfg: AgentConfig | null): number {
  const standardizationRate = average([
    cfg?.skills_file ? 1 : 0,
    clamp((cfg?.capabilities.length ?? 0) / 3),
    clamp((cfg?.task_types.length ?? 0) / 2),
  ])
  const documentationRate = average([
    agent.persona.trim() ? 1 : 0,
    agent.role.trim() ? 1 : 0,
    agent.department.trim() ? 1 : 0,
    agent.goals.length > 0 ? 1 : 0,
    cfg?.display_name ? 1 : 0,
    cfg?.role_label ? 1 : 0,
    (cfg?.persona_keywords.length ?? 0) > 0 ? 1 : 0,
  ])
  return round(average([standardizationRate, documentationRate]) * DIMENSION_MAX)
}

function buildDimensionPercentages(breakdown: CommercialReadinessBreakdown): Record<CommercialDimensionKey, number> {
  return {
    autonomy: round((breakdown.autonomy / DIMENSION_MAX) * 100),
    revenue_contribution: round((breakdown.revenue_contribution / DIMENSION_MAX) * 100),
    intelligence: round((breakdown.intelligence / DIMENSION_MAX) * 100),
    execution: round((breakdown.execution / DIMENSION_MAX) * 100),
    productization: round((breakdown.productization / DIMENSION_MAX) * 100),
  }
}

function buildSummarySentence(record: AgentCommercialReadiness): string {
  const strongest = COMMERCIAL_DIMENSIONS
    .map((item) => ({ key: item.key, label: item.label, value: record.breakdown[item.key] }))
    .sort((left, right) => right.value - left.value)[0]
  const weakest = COMMERCIAL_DIMENSIONS
    .map((item) => ({ key: item.key, label: item.label, value: record.breakdown[item.key] }))
    .sort((left, right) => left.value - right.value)[0]
  return `最强 ${strongest.label} ${strongest.value.toFixed(1)}，最弱 ${weakest.label} ${weakest.value.toFixed(1)}。`
}

export function computeCommercialReadinessReport(
  snapshot: AppSnapshot,
  config: AppConfig | null = getCachedConfig(),
  referenceDate = new Date(),
): CommercialReadinessReport {
  const boundary = buildProfitabilityBoundary(snapshot, snapshot.businessLines ?? [], referenceDate)
  const rpcMap = new Map(boundary.agentRPC.map((item) => [item.agentId, item]))
  const maxPositiveNet = Math.max(0, ...boundary.agentRPC.map((item) => Math.max(item.netContribution, 0)))
  const maxRpc = Math.max(0, ...boundary.agentRPC.map((item) => item.rpc ?? 0))

  const records = snapshot.agents
    .filter((agent) => agent.id !== 'ceo')
    .map((agent) => {
      const tasks = getAgentTasks(snapshot, agent)
      const cfg = getAgentConfig(config, agent.id)
      const rpc = rpcMap.get(agent.id)

      const revenueRate = rpc
        ? ((maxRpc > 0 ? clamp((rpc.rpc ?? 0) / maxRpc) : 0) * 0.6)
          + ((maxPositiveNet > 0 ? clamp(Math.max(rpc.netContribution, 0) / maxPositiveNet) : 0) * 0.4)
        : 0

      const breakdown: CommercialReadinessBreakdown = {
        autonomy: autonomyScore(tasks, agent),
        revenue_contribution: round(revenueRate * DIMENSION_MAX),
        intelligence: intelligenceScore(tasks, agent.complianceScore),
        execution: executionScore(tasks, cfg, referenceDate),
        productization: productizationScore(agent, cfg),
      }

      const score = round(Object.values(breakdown).reduce((sum, value) => sum + value, 0), 1)
      const dimensionPercentages = buildDimensionPercentages(breakdown)
      const improvementAreas = COMMERCIAL_DIMENSIONS
        .slice()
        .sort((left, right) => breakdown[left.key] - breakdown[right.key])
        .slice(0, 2)
        .map((item) => item.key)

      const record: AgentCommercialReadiness = {
        agentId: agent.id,
        name: agent.name,
        score,
        grade: applyDimensionFloor(score, breakdown),
        breakdown,
        dimensionPercentages,
        improvementAreas,
        summary: '',
      }
      record.summary = buildSummarySentence(record)
      return record
    })
    .sort((left, right) => right.score - left.score)

  const dimensionAverages = records.reduce<CommercialReadinessBreakdown>((acc, record) => ({
    autonomy: acc.autonomy + record.breakdown.autonomy,
    revenue_contribution: acc.revenue_contribution + record.breakdown.revenue_contribution,
    intelligence: acc.intelligence + record.breakdown.intelligence,
    execution: acc.execution + record.breakdown.execution,
    productization: acc.productization + record.breakdown.productization,
  }), emptyBreakdown())

  if (records.length > 0) {
    dimensionAverages.autonomy = round(dimensionAverages.autonomy / records.length)
    dimensionAverages.revenue_contribution = round(dimensionAverages.revenue_contribution / records.length)
    dimensionAverages.intelligence = round(dimensionAverages.intelligence / records.length)
    dimensionAverages.execution = round(dimensionAverages.execution / records.length)
    dimensionAverages.productization = round(dimensionAverages.productization / records.length)
  }

  const avgScore = records.length > 0
    ? round(records.reduce((sum, record) => sum + record.score, 0) / records.length)
    : 0
  const gradeDistribution: Record<PerformanceGrade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  for (const record of records) {
    gradeDistribution[record.grade] += 1
  }

  const grade = applyDimensionFloor(avgScore, dimensionAverages)
  const summary: CommercialReadinessSummary = {
    count: records.length,
    avgScore,
    grade,
    companyReadinessScore: avgScore,
    companyReadinessGrade: grade,
    topPerformer: records[0]?.name ?? '',
    gradeDistribution,
    dimensionAverages,
  }

  return { records, summary }
}

export const performanceV2Service = {
  getReport(referenceDate = new Date()): CommercialReadinessReport {
    return computeCommercialReadinessReport(getSnapshot(), getCachedConfig(), referenceDate)
  },

  getAgent(agentId: string, referenceDate = new Date()): AgentCommercialReadiness | null {
    const report = this.getReport(referenceDate)
    return report.records.find((item) => item.agentId === agentId) ?? null
  },
}

export type { CommercialReadinessReport }
