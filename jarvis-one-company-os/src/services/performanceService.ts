import type { PerformanceGrade, PerformanceHistoryPoint } from '../types'

export interface PerformanceRecordApi {
  agentCode: string
  agentFolder: string
  score: number
  grade: PerformanceGrade
  breakdown: Record<string, number>
  improvementAreas: string[]
  reviewedAt: string
  reviewer: string
}

export interface PerformanceReportApi {
  hasReport: boolean
  reviewDate?: string
  reviewer?: string
  avgScore?: number
  gradeDistribution?: Record<PerformanceGrade, number>
  topPerformer?: string
  needsAttention?: string[]
  records?: PerformanceRecordApi[]
}

export interface PerformanceRefreshResult {
  ok: boolean
  version?: 'v1' | 'v2'
  refreshedAt?: string
  reviewDate?: string
  avgScore?: number
  gradeDistribution?: Record<PerformanceGrade, number>
  totalAgents?: number
  error?: string
  stderr?: string
}

export interface PerformanceHistoryResult {
  ok: boolean
  agentCode?: string
  history: PerformanceHistoryPoint[]
  error?: string
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

export async function fetchLatestPerformance(): Promise<PerformanceReportApi> {
  try {
    return await postJson<PerformanceReportApi>('/api/agents/performance', {})
  } catch (err) {
    console.warn('[performanceService] fetchLatestPerformance failed:', err)
    return { hasReport: false }
  }
}

export async function refreshPerformance(options: { version?: 'v1' | 'v2' } = {}): Promise<PerformanceRefreshResult> {
  const version = options.version ?? 'v2'
  try {
    return await postJson<PerformanceRefreshResult>('/api/agents/performance/refresh', { version })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function fetchPerformanceHistory(agentCode: string, limit = 20): Promise<PerformanceHistoryPoint[]> {
  if (!agentCode) return []
  try {
    const resp = await postJson<PerformanceHistoryResult>('/api/agents/performance/history', { agentCode, limit })
    return Array.isArray(resp.history) ? resp.history : []
  } catch (err) {
    console.warn('[performanceService] fetchPerformanceHistory failed:', err)
    return []
  }
}

export function gradeColor(grade: PerformanceGrade | undefined): string {
  switch (grade) {
    case 'S': return '#a78bfa'
    case 'A': return '#22c55e'
    case 'B': return '#38bdf8'
    case 'C': return '#f59e0b'
    case 'D': return '#ef4444'
    default: return '#64748b'
  }
}

export function scoreColor(score: number): string {
  if (score >= 90) return '#a78bfa'
  if (score >= 75) return '#22c55e'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}
