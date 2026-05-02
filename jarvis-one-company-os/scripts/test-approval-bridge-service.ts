import assert from 'node:assert/strict'
import { approvalBridgeService } from '../src/services/approvalBridgeService'
import { ceoActionBoundaryService } from '../src/services/ceoActionBoundaryService'
import { dailyRunService } from '../src/services/dailyRunService'
import { localPersistenceService, localStateKeys } from '../src/services/localPersistenceService'
import type { ActionBoundaryRequest, ActionDecision } from '../src/types'

localPersistenceService.clearAllOneCompanyLocalState()

const request: ActionBoundaryRequest = {
  actionType: 'quote_price',
  sourceModule: 'sales',
  sourceId: 'lead_bridge_test',
  title: '正式报价审批',
  description: '向客户发送正式报价前的 CEO 审批',
  amount: 19800,
  customerName: 'Bridge Test Customer',
  relatedOfferId: 'enterprise_automation_mvp',
  relatedWorkflowRunId: '',
  requestedByAgentId: 'fred',
  metadata: { test: true },
}

const decision: ActionDecision = ceoActionBoundaryService.evaluateAction(request)
const created = approvalBridgeService.createApprovalFromBoundaryRequest(request, decision)
assert.equal(created.status, 'pending')
assert.equal(created.actionType, 'quote_price')
assert.equal(created.sourceModule, 'sales')
assert.ok(created.description.includes('Bridge Test Customer'))

const approvals = approvalBridgeService.listUnifiedApprovals()
assert.ok(approvals.some(approval => approval.id === created.id))

const status = approvalBridgeService.getApprovalStatusForSource('sales', 'lead_bridge_test', 'quote_price')
assert.equal(status?.status, 'pending')

const approved = approvalBridgeService.approveUnifiedApproval(created.id, 'ceo')
assert.equal(approved?.status, 'approved')
assert.equal(approvalBridgeService.getApprovalById(created.id)?.status, 'approved')

const rejectedRequest = { ...request, sourceId: 'lead_bridge_rejected' }
const rejectedCreated = approvalBridgeService.createApprovalFromBoundaryRequest(rejectedRequest, ceoActionBoundaryService.evaluateAction(rejectedRequest))
const rejected = approvalBridgeService.rejectUnifiedApproval(rejectedCreated.id, 'ceo', '报价范围不清晰')
assert.equal(rejected?.status, 'rejected')
assert.equal(rejected?.rejectedReason, '报价范围不清晰')

const boundaryResult = ceoActionBoundaryService.createApprovalIfRequired({
  ...request,
  sourceId: 'lead_boundary_create',
})
assert.ok(boundaryResult.approvalId)
assert.ok(approvalBridgeService.getApprovalById(boundaryResult.approvalId))

const mockApprovals = ceoActionBoundaryService.listMockApprovalRequests()
assert.ok(mockApprovals.some(approval => approval.id === boundaryResult.approvalId))

const persisted = localPersistenceService.getItem(localStateKeys.unifiedApprovals, [])
assert.ok(persisted.length >= 3)

const riskSummary = dailyRunService.buildRiskSummary()
assert.ok(riskSummary.ceoApprovalRequiredCount >= 1)

localPersistenceService.clearAllOneCompanyLocalState()

console.log('approval bridge service tests passed')
