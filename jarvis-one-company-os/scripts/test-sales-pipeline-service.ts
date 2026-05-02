import assert from 'node:assert/strict'
import {
  checkApprovalRequired,
  createSalesLeadFromOpportunity,
  getNextAction,
  getSalesLeadById,
  getStageLabel,
  getStageRiskHint,
  listSalesLeads,
  resetSalesPipelineMockStateForTest,
  updateSalesLeadStage,
} from '../src/services/salesPipelineService'
import type { SalesLead, SalesLeadStage } from '../src/types'

resetSalesPipelineMockStateForTest()

const leads = listSalesLeads()
assert.equal(leads.length, 3)
assert.equal(leads.some(lead => lead.stage === 'qualified'), true)
assert.equal(leads.some(lead => lead.stage === 'quote_review'), true)
assert.equal(leads.some(lead => lead.stage === 'payment_pending'), true)

const existing = getSalesLeadById(leads[0].id)
assert.equal(existing?.id, leads[0].id)
assert.equal(getSalesLeadById('missing-lead'), undefined)

const created = createSalesLeadFromOpportunity('opp_xhs_ops_001')
assert.equal(created.created, true)
assert.equal(created.lead.opportunityId, 'opp_xhs_ops_001')
assert.equal(created.lead.stage, 'qualified')
assert.equal(created.lead.customerName, 'Solo Studio A')
assert.equal(created.lead.recommendedOfferId.length > 0, true)

const duplicate = createSalesLeadFromOpportunity('opp_xhs_ops_001')
assert.equal(duplicate.created, false)
assert.equal(duplicate.lead.id, created.lead.id)

const approvalStages: SalesLeadStage[] = ['quote_review', 'payment_pending', 'won']
for (const stage of approvalStages) {
  const lead: SalesLead = { ...created.lead, stage }
  assert.equal(checkApprovalRequired(lead), true)
}
assert.equal(checkApprovalRequired({ ...created.lead, stage: 'proposal' }), false)

const expectedActions: Record<SalesLeadStage, RegExp> = {
  discovered: /客户背景|痛点/,
  qualified: /诊断/,
  diagnosis: /方案/,
  proposal: /报价草稿/,
  quote_review: /CEO/,
  payment_pending: /确认收款/,
  won: /交付工作流/,
  lost: /复盘/,
}
for (const [stage, pattern] of Object.entries(expectedActions) as Array<[SalesLeadStage, RegExp]>) {
  assert.match(getNextAction({ ...created.lead, stage }), pattern)
  assert.equal(getStageLabel(stage).length > 0, true)
}

assert.match(getStageRiskHint({ ...created.lead, stage: 'quote_review' }), /CEO/)
assert.match(getStageRiskHint({ ...created.lead, stage: 'payment_pending' }), /不得自动确认收款/)
assert.match(getStageRiskHint({ ...created.lead, stage: 'won' }), /成交必须/)

const updated = updateSalesLeadStage(created.lead.id, 'quote_review')
assert.equal(updated?.stage, 'quote_review')
assert.equal(updated?.requiresCeoApproval, true)
assert.match(updated?.approvalReason ?? '', /CEO|审批|报价/)

console.log('sales pipeline service tests passed')
