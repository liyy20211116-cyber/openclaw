import assert from 'node:assert/strict'
import type { DeliveryWorkflowStep, MockApprovalRequest, RevenueRecord, SalesLead } from '../src/types'

const { localPersistenceService, localStateKeys } = await import('../src/services/localPersistenceService')

localPersistenceService.clearAllOneCompanyLocalState()

const seeded = localPersistenceService.getOrSeed('unit_test_seed', { count: 1 })
assert.deepEqual(seeded, { count: 1 })
assert.deepEqual(localPersistenceService.getItem('unit_test_seed', { count: 0 }), { count: 1 })

localPersistenceService.setItem('unit_test_object', { name: 'Jarvis', enabled: true })
assert.deepEqual(localPersistenceService.getItem('unit_test_object', null), { name: 'Jarvis', enabled: true })

const updated = localPersistenceService.updateItem('unit_test_object', (value: { name: string; enabled: boolean; version?: number }) => ({
  ...value,
  version: 2,
}), { name: 'Fallback', enabled: false })
assert.equal(updated.version, 2)
assert.equal(localPersistenceService.getItem<{ version: number }>('unit_test_object', { version: 0 }).version, 2)

const exported = localPersistenceService.exportAllOneCompanyLocalState()
assert.ok(exported.unit_test_seed, 'export should include seeded key')
assert.ok(exported.unit_test_object, 'export should include set key')

localPersistenceService.clearAllOneCompanyLocalState()
assert.deepEqual(localPersistenceService.listLocalStateKeys(), [])

localPersistenceService.importAllOneCompanyLocalState(exported)
assert.equal(localPersistenceService.getItem<{ version: number }>('unit_test_object', { version: 0 }).version, 2)

localPersistenceService.clearAllOneCompanyLocalState()

const { salesPipelineService } = await import('../src/services/salesPipelineService')
const { workflowService } = await import('../src/services/workflowService')
const { revenueConfirmationService } = await import('../src/services/revenueConfirmationService')
const { ceoActionBoundaryService } = await import('../src/services/ceoActionBoundaryService')

salesPipelineService.resetSalesLeadsToSeed()
const leadResult = salesPipelineService.createSalesLeadFromOpportunity('opp_xhs_ops_001')
assert.equal(leadResult.created, true)
const updatedLead = salesPipelineService.updateSalesLeadStage(leadResult.lead.id, 'proposal')
assert.equal(updatedLead?.stage, 'proposal')
const persistedLeads = localPersistenceService.getItem<SalesLead[]>(localStateKeys.salesLeads, [])
assert.ok(persistedLeads.some(lead => lead.id === leadResult.lead.id && lead.stage === 'proposal'))

workflowService.clearWorkflowRuns()
const workflowResult = workflowService.createWorkflowRun('wf_ai_automation_diagnosis', {
  contextType: 'sales_lead',
  contextId: leadResult.lead.id,
})
assert.equal(workflowResult.created, true)
workflowService.updateWorkflowStepStatus(workflowResult.steps[0].id, 'completed')
const persistedSteps = localPersistenceService.getItem<DeliveryWorkflowStep[]>(localStateKeys.workflowSteps, [])
assert.ok(persistedSteps.some(step => step.id === workflowResult.steps[0].id && step.status === 'completed'))

revenueConfirmationService.resetRevenueRecordsToSeed()
const revenueResult = revenueConfirmationService.createQuotedRevenueFromSalesLead(leadResult.lead.id)
assert.equal(revenueResult.created, true)
revenueConfirmationService.markDelivered(revenueResult.record.id)
const persistedRevenue = localPersistenceService.getItem<RevenueRecord[]>(localStateKeys.revenueRecords, [])
assert.ok(persistedRevenue.some(record => record.id === revenueResult.record.id && record.status === 'delivered'))

ceoActionBoundaryService.resetMockApprovals()
const approvalResult = ceoActionBoundaryService.createApprovalIfRequired({
  actionType: 'quote_price',
  sourceModule: 'sales',
  sourceId: leadResult.lead.id,
  title: 'Quote approval',
  description: 'Quote approval persistence test',
  amount: 1999,
  customerName: leadResult.lead.customerName,
  relatedOfferId: leadResult.lead.recommendedOfferId,
  relatedWorkflowRunId: '',
  requestedByAgentId: leadResult.lead.ownerAgentId,
  metadata: {},
})
assert.ok(approvalResult.approvalId)
assert.ok(ceoActionBoundaryService.listMockApprovalRequests().some(approval => approval.id === approvalResult.approvalId))
assert.ok(localPersistenceService.getItem<MockApprovalRequest[]>(localStateKeys.mockApprovalRequests, []).some(approval => approval.id === approvalResult.approvalId))

localPersistenceService.clearAllOneCompanyLocalState()

console.log('local persistence service tests passed')
