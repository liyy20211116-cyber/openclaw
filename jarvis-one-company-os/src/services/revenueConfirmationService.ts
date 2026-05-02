import revenueSeed from '../../../config/revenue-records.json'
import type {
  RevenueConfirmationSummary,
  RevenueRecord,
  RevenueSourceType,
  RevenueStatus,
  SalesLead,
} from '../types'
import { offerCatalogService } from './offerCatalogService'
import { salesPipelineService } from './salesPipelineService'
import { ceoActionBoundaryService } from './ceoActionBoundaryService'
import { localPersistenceService, localStateKeys } from './localPersistenceService'
import type { ActionType } from '../types'

type RevenueRecordFile = {
  records: RevenueRecord[]
}

type RevenueActionResult = {
  record: RevenueRecord
  created?: boolean
  message: string
}

const seedData = revenueSeed as RevenueRecordFile

const statusLabels: Record<RevenueStatus, string> = {
  expected: '预计收入',
  quoted: '报价收入',
  payment_pending: '待收款',
  payment_confirmed: '已确认收款',
  delivery_started: '交付中',
  delivered: '已交付',
  recognized: '已确认收入',
  refunded: '已退款',
}

const seedRecords = seedData.records.map(normalizeRecord)
let localRecords: RevenueRecord[] = localPersistenceService.getOrSeed(localStateKeys.revenueRecords, seedRecords).map(normalizeRecord)

function persistRevenueRecords() {
  localPersistenceService.setItem(localStateKeys.revenueRecords, localRecords)
}

