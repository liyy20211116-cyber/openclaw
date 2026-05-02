import assert from 'node:assert/strict'
import {
  assertActionAllowed,
  classifyAction,
  createApprovalIfRequired,
  evaluateAction,
  isActionAllowed,
  listMockApprovalRequests,
  requiresCeoApproval,
  resetCeoActionBoundaryMockStateForTest,
} from '../src/services/ceoActionBoundaryService'

resetCeoActionBoundaryMockStateForTest()

assert.equal(classifyAction('scan_opportunity'), 'A0_READ_ONLY')
assert.equal(classifyAction('generate_quote_draft'), 'A1_INTERNAL_DRAFT')
assert.equal(classifyAction('create_workflow_run'), 'A2_INTERNAL_WRITE')
assert.equal(classifyAction('quote_price'), 'A3_EXTERNAL_ACTION')
assert.equal(classifyAction('confirm_payment'), 'A4_FINANCIAL_LEGAL')

assert.equal(requiresCeoApproval('publish_content'), true)
assert.equal(requiresCeoApproval('issue_refund'), true)
assert.equal(requiresCeoApproval('match_offer'), false)
assert.equal(requiresCeoApproval('create_internal_task'), false)

assert.equal(isActionAllowed('generate_daily_report'), true)
assert.equal(isActionAllowed('mark_artifact_completed'), true)
assert.equal(isActionAllowed('send_private_message'), false)
assert.equal(isActionAllowed('recognize_revenue'), false)

const quoteDecision = evaluateAction({
  actionType: 'quote_price',
  sourceModule: 'sales',
  sourceId: 'lead_quote_review_002',
  title: '正式报价',
  description: '向客户发送正式报价',
  amount: 19800,
  customerName: 'Regional Service Company',
  relatedOfferId: 'enterprise_automation_mvp',
  relatedWorkflowRunId: '',
  requestedByAgentId: 'fred',
  metadata: {},
})
assert.equal(quoteDecision.requiresCeoApproval, true)
assert.equal(quoteDecision.allowed, false)

const paymentDecision = evaluateAction({
  actionType: 'confirm_payment',
  sourceModule: 'revenue',
  sourceId: 'rev_payment_pending_003',
  title: '确认收款',
  description: '确认客户付款',
  amount: 1999,
  customerName: 'Private Training Cohort',
  relatedOfferId: 'ai_automation_diagnosis',
  relatedWorkflowRunId: '',
  requestedByAgentId: 'percy',
  metadata: {},
})
assert.equal(paymentDecision.actionLevel, 'A4_FINANCIAL_LEGAL')
assert.equal(paymentDecision.requiresCeoApproval, true)

const workflowDecision = evaluateAction({
  actionType: 'create_workflow_run',
  sourceModule: 'workflow',
  sourceId: 'lead_payment_pending_003',
  title: '创建交付工作流',
  description: '创建内部交付工作流',
  amount: 0,
  customerName: '',
  relatedOfferId: '',
  relatedWorkflowRunId: '',
  requestedByAgentId: 'jarvis',
  metadata: {},
})
assert.equal(workflowDecision.allowed, true)
assert.equal(workflowDecision.requiresCeoApproval, false)

const approvalResult = createApprovalIfRequired({
  actionType: 'quote_price',
  sourceModule: 'sales',
  sourceId: 'lead_quote_review_002',
  title: '正式报价审批',
  description: '向客户发送正式报价前的 CEO 审批',
  amount: 19800,
  customerName: 'Regional Service Company',
  relatedOfferId: 'enterprise_automation_mvp',
  relatedWorkflowRunId: '',
  requestedByAgentId: 'fred',
  metadata: {},
})
assert.equal(approvalResult.decision.requiresCeoApproval, true)
assert.equal(Boolean(approvalResult.approvalId), true)
assert.equal(listMockApprovalRequests().length, 1)

const unknownDecision = evaluateAction({
  actionType: 'unknown_action' as never,
  sourceModule: 'manual',
  sourceId: 'manual_001',
  title: '未知动作',
  description: '未知动作应该阻塞',
  amount: 0,
  customerName: '',
  relatedOfferId: '',
  relatedWorkflowRunId: '',
  requestedByAgentId: 'jarvis',
  metadata: {},
})
assert.equal(unknownDecision.blocked, true)
assert.throws(() => assertActionAllowed({ ...unknownDecision, sourceModule: 'manual', sourceId: 'manual_001', title: '未知动作', description: '', amount: 0, customerName: '', relatedOfferId: '', relatedWorkflowRunId: '', requestedByAgentId: 'jarvis', metadata: {} } as never))

console.log('ceo action boundary service tests passed')
