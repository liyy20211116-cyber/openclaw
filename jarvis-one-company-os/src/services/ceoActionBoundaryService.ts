import type {
  ActionBoundaryRequest,
  ActionDecision,
  ActionLevel,
  ActionType,
  MockApprovalRequest,
} from '../types'
import { approvalBridgeService } from './approvalBridgeService'
import { localPersistenceService, localStateKeys } from './localPersistenceService'

type ActionEvaluationResult = {
  decision: ActionDecision
  approvalId?: string
}

const actionLevels: Record<ActionType, ActionLevel> = {
  scan_opportunity: 'A0_READ_ONLY',
  score_lead: 'A0_READ_ONLY',
  match_offer: 'A0_READ_ONLY',
  generate_draft: 'A1_INTERNAL_DRAFT',
  generate_proposal_draft: 'A1_INTERNAL_DRAFT',
  generate_quote_draft: 'A1_INTERNAL_DRAFT',
  create_internal_task: 'A2_INTERNAL_WRITE',
  create_workflow_run: 'A2_INTERNAL_WRITE',
  update_internal_status: 'A2_INTERNAL_WRITE',
  generate_daily_report: 'A2_INTERNAL_WRITE',
  mark_artifact_completed: 'A2_INTERNAL_WRITE',
  mark_artifact_blocked: 'A2_INTERNAL_WRITE',
  publish_content: 'A3_EXTERNAL_ACTION',
  send_private_message: 'A3_EXTERNAL_ACTION',
  send_external_email: 'A3_EXTERNAL_ACTION',
  send_proposal: 'A3_EXTERNAL_ACTION',
  quote_price: 'A3_EXTERNAL_ACTION',
  external_customer_commitment: 'A3_EXTERNAL_ACTION',
  schedule_customer_meeting: 'A3_EXTERNAL_ACTION',
  change_public_offer: 'A3_EXTERNAL_ACTION',
  confirm_payment: 'A4_FINANCIAL_LEGAL',
  recognize_revenue: 'A4_FINANCIAL_LEGAL',
  issue_refund: 'A4_FINANCIAL_LEGAL',
  sign_contract: 'A4_FINANCIAL_LEGAL',
  issue_invoice: 'A4_FINANCIAL_LEGAL',
  change_large_amount_revenue: 'A4_FINANCIAL_LEGAL',
  delete_revenue_record: 'A4_FINANCIAL_LEGAL',
  legal_commitment: 'A4_FINANCIAL_LEGAL',
}

const levelLabels: Record<ActionLevel, string> = {
  A0_READ_ONLY: 'A0 只读分析',
  A1_INTERNAL_DRAFT: 'A1 内部草稿',
  A2_INTERNAL_WRITE: 'A2 内部写入',
  A3_EXTERNAL_ACTION: 'A3 对外动作',
  A4_FINANCIAL_LEGAL: 'A4 财务/法律',
}

const actionTypeLabels: Record<ActionType, string> = {
  scan_opportunity: '扫描项目机会',
  score_lead: '线索评分',
  match_offer: '匹配产品',
  generate_draft: '生成草稿',
  generate_proposal_draft: '生成方案草稿',
  generate_quote_draft: '生成报价草稿',
  create_internal_task: '创建内部任务',
  create_workflow_run: '创建工作流',
  update_internal_status: '更新内部状态',
  generate_daily_report: '生成日报',
  mark_artifact_completed: '标记产物完成',
  mark_artifact_blocked: '标记产物阻塞',
  publish_content: '发布内容',
  send_private_message: '发送私信',
  send_external_email: '发送外部邮件',
  send_proposal: '发送方案',
  quote_price: '正式报价',
  external_customer_commitment: '客户承诺',
  schedule_customer_meeting: '预约客户会议',
  change_public_offer: '修改公开产品',
  confirm_payment: '确认收款',
  recognize_revenue: '确认正式收入',
  issue_refund: '退款',
  sign_contract: '签署合同',
  issue_invoice: '开具发票',
  change_large_amount_revenue: '修改大额收入',
  delete_revenue_record: '删除收入记录',
  legal_commitment: '法律承诺',
}

let mockApprovals: MockApprovalRequest[] = localPersistenceService.getOrSeed(localStateKeys.mockApprovalRequests, [] as MockApprovalRequest[])

function persistMockApprovals() {
  localPersistenceService.setItem(localStateKeys.mockApprovalRequests, mockApprovals)
}

function refreshMockApprovals() {
  mockApprovals = localPersistenceService.getOrSeed(localStateKeys.mockApprovalRequests, [] as MockApprovalRequest[])
}

function nowDate() {
  return new Date().toISOString().slice(0, 10)
}

function knownAction(actionType: string): actionType is ActionType {
  return actionType in actionLevels
}

export function classifyAction(actionType: ActionType): ActionLevel {
  return actionLevels[actionType]
}

export function requiresCeoApproval(actionType: ActionType): boolean {
  const level = classifyAction(actionType)
  return level === 'A3_EXTERNAL_ACTION' || level === 'A4_FINANCIAL_LEGAL'
}

