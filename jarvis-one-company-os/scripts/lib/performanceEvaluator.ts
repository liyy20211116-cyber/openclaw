import fs from 'node:fs'
import path from 'node:path'
import type { PrismaClient } from '../../src/generated/prisma/client'
import {
  FOLDER_TO_AGENT_CODE,
  dataRoot,
  type AgentPerformanceRecord,
  type PerformanceGrade,
  type PerformanceReport,
} from './performanceLoader'

/**
 * Performance Evaluator v2 (TS implementation)
 *
 * 9 个维度，总分 100：
 *   资产维度 (asset, 50 分)
 *     - completeness         15  IDENTITY.md / skills.json / memory 目录是否齐备
 *     - skills               10  skills.json 数量
 *     - memory_activity      10  learnings.md 条数 + 最近更新时间
 *     - scripts              10  agent 根目录下 .py 文件数
 *     - growth               5   domain_knowledge.json / reflection_log.json 存在性
 *   商业维度 (business, 50 分)
 *     - task_completion      15  任务完成率（completed / assigned）
 *     - budget_discipline    10  预算纪律：spent / budget ≤ 1 得满分，超支按比例扣
 *     - compliance_delta     10  合规分相对 100 的差值
 *     - revenue_contribution 15  归因收入 / 花销（RPC 分档）
 *
 * 数据来源：
 *   资产维度：文件系统（openclaw_agents/<folder>）
 *   商业维度：Prisma DB（tasks / ledger / revenues / agents.complianceScore）
 *
 * 产物：PerformanceReport（与 performanceLoader 兼容） + 可选持久化到 DB
 */

export const WEIGHTS_V2 = {
  completeness: 15,
  skills: 10,
  memory_activity: 10,
  scripts: 10,
  growth: 5,
  task_completion: 15,
  budget_discipline: 10,
  compliance_delta: 10,
  revenue_contribution: 15,
} as const

export type DimensionKey = keyof typeof WEIGHTS_V2

export const TOKEN_TO_FIAT_RATE = 0.15

const DEPT_NAMES: Record<string, string> = {
  'jarvis-coo': '执行办(贾维斯)',
  'hermione-tech': '技术部(赫敏)',
  'mcgonagall-product': '产品部(麦格)',
  'luna-growth': '增长部(露娜)',
  'fred-sales': '销售部(弗雷德)',
  'percy-finance': '财务部(珀西)',
  'snape-audit': '审计部(斯内普)',
  'dobby-customer': '客户部(多比)',
  'neville-hr': '人资部(纳威)',
}

interface AssetScores {
  completeness: number
  skills: number
  memory_activity: number
  scripts: number
  growth: number
  skillCount: number
  learningsCount: number
  daysSinceMemoryUpdate: number | null
}

interface AgentBusinessStats {
  agentCode: string
  spentToken: number
  spentFiat: number
  attributedRevenue: number
  assignedTasks: number
  completedTasks: number
  budgetToken: number
  complianceScore: number
}

