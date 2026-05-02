import { getSnapshot } from '../lib/snapshotStore'
import type {
  ActionBoundaryRequest,
  ActionDecision,
  ActionType,
  ApprovalItem,
  MockApprovalRequest,
  UnifiedApproval,
} from '../types'
import { localPersistenceService, localStateKeys } from './localPersistenceService'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function listStoredUnifiedApprovals(): UnifiedApproval[] {
  return localPersistenceService.getOrSeed(localStateKeys.unifiedApprovals, [] as UnifiedApproval[])
}

function persistUnifiedApprovals(approvals: UnifiedApproval[]) {
  localPersistenceService.setItem(localStateKeys.unifiedApprovals, approvals)
}

function listLegacyMockApprovals(): MockApprovalRequest[] {
  return localPersistenceService.getItem(localStateKeys.mockApprovalRequests, [] as MockApprovalRequest[])
}

function dedupe(approvals: UnifiedApproval[]): UnifiedApproval[] {
  const seen = new Set<string>()
  return approvals.filter(approval => {
    if (seen.has(approval.id)) return false
    seen.add(approval.id)
    return true
  })
}

export function mapMockApprovalToApprovalItem(mockApproval: MockApprovalRequest): UnifiedApproval {
  return {
    id: mockApproval.id,
    title: mockApproval.title,
    description: mockApproval.description,
    sourceModule: mockApproval.sourceModule,
    sourceId: mockApproval.sourceId,
    actionType: mockApproval.actionType,
    actionLevel: mockApproval.actionLevel,
    status: mockApproval.status,
    amount: mockApproval.amount,
    customerName: mockApproval.customerName,
    requestedByAgentId: mockApproval.requestedByAgentId,
    createdAt: mockApproval.createdAt,
    updatedAt: mockApproval.createdAt,
    approvedBy: '',
    rejectedBy: '',
    rejectedReason: '',
    decisionNote: '',
    riskHint: '该动作来自旧 mock approval，本阶段仅做审批状态统一展示，不执行真实动作。',
    legacyApprovalId: '',
  }
}

export function mapApprovalItemToMockApproval(approval: UnifiedApproval): MockApprovalRequest {
  return {
    id: approval.id,
    title: approval.title,
    description: approval.description,
    sourceModule: approval.sourceModule === 'legacy' ? 'approval' : approval.sourceModule,
    sourceId: approval.sourceId,
    actionType: approval.actionType === 'legacy_approval' ? 'update_internal_status' : approval.actionType,
    actionLevel: approval.actionLevel === 'LEGACY' ? 'A2_INTERNAL_WRITE' : approval.actionLevel,
    status: approval.status,
    amount: approval.amount,
    customerName: approval.customerName,
    requestedByAgentId: approval.requestedByAgentId,
    createdAt: approval.createdAt,
  }
}

function mapSnapshotApproval(approval: ApprovalItem): UnifiedApproval {
  return {
    id: `legacy_${approval.id}`,
    title: approval.targetTitle,
    description: approval.reason,
    sourceModule: 'legacy',
    sourceId: approval.targetId || approval.id,
    actionType: 'legacy_approval',
    actionLevel: 'LEGACY',
    status: approval.status,
    amount: approval.amount,
    customerName: '',
    requestedByAgentId: approval.requester,
    createdAt: approval.createdAt,
    updatedAt: approval.createdAt,
    approvedBy: '',
    rejectedBy: '',
    rejectedReason: approval.latestRejectionNote ?? '',
    decisionNote: approval.latestDecisionNote ?? '',
    riskHint: '旧审批中心任务审批项，仍由原 writeback 流处理。',
    legacyApprovalId: approval.id,
  }
}

export function listUnifiedApprovals(): UnifiedApproval[] {
  const stored = listStoredUnifiedApprovals()
  const legacyMocks = listLegacyMockApprovals()
    .filter(mock => !stored.some(approval => approval.id === mock.id))
    .map(mapMockApprovalToApprovalItem)
  const snapshotApprovals = getSnapshot().approvals.map(mapSnapshotApproval)
  return dedupe([...stored, ...legacyMocks, ...snapshotApprovals]).map(clone)
}

export function getApprovalById(id: string): UnifiedApproval | undefined {
  return listUnifiedApprovals().find(approval => approval.id === id)
}