export function isActionAllowed(actionType: ActionType): boolean {
  const level = classifyAction(actionType)
  return level === 'A0_READ_ONLY' || level === 'A1_INTERNAL_DRAFT' || level === 'A2_INTERNAL_WRITE'
}

export function evaluateAction(request: ActionBoundaryRequest): ActionDecision {
  const createdAt = nowDate()
  if (!knownAction(request.actionType)) {
    return {
      actionType: request.actionType,
      actionLevel: 'A4_FINANCIAL_LEGAL',
      allowed: false,
      requiresCeoApproval: false,
      blocked: true,
      reason: '未知动作类型，默认阻塞，不能继续执行。',
      approvalTitle: '',
      approvalDescription: '',
      auditNote: `未知动作被阻塞：${request.title}`,
      createdAt,
    }
  }

  const actionLevel = classifyAction(request.actionType)
  const approvalRequired = requiresCeoApproval(request.actionType)
  const allowed = isActionAllowed(request.actionType)
  const label = getActionTypeLabel(request.actionType)
  const levelLabel = getActionLevelLabel(actionLevel)

  return {
    actionType: request.actionType,
    actionLevel,
    allowed,
    requiresCeoApproval: approvalRequired,
    blocked: false,
    reason: approvalRequired
      ? `${label} 属于 ${levelLabel}，必须 CEO 审批，系统不会自动执行。`
      : `${label} 属于 ${levelLabel}，允许作为内部自动动作执行。`,
    approvalTitle: approvalRequired ? `CEO 审批：${request.title || label}` : '',
    approvalDescription: approvalRequired
      ? `${request.description || label}\n客户：${request.customerName || '未指定'}\n金额：${request.amount || 0}\n来源：${request.sourceModule}/${request.sourceId}`
      : '',
    auditNote: approvalRequired
      ? `边界拦截：${label} 需要 CEO 审批。`
      : `边界通过：${label} 为内部动作。`,
    createdAt,
  }
}

export function createApprovalIfRequired(request: ActionBoundaryRequest): ActionEvaluationResult {
  const decision = evaluateAction(request)
  if (decision.blocked || !decision.requiresCeoApproval) {
    return { decision }
  }
  const approval = approvalBridgeService.createApprovalFromBoundaryRequest(request, decision)
  refreshMockApprovals()
  return { decision, approvalId: approval.id }
}

export function assertActionAllowed(request: ActionBoundaryRequest): ActionDecision {
  const decision = evaluateAction(request)
  if (decision.blocked) throw new Error(decision.reason)
  return decision
}

export function listMockApprovalRequests(): MockApprovalRequest[] {
  return approvalBridgeService.listUnifiedApprovals()
    .filter(approval => approval.actionType !== 'legacy_approval')
    .map(approvalBridgeService.mapApprovalItemToMockApproval)
}

export function getActionLevelLabel(actionLevel: ActionLevel): string {
  return levelLabels[actionLevel]
}

export function getActionTypeLabel(actionType: ActionType): string {
  return actionTypeLabels[actionType] ?? actionType
}

export function getBoundaryRiskHint(decision: ActionDecision): string {
  if (decision.blocked) return '动作类型未知或被策略阻塞，不允许继续。'
  if (decision.requiresCeoApproval) return '该动作必须 CEO 审批，当前仅创建本地模拟审批，不执行真实动作。'
  return '内部动作已通过 CEO 动作边界检查。'
}

export function listActionPolicy() {
  return (Object.keys(actionLevels) as ActionType[]).map(actionType => {
    const actionLevel = classifyAction(actionType)
    return {
      actionType,
      actionLevel,
      label: getActionTypeLabel(actionType),
      allowed: isActionAllowed(actionType),
      requiresCeoApproval: requiresCeoApproval(actionType),
      riskHint: getBoundaryRiskHint(evaluateAction({
        actionType,
        sourceModule: 'manual',
        sourceId: 'policy',
        title: getActionTypeLabel(actionType),
        description: '',
        amount: 0,
        customerName: '',
        relatedOfferId: '',
        relatedWorkflowRunId: '',
        requestedByAgentId: 'jarvis',
        metadata: {},
      })),
    }
  })
}

export function resetCeoActionBoundaryMockStateForTest() {
  resetMockApprovals()
}

export function resetMockApprovals() {
  mockApprovals = []
  approvalBridgeService.resetUnifiedApprovals()
  persistMockApprovals()
}

export function exportMockApprovals(): MockApprovalRequest[] {
  return listMockApprovalRequests()
}

export const ceoActionBoundaryService = {
  classifyAction,
  requiresCeoApproval,
  isActionAllowed,
  evaluateAction,
  createApprovalIfRequired,
  assertActionAllowed,
  listMockApprovalRequests,
  getActionLevelLabel,
  getActionTypeLabel,
  getBoundaryRiskHint,
  listActionPolicy,
  resetCeoActionBoundaryMockStateForTest,
  resetMockApprovals,
  exportMockApprovals,
}