function evaluateAssets(agentFolder: string): AssetScores {
  const agentDir = path.join(dataRoot(), 'openclaw_agents', agentFolder)

  const hasIdentity = fs.existsSync(path.join(agentDir, 'IDENTITY.md'))
  const hasSkillsFile = fs.existsSync(path.join(agentDir, 'skills.json'))
  const memDir = path.join(agentDir, 'memory')
  const hasMemory = fs.existsSync(memDir) && fs.statSync(memDir).isDirectory()
  const completenessRatio = ([hasIdentity, hasSkillsFile, hasMemory].filter(Boolean).length) / 3
  const completeness = Number((completenessRatio * WEIGHTS_V2.completeness).toFixed(1))

  let skillCount = 0
  if (hasSkillsFile) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(agentDir, 'skills.json'), 'utf-8')) as unknown
      if (Array.isArray(raw)) skillCount = raw.length
    } catch { /* ignore */ }
  }
  const skills = Math.min(WEIGHTS_V2.skills, Number((skillCount * 1.5).toFixed(1)))

  let memScore = 0
  let learningsCount = 0
  let daysSinceMemoryUpdate: number | null = null
  if (hasMemory) {
    const learningsFile = path.join(memDir, 'learnings.md')
    if (fs.existsSync(learningsFile)) {
      try {
        const content = fs.readFileSync(learningsFile, 'utf-8')
        learningsCount = Math.max(0, (content.match(/\n-{3,}\n/g)?.length ?? content.split('---').length - 1))
        memScore += Math.min(6, learningsCount * 1.2)
      } catch { /* ignore */ }
      try {
        const mtime = fs.statSync(learningsFile).mtime
        const days = Math.floor((Date.now() - mtime.getTime()) / (24 * 60 * 60 * 1000))
        daysSinceMemoryUpdate = days
        if (days <= 1) memScore += 4
        else if (days <= 7) memScore += 2
      } catch { /* ignore */ }
    }
  }
  const memory_activity = Math.min(WEIGHTS_V2.memory_activity, Number(memScore.toFixed(1)))

  let pyFiles = 0
  if (fs.existsSync(agentDir)) {
    try {
      pyFiles = fs.readdirSync(agentDir).filter((f) => f.endsWith('.py')).length
    } catch { /* ignore */ }
  }
  const scripts = Math.min(WEIGHTS_V2.scripts, Number((pyFiles * 2).toFixed(1)))

  let growthScore = 0
  if (hasMemory) {
    if (fs.existsSync(path.join(memDir, 'domain_knowledge.json'))) growthScore += 3
    if (fs.existsSync(path.join(memDir, 'reflection_log.json'))) growthScore += 2
  }
  const growth = Math.min(WEIGHTS_V2.growth, Number(growthScore.toFixed(1)))

  return {
    completeness,
    skills,
    memory_activity,
    scripts,
    growth,
    skillCount,
    learningsCount,
    daysSinceMemoryUpdate,
  }
}

async function collectBusinessStats(prisma: PrismaClient): Promise<Map<string, AgentBusinessStats>> {
  const [agents, tasks, ledger, revenues] = await Promise.all([
    prisma.agent.findMany(),
    prisma.task.findMany({ include: { owner: true } }),
    prisma.tokenLedger.findMany(),
    prisma.revenue.findMany({ include: { relatedTask: true } }),
  ])

  const result = new Map<string, AgentBusinessStats>()
  for (const agent of agents) {
    if (agent.code === 'ceo') continue
    result.set(agent.code, {
      agentCode: agent.code,
      spentToken: 0,
      spentFiat: 0,
      attributedRevenue: 0,
      assignedTasks: 0,
      completedTasks: 0,
      budgetToken: 0,
      complianceScore: agent.complianceScore,
    })
  }

  const agentIdToCode = new Map(agents.map((a) => [a.id, a.code]))

  for (const task of tasks) {
    const ownerCode = agentIdToCode.get(task.ownerAgentId)
    if (!ownerCode) continue
    const stats = result.get(ownerCode)
    if (!stats) continue
    stats.assignedTasks += 1
    if (task.status === 'completed') stats.completedTasks += 1
    stats.spentToken += task.spentToken
    stats.budgetToken += task.budgetToken
  }

  for (const item of ledger) {
    if (item.amount >= 0) continue
    const code = item.toAccount.replace(/^agent_/, '')
    const stats = result.get(code)
    if (!stats) continue
    stats.spentToken += Math.abs(item.amount)
  }

  for (const rev of revenues) {
    if (!rev.relatedTask) continue
    const ownerCode = agentIdToCode.get(rev.relatedTask.ownerAgentId)
    if (!ownerCode) continue
    const stats = result.get(ownerCode)
    if (!stats) continue
    stats.attributedRevenue += Number(rev.amountFiat)
  }

  for (const stats of result.values()) {
    stats.spentFiat = Number((stats.spentToken * TOKEN_TO_FIAT_RATE).toFixed(2))
  }

  return result
}

