import fs from 'node:fs/promises'
import path from 'node:path'
import type { PrismaClient } from '../../src/generated/prisma/client'
import { projectRoot } from './prismaClient'

// Map from openclaw_agents folder name → Agent.code used across the app
export const FOLDER_TO_AGENT_CODE: Record<string, string> = {
  'jarvis-coo': 'jarvis',
  'hermione-tech': 'hermione',
  'mcgonagall-product': 'mcgonagall',
  'luna-growth': 'luna',
  'fred-sales': 'fred',
  'percy-finance': 'percy',
  'snape-audit': 'snape',
  'dobby-customer': 'dobby',
  'neville-hr': 'neville',
}

export type PerformanceGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface AgentPerformanceRecord {
  agentCode: string
  agentFolder: string
  score: number
  grade: PerformanceGrade
  breakdown: Record<string, number>
  improvementAreas: string[]
  reviewedAt: string
  reviewer: string
}

export interface PerformanceReport {
  reviewDate: string
  reviewer: string
  avgScore: number
  gradeDistribution: Record<PerformanceGrade, number>
  topPerformer: string
  needsAttention: string[]
  records: AgentPerformanceRecord[]
}

// Default data root (the workspace root that contains openclaw_agents and output)
export function dataRoot(): string {
  const env = (process.env.JARVIS_COMPANY_DATA_DIR ?? '').trim()
  return env || path.resolve(projectRoot, '..')
}

// Return all candidate performance JSON files, newest first.
async function listPerformanceJsonFiles(): Promise<string[]> {
  const root = dataRoot()
  const candidates = [
    path.join(root, 'output', 'performance'),
    path.join(root, 'output'),
  ]

  const found: { file: string; mtimeMs: number }[] = []

  for (const dir of candidates) {
    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (!/^performance_review.*\.json$/i.test(name)) continue
      const file = path.join(dir, name)
      try {
        const stat = await fs.stat(file)
        if (!stat.isFile()) continue
        found.push({ file, mtimeMs: stat.mtimeMs })
      } catch {
        /* ignore */
      }
    }
  }

  found.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return found.map((item) => item.file)
}

type RawReport = {
  review_date?: string
  reviewer?: string
  avg_score?: number
  summary?: {
    avg_score?: number
    grade_distribution?: Record<string, number>
    top_performer?: string
    needs_attention?: string[]
    total_agents?: number
  }
  grade_distribution?: Record<string, number>
  top_performer?: string
  needs_attention?: string[]
  reviews?: RawReview[]
}

type RawReview = {
  agent?: string
  total_score?: number
  grade?: string
  scores?: Record<string, number>
  dimension_scores?: Record<string, number>
  improvement_areas?: string[]
  improve_areas?: string[]
}

function normalizeGrade(value: string | undefined): PerformanceGrade {
  const g = String(value ?? '').toUpperCase()
  if (g === 'S' || g === 'A' || g === 'B' || g === 'C' || g === 'D') return g
  return 'C'
}

function emptyDistribution(): Record<PerformanceGrade, number> {
  return { S: 0, A: 0, B: 0, C: 0, D: 0 }
}

function parseReport(raw: RawReport): PerformanceReport | null {
  const reviews = Array.isArray(raw.reviews) ? raw.reviews : []
  if (reviews.length === 0) return null

  const reviewDate = typeof raw.review_date === 'string' && raw.review_date.length > 0
    ? raw.review_date
    : new Date().toISOString()
  const reviewer = typeof raw.reviewer === 'string' && raw.reviewer.length > 0
    ? raw.reviewer
    : 'neville-hr'

  const records: AgentPerformanceRecord[] = []
  for (const item of reviews) {
    const folder = String(item.agent ?? '').trim()
    if (!folder) continue
    const code = FOLDER_TO_AGENT_CODE[folder] ?? folder
    const breakdown: Record<string, number> = {}
    const rawBreakdown = item.scores ?? item.dimension_scores ?? {}
    for (const [k, v] of Object.entries(rawBreakdown)) {
      const num = Number(v)
      if (Number.isFinite(num)) breakdown[k] = num
    }
    const improvement = item.improvement_areas ?? item.improve_areas ?? []

    records.push({
      agentCode: code,
      agentFolder: folder,
      score: Number(item.total_score ?? 0),
      grade: normalizeGrade(item.grade),
      breakdown,
      improvementAreas: Array.isArray(improvement) ? improvement.map(String) : [],
      reviewedAt: reviewDate,
      reviewer,
    })
  }

  if (records.length === 0) return null

  const gradeDist = emptyDistribution()
  const reportDistSource = raw.summary?.grade_distribution ?? raw.grade_distribution
  if (reportDistSource) {
    for (const [k, v] of Object.entries(reportDistSource)) {
      const g = normalizeGrade(k)
      const n = Number(v)
      if (Number.isFinite(n)) gradeDist[g] = n
    }
  } else {
    for (const r of records) gradeDist[r.grade] += 1
  }

  const avgScore = raw.summary?.avg_score ?? raw.avg_score
    ?? Number((records.reduce((sum, r) => sum + r.score, 0) / records.length).toFixed(1))

  const topPerformerFolder = raw.summary?.top_performer ?? raw.top_performer
    ?? [...records].sort((a, b) => b.score - a.score)[0]?.agentFolder
    ?? ''
  const topPerformer = FOLDER_TO_AGENT_CODE[topPerformerFolder] ?? topPerformerFolder

  const needsAttentionRaw = raw.summary?.needs_attention ?? raw.needs_attention ?? []
  const needsAttention = Array.isArray(needsAttentionRaw)
    ? needsAttentionRaw.map((folder) => FOLDER_TO_AGENT_CODE[folder] ?? folder)
    : []

  return {
    reviewDate,
    reviewer,
    avgScore: Number(avgScore),
    gradeDistribution: gradeDist,
    topPerformer,
    needsAttention,
    records,
  }
}