export function createApprovalFromBoundaryRequest(request: ActionBoundaryRequest, decision: ActionDecision): UnifiedApproval {
  const stored = listStoredUnifiedApprovals()
  const existing = stored.find(approval =>
    approval.sourceModule === request.sourceModule
    && approval.sourceId === request.sourceId
    && approval.actionType === request.actionType
    && approval.status === 'pending')
  if (existing) return clone(existing)

  const createdAt = decision.createdAt || today()
  const actionLabel = request.actionType
  const approval: UnifiedApproval = {
    id: `unified_approval_${request.actionType}_${request.sourceModule}_${request.sourceId}`.replace(/[^a-zA-Z0-9_]+/g, '_'),
    title: decision.approvalTitle || `CEO 审批：${request.title || actionLabel}`,
    description: [
      decision.approvalDescription || request.description,
      `来源模块：${request.sourceModule}/${request.sourceId}`,
      `动作类型：${request.actionType}`,
      `动作等级：${decision.actionLevel}`,
      `客户：${request.customerName || '未指定'}`,
      `金额：${request.amount || 0}`,
      `风险：${decision.reason}`,
    ].filter(Boolean).join('\n'),
    sourceModule: request.sourceModule,
    sourceId: request.sourceId,
    actionType: request.actionType,
    actionLevel: decision.actionLevel,
    status: 'pending',
    amount: request.amount,
    customerName: request.customerName,
    requestedByAgentId: request.requestedByAgentId,
    createdAt,
    updatedAt: createdAt,
    approvedBy: '',
    rejectedBy: '',
    rejectedReason: '',
    decisionNote: '',
    riskHint: decision.reason,
    legacyApprovalId: '',
  }
  persistUnifiedApprovals([approval, ...stored])
  localPersistenceService.setItem(localStateKeys.mockApprovalRequests, [
    mapApprovalItemToMockApproval(approval),
    ...listLegacyMockApprovals().filter(item => item.id !== approval.id),
  ])
  return clone(approval)
}

function updateStoredApproval(id: string, updater: (approval: UnifiedApproval) => UnifiedApproval): UnifiedApproval | undefined {
  const stored = listStoredUnifiedApprovals()
  let updated: UnifiedApproval | undefined
  const next = stored.map(approval => {
    if (approval.id !== id) return approval
    updated = updater(approval)
    return updated
  })
  if (!updated) return undefined
  persistUnifiedApprovals(next)
  localPersistenceService.setItem(localStateKeys.mockApprovalRequests, next.map(mapApprovalItemToMockApproval))
  return clone(updated)
}

export function approveUnifiedApproval(id: string, approvedBy: string): UnifiedApproval | undefined {
  return updateStoredApproval(id, approval => ({
    ...approval,
    status: 'approved',
    approvedBy,
    updatedAt: today(),
    decisionNote: '审批已通过；当前版本不会自动执行真实外部动作。',
  }))
}

export function rejectUnifiedApproval(id: string, rejectedBy: string, reason: string): UnifiedApproval | undefined {
  return updateStoredApproval(id, approval => ({
    ...approval,
    status: 'rejected',
    rejectedBy,
    rejectedReason: reason,
    updatedAt: today(),
    decisionNote: '审批已拒绝；相关动作不会执行。',
  }))
}

export function cancelUnifiedApproval(id: string): UnifiedApproval | undefined {
  return updateStoredApproval(id, approval => ({
    ...approval,
    status: 'cancelled',
    updatedAt: today(),
    decisionNote: '审批已取消；相关动作不会执行。',
  }))
}

export function getApprovalStatusForSource(sourceModule: string, sourceId: string, actionType: ActionType): UnifiedApproval | undefined {
  return listUnifiedApprovals().find(approval =>
    approval.sourceModule === sourceModule
    && approval.sourceId === sourceId
    && approval.actionType === actionType)
}

export function resetUnifiedApprovals() {
  persistUnifiedApprovals([])
  localPersistenceService.setItem(localStateKeys.mockApprovalRequests, [] as MockApprovalRequest[])
}

export const approvalBridgeService = {
  listUnifiedApprovals,
  createApprovalFromBoundaryRequest,
  getApprovalById,
  approveUnifiedApproval,
  rejectUnifiedApproval,
  cancelUnifiedApproval,
  getApprovalStatusForSource,
  mapMockApprovalToApprovalItem,
  mapApprovalItemToMockApproval,
  resetUnifiedApprovals,
}