function scoreTaskCompletion(stats: AgentBusinessStats): number {
  if (stats.assignedTasks === 0) return WEIGHTS_V2.task_completion * 0.6
  const rate = stats.completedTasks / stats.assignedTasks
  return Number((rate * WEIGHTS_V2.task_completion).toFixed(1))
}

function scoreBudgetDiscipline(stats: AgentBusinessStats): number {
  if (stats.budgetToken === 0) {
    return stats.spentToken === 0 ? WEIGHTS_V2.budget_discipline : WEIGHTS_V2.budget_discipline * 0.6
  }
  const ratio = stats.spentToken / stats.budgetToken
  if (ratio <= 1) return WEIGHTS_V2.budget_discipline
  const overshoot = ratio - 1
  const penalty = Math.min(WEIGHTS_V2.budget_discipline, overshoot * WEIGHTS_V2.budget_discipline)
  return Number((WEIGHTS_V2.budget_discipline - penalty).toFixed(1))
}

function scoreComplianceDelta(stats: AgentBusinessStats): number {
  const clamped = Math.max(0, Math.min(100, stats.complianceScore))
  return Number(((clamped / 100) * WEIGHTS_V2.compliance_delta).toFixed(1))
}

function scoreRevenueContribution(stats: AgentBusinessStats): number {
  if (stats.spentFiat <= 0 && stats.attributedRevenue <= 0) {
    return WEIGHTS_V2.revenue_contribution * 0.5
  }
  if (stats.spentFiat <= 0 && stats.attributedRevenue > 0) {
    return WEIGHTS_V2.revenue_contribution
  }
  const rpc = stats.attributedRevenue / Math.max(stats.spentFiat, 1)
  if (rpc >= 2) return WEIGHTS_V2.revenue_contribution
  if (rpc >= 1) return Number((WEIGHTS_V2.revenue_contribution * 0.8).toFixed(1))
  if (rpc >= 0.5) return Number((WEIGHTS_V2.revenue_contribution * 0.55).toFixed(1))
  if (rpc > 0) return Number((WEIGHTS_V2.revenue_contribution * 0.3).toFixed(1))
  return 0
}

function totalToGrade(total: number): PerformanceGrade {
  if (total >= 90) return 'S'
  if (total >= 75) return 'A'
  if (total >= 60) return 'B'
  if (total >= 40) return 'C'
  return 'D'
}

function collectImprovements(breakdown: Record<DimensionKey, number>): string[] {
  return (Object.keys(WEIGHTS_V2) as DimensionKey[])
    .filter((k) => breakdown[k] < WEIGHTS_V2[k] * 0.6)
}

function listAgentFolders(): string[] {
  const agentsDir = path.join(dataRoot(), 'openclaw_agents')
  if (!fs.existsSync(agentsDir)) return []
  try {
    return fs.readdirSync(agentsDir).filter((name) => {
      const full = path.join(agentsDir, name)
      return fs.statSync(full).isDirectory() && DEPT_NAMES[name] !== undefined
    }).sort()
  } catch {
    return []
  }
}

export interface EvaluateOptions {
  /** Persist each agent's review into `performance_reviews` table. */
  persist?: boolean
  /** Override the reviewer tag. */
  reviewer?: string
}

