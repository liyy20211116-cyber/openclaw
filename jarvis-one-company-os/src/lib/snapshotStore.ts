import type { AppSnapshot } from '../types'
import { appSnapshot as bundledSnapshot } from '../data/appSnapshot'

const STORAGE_KEY = 'jarvis-one-company-os.snapshot-cache'
const SNAPSHOT_URL = '/appSnapshot.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTaskStatus(value: unknown): value is AppSnapshot['tasks'][number]['status'] {
  return typeof value === 'string' && [
    'draft',
    'pending_approval',
    'approved',
    'in_progress',
    'review',
    'completed',
    'frozen',
    'rejected',
  ].includes(value)
}

function isApprovalStatus(value: unknown): value is AppSnapshot['approvals'][number]['status'] {
  return value === 'pending' || value === 'approved' || value === 'rejected'
}

function isAgentStatus(value: unknown): value is AppSnapshot['agents'][number]['status'] {
  return value === 'idle' || value === 'busy' || value === 'review' || value === 'frozen'
}

function isTaskTimelineEventType(value: unknown): value is NonNullable<AppSnapshot['tasks'][number]['timeline']>[number]['type'] {
  return value === 'created' || value === 'resubmitted' || value === 'approval_requested' || value === 'approved' || value === 'rejected' || value === 'start' || value === 'approve'
}

function isTaskTimelineEvent(value: unknown): value is NonNullable<AppSnapshot['tasks'][number]['timeline']>[number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && isTaskTimelineEventType(value.type)
    && typeof value.submissionIndex === 'number'
    && typeof value.actor === 'string'
    && typeof value.note === 'string'
    && typeof value.createdAt === 'string'
}

function isAgent(value: unknown): value is AppSnapshot['agents'][number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.role === 'string'
    && typeof value.department === 'string'
    && typeof value.persona === 'string'
    && isAgentStatus(value.status)
    && typeof value.walletBalance === 'number'
    && typeof value.currentTasks === 'number'
    && typeof value.complianceScore === 'number'
    && Array.isArray(value.goals)
    && value.goals.every((goal) => typeof goal === 'string')
}

function isTask(value: unknown): value is AppSnapshot['tasks'][number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.owner === 'string'
    && (value.ownerAgentId === undefined || typeof value.ownerAgentId === 'string')
    && (value.description === undefined || typeof value.description === 'string')
    && (value.taskType === undefined || ['ops', 'tech', 'growth', 'finance', 'audit', 'product', 'sales', 'customer'].includes(String(value.taskType)))
    && typeof value.priority === 'string'
    && isTaskStatus(value.status)
    && typeof value.budgetToken === 'number'
    && typeof value.spentToken === 'number'
    && typeof value.dueAt === 'string'
    && (value.requiresApproval === undefined || typeof value.requiresApproval === 'boolean')
    && (value.resubmissionCount === undefined || typeof value.resubmissionCount === 'number')
    && (value.latestRejectionNote === undefined || typeof value.latestRejectionNote === 'string')
    && (value.latestRejectionAt === undefined || typeof value.latestRejectionAt === 'string')
    && (value.timeline === undefined || (Array.isArray(value.timeline) && value.timeline.every(isTaskTimelineEvent)))
}

function isApproval(value: unknown): value is AppSnapshot['approvals'][number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.requester === 'string'
    && (value.targetId === undefined || typeof value.targetId === 'string')
    && typeof value.targetTitle === 'string'
    && typeof value.amount === 'number'
    && typeof value.reason === 'string'
    && isApprovalStatus(value.status)
    && typeof value.createdAt === 'string'
    && (value.resubmissionCount === undefined || typeof value.resubmissionCount === 'number')
    && (value.latestDecisionNote === undefined || typeof value.latestDecisionNote === 'string')
    && (value.latestRejectionNote === undefined || typeof value.latestRejectionNote === 'string')
}

function isLedger(value: unknown): value is AppSnapshot['ledger'][number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.type === 'string'
    && typeof value.actor === 'string'
    && typeof value.amount === 'number'
    && typeof value.note === 'string'
    && typeof value.createdAt === 'string'
}

function isRevenue(value: unknown): value is AppSnapshot['revenues'][number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.businessLine === 'string'
    && typeof value.sourceTask === 'string'
    && typeof value.amount === 'number'
    && typeof value.tokenMapped === 'number'
    && typeof value.roi === 'number'
}

function isAuditEvent(value: unknown): value is AppSnapshot['auditEvents'][number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.detail === 'string'
}

function isAppSnapshot(value: unknown): value is AppSnapshot {
  if (!isRecord(value)) return false
  if (!Array.isArray(value.agents) || !value.agents.every(isAgent)) return false
  if (!Array.isArray(value.tasks) || !value.tasks.every(isTask)) return false
  if (!Array.isArray(value.approvals) || !value.approvals.every(isApproval)) return false
  if (!Array.isArray(value.ledger) || !value.ledger.every(isLedger)) return false
  if (!Array.isArray(value.revenues) || !value.revenues.every(isRevenue)) return false
  if (!Array.isArray(value.auditEvents) || !value.auditEvents.every(isAuditEvent)) return false
  return true
}

function ensureDefaults(snapshot: AppSnapshot): AppSnapshot {
  return {
    ...snapshot,
    storeItems: snapshot.storeItems ?? [],
    storeOrders: snapshot.storeOrders ?? [],
    treasury: snapshot.treasury ?? { totalBalance: 0, reservedBalance: 0, availableBalance: 0 },
    businessLines: snapshot.businessLines ?? [],
    playbookRuns: snapshot.playbookRuns ?? [],
  }
}

function readCachedSnapshot(): AppSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)
    return isAppSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

function persistSnapshot(snapshot: AppSnapshot) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

let currentSnapshot: AppSnapshot = ensureDefaults(readCachedSnapshot() ?? bundledSnapshot)
const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach((listener) => listener())
}

export function getSnapshot() {
  return currentSnapshot
}

export async function refreshSnapshot() {
  const response = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`快照刷新失败：HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isAppSnapshot(payload)) {
    throw new Error('快照数据格式无效')
  }

  const enriched = ensureDefaults(payload)
  currentSnapshot = enriched
  persistSnapshot(enriched)
  emitChange()
  return enriched
}

export function subscribeSnapshot(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

persistSnapshot(currentSnapshot)