export async function loadLatestPerformance(): Promise<PerformanceReport | null> {
  const files = await listPerformanceJsonFiles()
  for (const file of files) {
    try {
      const raw = JSON.parse(await fs.readFile(file, 'utf8')) as RawReport
      const parsed = parseReport(raw)
      if (parsed) return parsed
    } catch {
      continue
    }
  }
  return null
}

export const FOLDER_CODE_TO_FOLDER: Record<string, string> = Object.fromEntries(
  Object.entries(FOLDER_TO_AGENT_CODE).map(([folder, code]) => [code, folder]),
)

/**
 * Read latest performance review for every agent from Prisma `performance_reviews`.
 * Each agent only keeps the newest row. Returns null when the table is empty.
 */
export async function loadLatestPerformanceFromDb(
  prisma: PrismaClient,
): Promise<PerformanceReport | null> {
  try {
    const rows = await prisma.performanceReview.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    if (rows.length === 0) return null

    const latestByAgent = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      if (!latestByAgent.has(row.agentCode)) {
        latestByAgent.set(row.agentCode, row)
      }
    }

    const records: AgentPerformanceRecord[] = Array.from(latestByAgent.values()).map((row) => {
      let breakdown: Record<string, number> = {}
      try {
        const parsed = JSON.parse(row.breakdownJson ?? '{}') as Record<string, unknown>
        for (const [k, v] of Object.entries(parsed)) {
          const num = Number(v)
          if (Number.isFinite(num)) breakdown[k] = num
        }
      } catch { breakdown = {} }

      let improvementAreas: string[] = []
      try {
        const parsed = JSON.parse(row.improvementAreasJson ?? '[]') as unknown
        if (Array.isArray(parsed)) improvementAreas = parsed.map(String)
      } catch { improvementAreas = [] }

      return {
        agentCode: row.agentCode,
        agentFolder: row.agentFolder,
        score: Number(row.score),
        grade: normalizeGrade(row.grade),
        breakdown,
        improvementAreas,
        reviewedAt: row.createdAt.toISOString(),
        reviewer: row.reviewer,
      }
    })

    if (records.length === 0) return null

    records.sort((a, b) => b.score - a.score)
    const gradeDist = emptyDistribution()
    for (const r of records) gradeDist[r.grade] += 1

    const avgScore = Number(
      (records.reduce((sum, r) => sum + r.score, 0) / records.length).toFixed(1),
    )
    const topPerformer = records[0]?.agentCode ?? ''
    const needsAttention = records.filter((r) => r.score < 50).map((r) => r.agentCode)

    const reviewDate = records.reduce((latest, r) => (r.reviewedAt > latest ? r.reviewedAt : latest), records[0].reviewedAt)

    return {
      reviewDate,
      reviewer: records[0]?.reviewer ?? 'neville-hr',
      avgScore,
      gradeDistribution: gradeDist,
      topPerformer,
      needsAttention,
      records,
    }
  } catch (err) {
    console.warn('[performanceLoader] loadLatestPerformanceFromDb failed:', err)
    return null
  }
}

/**
 * DB first, JSON fallback. Used by exportSnapshot / /api/agents/performance.
 */
export async function loadLatestPerformanceWithPrisma(
  prisma: PrismaClient | null | undefined,
): Promise<PerformanceReport | null> {
  if (prisma) {
    const fromDb = await loadLatestPerformanceFromDb(prisma)
    if (fromDb) return fromDb
  }
  return loadLatestPerformance()
}

export interface PerformanceHistoryPoint {
  id: string
  reviewedAt: string
  score: number
  grade: PerformanceGrade
  reviewer: string
  version: string
}

export async function loadPerformanceHistory(
  prisma: PrismaClient,
  agentCode: string,
  limit = 20,
): Promise<PerformanceHistoryPoint[]> {
  if (!agentCode) return []
  try {
    const rows = await prisma.performanceReview.findMany({
      where: { agentCode },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(limit, 100)),
    })
    return rows.map((row) => ({
      id: row.id,
      reviewedAt: row.createdAt.toISOString(),
      score: Number(row.score),
      grade: normalizeGrade(row.grade),
      reviewer: row.reviewer,
      version: row.version,
    }))
  } catch (err) {
    console.warn('[performanceLoader] loadPerformanceHistory failed:', err)
    return []
  }
}

export function findPerformanceScript(): string | null {
  const root = dataRoot()
  const candidate = path.join(root, 'openclaw_agents', 'neville-hr', 'skill_performance_review.py')
  return candidate
}