function refreshRevenueRecords() {
  localRecords = localPersistenceService.getOrSeed(localStateKeys.revenueRecords, seedRecords).map(normalizeRecord)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function cloneRecord(record: RevenueRecord): RevenueRecord {
  return { ...record }
}

function normalizeRecord(record: RevenueRecord): RevenueRecord {
  const requiresCeoApproval = record.requiresCeoApproval || statusNeedsApproval(record.status)
  return {
    ...record,
    requiresCeoApproval,
    approvalReason: record.approvalReason || (requiresCeoApproval ? getDefaultApprovalReason(record.status) : ''),
  }
}

function statusNeedsApproval(status: RevenueStatus) {
  return status === 'quoted' || status === 'payment_pending' || status === 'delivered'
}

function getDefaultApprovalReason(status: RevenueStatus) {
  if (status === 'quoted') return '正式报价前必须 CEO 审批'
  if (status === 'payment_pending') return '等待 CEO 确认收款，不能自动成交'
  if (status === 'delivered') return '已交付后仍需 CEO 确认才能进入正式收入'
  if (status === 'payment_confirmed') return '确认收款必须由 CEO 审批'
  if (status === 'recognized') return '正式确认收入必须由 CEO 审批'
  if (status === 'refunded') return '退款必须由 CEO 审批'
  return ''
}

function getLeadOrThrow(leadId: string): SalesLead {
  const lead = salesPipelineService.getSalesLeadById(leadId)
  if (!lead) throw new Error(`SalesLead not found: ${leadId}`)
  return lead
}

function buildRecordFromLead(lead: SalesLead, status: RevenueStatus): RevenueRecord {
  const offer = offerCatalogService.getOfferById(lead.recommendedOfferId)
  return normalizeRecord({
    id: `rev_${status}_${lead.id}`,
    sourceType: 'sales_lead',
    sourceId: lead.id,
    customerName: lead.customerName,
    offerId: offer?.id ?? lead.recommendedOfferId,
    offerName: offer?.name ?? '未匹配标准产品',
    amount: offer?.price ?? lead.valueEstimate,
    status,
    paymentEvidence: '',
    confirmedBy: '',
    confirmedAt: '',
    deliveryWorkflowRunId: '',
    notes: status === 'expected'
      ? '来自销售线索的预计收入，不计入真实收入。'
      : status === 'quoted'
        ? '报价收入不计入真实收入，正式报价必须进入 CEO 审批。'
        : '待收款记录不计入真实收入，收款确认必须进入 CEO 审批。',
    requiresCeoApproval: status === 'quoted' || status === 'payment_pending',
    approvalReason: '',
    createdAt: today(),
    updatedAt: today(),
  })
}

function createFromSalesLead(leadId: string, status: RevenueStatus): RevenueActionResult {
  refreshRevenueRecords()
  const existing = localRecords.find(record => record.sourceType === 'sales_lead' && record.sourceId === leadId && record.status === status)
  if (existing) {
    return { record: cloneRecord(existing), created: false, message: '该销售线索已存在同类型收入记录，未重复创建。' }
  }

  const lead = getLeadOrThrow(leadId)
  const record = buildRecordFromLead(lead, status)
  localRecords = [record, ...localRecords]
  persistRevenueRecords()
  return { record: cloneRecord(record), created: true, message: '已创建本地收入确认记录。' }
}

function updateRecord(revenueId: string, updater: (record: RevenueRecord) => RevenueRecord): RevenueActionResult {
  refreshRevenueRecords()
  let updated: RevenueRecord | undefined
  localRecords = localRecords.map(record => {
    if (record.id !== revenueId) return record
    updated = normalizeRecord(updater(record))
    return updated
  })
  if (!updated) throw new Error(`RevenueRecord not found: ${revenueId}`)
  persistRevenueRecords()
  return { record: cloneRecord(updated), message: getRevenueRiskHint(updated) || '已更新本地收入确认记录。' }
}

function requestBoundary(record: RevenueRecord, actionType: ActionType) {
  return ceoActionBoundaryService.createApprovalIfRequired({
    actionType,
    sourceModule: 'revenue',
    sourceId: record.id,
    title: `${ceoActionBoundaryService.getActionTypeLabel(actionType)}：${record.customerName}`,
    description: `${record.offerName} · ${record.notes}`,
    amount: record.amount,
    customerName: record.customerName,
    relatedOfferId: record.offerId,
    relatedWorkflowRunId: record.deliveryWorkflowRunId,
    requestedByAgentId: record.confirmedBy || 'percy',
    metadata: { status: record.status },
  })
}

export function listRevenueRecords(): RevenueRecord[] {
  refreshRevenueRecords()
  return localRecords.map(record => cloneRecord(normalizeRecord(record)))
}

export function getRevenueRecordById(id: string): RevenueRecord | undefined {
  return listRevenueRecords().find(record => record.id === id)
}

export function createExpectedRevenueFromSalesLead(leadId: string) {
  return createFromSalesLead(leadId, 'expected')
}

export function createQuotedRevenueFromSalesLead(leadId: string) {
  return createFromSalesLead(leadId, 'quoted')
}

export function createPaymentPendingFromSalesLead(leadId: string) {
  return createFromSalesLead(leadId, 'payment_pending')
}

export function requestPaymentConfirmation(revenueId: string): RevenueActionResult {
  const result = updateRecord(revenueId, record => ({
    ...record,
    requiresCeoApproval: true,
    approvalReason: '请求 CEO 确认收款，当前为本地模拟，未执行真实财务动作。',
    updatedAt: today(),
  }))
  const boundary = requestBoundary(result.record, 'confirm_payment')
  return { ...result, message: `${boundary.decision.reason}${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''}` }
}

export function confirmPayment(revenueId: string, confirmedBy: string): RevenueActionResult {
  const result = updateRecord(revenueId, record => ({
    ...record,
    status: 'payment_confirmed',
    confirmedBy,
    confirmedAt: today(),
    requiresCeoApproval: true,
    approvalReason: '确认收款必须由 CEO 审批，当前仅为本地模拟确认。',
    updatedAt: today(),
  }))
  const boundary = requestBoundary(result.record, 'confirm_payment')
  return { ...result, message: `该动作需要 CEO 审批，当前为本地模拟，未执行真实收款确认。${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''}` }
}

export function markDeliveryStarted(revenueId: string, workflowRunId: string): RevenueActionResult {
  return updateRecord(revenueId, record => ({
    ...record,
    status: 'delivery_started',
    deliveryWorkflowRunId: workflowRunId,
    notes: `${record.notes} 已关联交付工作流。`.trim(),
    requiresCeoApproval: false,
    approvalReason: '',
    updatedAt: today(),
  }))
}

export function markDelivered(revenueId: string): RevenueActionResult {
  return updateRecord(revenueId, record => ({
    ...record,
    status: 'delivered',
    requiresCeoApproval: true,
    approvalReason: '已交付后仍需 CEO 确认才能进入正式收入。',
    updatedAt: today(),
  }))
}

export function requestRevenueRecognition(revenueId: string): RevenueActionResult {
  const result = updateRecord(revenueId, record => ({
    ...record,
    requiresCeoApproval: true,
    approvalReason: '请求 CEO 正式确认收入，当前为本地模拟，未写入真实财务系统。',
    updatedAt: today(),
  }))
  const boundary = requestBoundary(result.record, 'recognize_revenue')
  return { ...result, message: `${boundary.decision.reason}${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''}` }
}

export function recognizeRevenue(revenueId: string, confirmedBy: string): RevenueActionResult {
  const result = updateRecord(revenueId, record => ({
    ...record,
    status: 'recognized',
    confirmedBy,
    confirmedAt: today(),
    requiresCeoApproval: true,
    approvalReason: '正式确认收入必须由 CEO 审批，当前仅为本地模拟确认。',
    updatedAt: today(),
  }))
  const boundary = requestBoundary(result.record, 'recognize_revenue')
  return { ...result, message: `该动作需要 CEO 审批，当前为本地模拟，未执行真实收入确认。${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''}` }
}

export function requestRefund(revenueId: string): RevenueActionResult {
  const result = updateRecord(revenueId, record => ({
    ...record,
    requiresCeoApproval: true,
    approvalReason: '请求退款必须进入 CEO 审批，当前为本地模拟。',
    updatedAt: today(),
  }))
  const boundary = requestBoundary(result.record, 'issue_refund')
  return { ...result, message: `${boundary.decision.reason}${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''}` }
}

export function refundRevenue(revenueId: string, confirmedBy: string): RevenueActionResult {
  const result = updateRecord(revenueId, record => ({
    ...record,
    status: 'refunded',
    confirmedBy,
    confirmedAt: today(),
    requiresCeoApproval: true,
    approvalReason: '退款必须由 CEO 审批，当前仅为本地模拟退款。',
    updatedAt: today(),
  }))
  const boundary = requestBoundary(result.record, 'issue_refund')
  return { ...result, message: `该动作需要 CEO 审批，当前为本地模拟，未执行真实退款。${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''}` }
}

export function getRevenueSummary(): RevenueConfirmationSummary {
  const records = listRevenueRecords()
  return {
    expectedRevenue: records
      .filter(record => record.status === 'expected' || record.status === 'quoted')
      .reduce((sum, record) => sum + record.amount, 0),
    paymentPending: records
      .filter(record => record.status === 'payment_pending')
      .reduce((sum, record) => sum + record.amount, 0),
    confirmedCash: records
      .filter(isConfirmedCash)
      .reduce((sum, record) => sum + record.amount, 0),
    recognizedRevenue: records
      .filter(isRecognizedRevenue)
      .reduce((sum, record) => sum + record.amount, 0),
    refunded: records
      .filter(record => record.status === 'refunded')
      .reduce((sum, record) => sum + record.amount, 0),
    requiresCeoApprovalCount: records.filter(record => record.requiresCeoApproval).length,
    totalRecords: records.length,
  }
}

export function getRevenueStatusLabel(status: RevenueStatus): string {
  return statusLabels[status]
}

export function getRevenueRiskHint(record: Pick<RevenueRecord, 'status' | 'requiresCeoApproval'>): string {
  if (record.status === 'expected') return '预计收入不算真实收入。'
  if (record.status === 'quoted') return '报价收入不算真实收入，正式报价前必须 CEO 审批。'
  if (record.status === 'payment_pending') return '待收款不算真实收入，不得自动确认收款。'
  if (record.status === 'payment_confirmed') return '已确认收款只算现金确认，不等于正式收入。'
  if (record.status === 'delivery_started') return '交付中不自动确认收入。'
  if (record.status === 'delivered') return '已交付后仍需 CEO 确认收入。'
  if (record.status === 'recognized') return '正式收入仅在 CEO 确认后计入。'
  if (record.status === 'refunded') return '退款需单独统计，不得正向计入收入。'
  return record.requiresCeoApproval ? '该动作需要 CEO 审批。' : ''
}

export function isConfirmedCash(record: Pick<RevenueRecord, 'status'>): boolean {
  return record.status === 'payment_confirmed' || record.status === 'delivery_started' || record.status === 'delivered'
}

export function isRecognizedRevenue(record: Pick<RevenueRecord, 'status'>): boolean {
  return record.status === 'recognized'
}

export function hasRevenueRecordForSource(sourceType: RevenueSourceType, sourceId: string, status?: RevenueStatus): boolean {
  return listRevenueRecords().some(record => record.sourceType === sourceType && record.sourceId === sourceId && (!status || record.status === status))
}

export function resetRevenueConfirmationMockStateForTest() {
  resetRevenueRecordsToSeed()
}

export function resetRevenueRecordsToSeed() {
  localRecords = seedRecords.map(normalizeRecord)
  persistRevenueRecords()
}

export function exportRevenueRecords(): RevenueRecord[] {
  return listRevenueRecords()
}

export const revenueConfirmationService = {
  listRevenueRecords,
  getRevenueRecordById,
  createExpectedRevenueFromSalesLead,
  createQuotedRevenueFromSalesLead,
  createPaymentPendingFromSalesLead,
  requestPaymentConfirmation,
  confirmPayment,
  markDeliveryStarted,
  markDelivered,
  requestRevenueRecognition,
  recognizeRevenue,
  requestRefund,
  refundRevenue,
  getRevenueSummary,
  getRevenueStatusLabel,
  getRevenueRiskHint,
  isConfirmedCash,
  isRecognizedRevenue,
  hasRevenueRecordForSource,
  resetRevenueConfirmationMockStateForTest,
  resetRevenueRecordsToSeed,
  exportRevenueRecords,
}