export async function evaluateAllAgentsV2(
  prisma: PrismaClient,
  options: EvaluateOptions = {},
): Promise<PerformanceReport> {
  const reviewer = options.reviewer ?? 'neville-hr-v2'
  const reviewDate = new Date().toISOString()
  const businessStats = await collectBusinessStats(prisma)
  const folders = listAgentFolders()

  const records: AgentPerformanceRecord[] = []

  for (const folder of folders) {
    const agentCode = FOLDER_TO_AGENT_CODE[folder] ?? folder
    const asset = evaluateAssets(folder)
    const stats = businessStats.get(agentCode) ?? {
      agentCode,
      spentToken: 0,
      spentFiat: 0,
      attributedRevenue: 0,
      assignedTasks: 0,
      completedTasks: 0,
      budgetToken: 0,
      complianceScore: 100,
    }

    const breakdown: Record<DimensionKey, number> = {
      completeness: asset.completeness,
      skills: asset.skills,
      memory_activity: asset.memory_activity,
      scripts: asset.scripts,
      growth: asset.growth,
      task_completion: scoreTaskCompletion(stats),
      budget_discipline: scoreBudgetDiscipline(stats),
      compliance_delta: scoreComplianceDelta(stats),
      revenue_contribution: scoreRevenueContribution(stats),
    }

    const total = Number(
      (Object.values(breakdown) as number[]).reduce((sum, v) => sum + v, 0).toFixed(1),
    )
    const grade = totalToGrade(total)
    const improvementAreas = collectImprovements(breakdown)

    const record: AgentPerformanceRecord = {
      agentCode,
      agentFolder: folder,
      score: total,
      grade,
      breakdown,
      improvementAreas,
      reviewedAt: reviewDate,
      reviewer,
    }
    records.push(record)

    if (options.persist) {
      const id = `perf_${agentCode}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      const metadata = {
        skillCount: asset.skillCount,
        learningsCount: asset.learningsCount,
        daysSinceMemoryUpdate: asset.daysSinceMemoryUpdate,
        assignedTasks: stats.assignedTasks,
        completedTasks: stats.completedTasks,
        spentToken: stats.spentToken,
        spentFiat: stats.spentFiat,
        budgetToken: stats.budgetToken,
        attributedRevenue: stats.attributedRevenue,
        complianceScore: stats.complianceScore,
      }
      try {
        await prisma.performanceReview.create({
          data: {
            id,
            agentCode,
            agentFolder: folder,
            reviewer,
            version: 'v2',
            score: total,
            grade,
            breakdownJson: JSON.stringify(breakdown),
            improvementAreasJson: JSON.stringify(improvementAreas),
            metadataJson: JSON.stringify(metadata),
          },
        })
      } catch (err) {
        console.warn(`[performanceEvaluator] persist failed for ${agentCode}:`, err)
      }
    }
  }

  records.sort((a, b) => b.score - a.score)

  const avgScore = records.length === 0
    ? 0
    : Number((records.reduce((sum, r) => sum + r.score, 0) / records.length).toFixed(1))

  const gradeDistribution: Record<PerformanceGrade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  for (const r of records) gradeDistribution[r.grade] += 1

  const topPerformer = records[0]?.agentCode ?? ''
  const needsAttention = records.filter((r) => r.score < 50).map((r) => r.agentCode)

  return {
    reviewDate,
    reviewer,
    avgScore,
    gradeDistribution,
    topPerformer,
    needsAttention,
    records,
  }
}

/**
 * 同时把评估结果写一份 JSON 到 output/performance/，保持与 v1 兼容，
 * 这样 performanceLoader.ts 的 JSON 解析路径也能读到 v2 产物。
 */
export function dumpReportToJson(report: PerformanceReport): string | null {
  try {
    const outputDir = path.join(dataRoot(), 'output', 'performance')
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `performance_review_${timestamp}_v2.json`
    const filePath = path.join(outputDir, fileName)

    const payload = {
      review_date: report.reviewDate,
      reviewer: report.reviewer,
      version: 'v2',
      avg_score: report.avgScore,
      grade_distribution: report.gradeDistribution,
      top_performer: report.records.find((r) => r.agentCode === report.topPerformer)?.agentFolder
        ?? report.topPerformer,
      needs_attention: report.records
        .filter((r) => report.needsAttention.includes(r.agentCode))
        .map((r) => r.agentFolder),
      reviews: report.records.map((r) => ({
        agent: r.agentFolder,
        total_score: r.score,
        grade: r.grade,
        dimension_scores: r.breakdown,
        improve_areas: r.improvementAreas,
      })),
    }

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return filePath
  } catch (err) {
    console.warn('[performanceEvaluator] dumpReportToJson failed:', err)
    return null
  }
}
