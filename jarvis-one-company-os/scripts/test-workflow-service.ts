import assert from 'node:assert/strict'
import { getOfferById } from '../src/services/offerCatalogService'
import {
  createWorkflowRun,
  getRecommendedWorkflowForSalesLead,
  getWorkflowProgress,
  getWorkflowRunById,
  getWorkflowTemplateById,
  listWorkflowRuns,
  listWorkflowSteps,
  listWorkflowTemplates,
  resetWorkflowMockStateForTest,
  updateWorkflowStepStatus,
} from '../src/services/workflowService'
import type { SalesLead } from '../src/types'

resetWorkflowMockStateForTest()

const templates = listWorkflowTemplates()
assert.equal(templates.length, 3)
assert.equal(templates.every(template => template.steps.length > 0), true)

const diagnosisTemplate = getWorkflowTemplateById('wf_ai_automation_diagnosis')
assert.equal(diagnosisTemplate?.name, 'AI 自动化诊断报告')
assert.equal(getWorkflowTemplateById('missing-template'), undefined)

const runResult = createWorkflowRun('wf_ai_automation_diagnosis', {
  contextType: 'sales_lead',
  contextId: 'lead_test_001',
})
assert.equal(runResult.created, true)
assert.equal(runResult.run.status, 'pending')
assert.equal(runResult.run.contextType, 'sales_lead')
assert.equal(runResult.run.contextId, 'lead_test_001')
assert.equal(listWorkflowSteps(runResult.run.id).length, diagnosisTemplate?.steps.length)
assert.equal(getWorkflowRunById(runResult.run.id)?.id, runResult.run.id)
assert.equal(listWorkflowRuns().length, 1)

const duplicate = createWorkflowRun('wf_ai_automation_diagnosis', {
  contextType: 'sales_lead',
  contextId: 'lead_test_001',
})
assert.equal(duplicate.created, false)
assert.equal(duplicate.run.id, runResult.run.id)

const firstStep = listWorkflowSteps(runResult.run.id)[0]
assert.equal(updateWorkflowStepStatus(firstStep.id, 'completed')?.status, 'completed')
const progress = getWorkflowProgress(runResult.run.id)
assert.equal(progress.totalSteps, diagnosisTemplate?.steps.length)
assert.equal(progress.completedSteps, 1)
assert.equal(progress.percentComplete > 0, true)
assert.equal(progress.hasFailure, false)

const leadWithKnownWorkflow: SalesLead = {
  id: 'lead-known',
  opportunityId: 'opp-known',
  customerName: 'Known Co',
  contactHint: '',
  painPoint: '需要自动化诊断',
  stage: 'won',
  valueEstimate: 1999,
  recommendedOfferId: 'ai_automation_diagnosis',
  nextAction: '创建交付工作流',
  ownerAgentId: 'fred',
  requiresCeoApproval: true,
  approvalReason: '',
  createdAt: '2026-05-01',
  updatedAt: '2026-05-01',
}
assert.equal(getRecommendedWorkflowForSalesLead(leadWithKnownWorkflow)?.id, 'wf_ai_automation_diagnosis')

const fallbackOffer = getOfferById('private_one_company_os')
assert.equal(fallbackOffer?.deliveryWorkflowId, 'wf_private_one_company_os')
assert.equal(getWorkflowTemplateById(fallbackOffer?.deliveryWorkflowId ?? ''), undefined)
assert.equal(
  getRecommendedWorkflowForSalesLead({ ...leadWithKnownWorkflow, recommendedOfferId: 'private_one_company_os' })?.id,
  'wf_ai_automation_diagnosis',
)

console.log('workflow service tests passed')
