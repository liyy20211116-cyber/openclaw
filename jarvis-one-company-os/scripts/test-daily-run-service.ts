import assert from 'node:assert/strict'
import { createWorkflowRun, resetWorkflowMockStateForTest, updateWorkflowRunStatus } from '../src/services/workflowService'
import {
  checkRequiredArtifacts,
  dailyRunService,
  generateDailyRunFromCurrentSystem,
  generateJarvisStandup,
  getCompanyRunHealth,
  getDailyRunCompletionRate,
  getRequiredDailyArtifacts,
  markArtifactBlocked,
  markArtifactCompleted,
  resetDailyRunMockStateForTest,
} from '../src/services/dailyRunService'

resetWorkflowMockStateForTest()
resetDailyRunMockStateForTest()

const requiredArtifacts = getRequiredDailyArtifacts()
assert.equal(requiredArtifacts.length >= 8, true)
assert.equal(requiredArtifacts.includes('jarvis_standup'), true)

createWorkflowRun('wf_ai_automation_diagnosis', { contextType: 'sales_lead', contextId: 'lead_payment_pending_003' })
updateWorkflowRunStatus('wfr_wf_ai_automation_diagnosis_sales_lead_lead_payment_pending_003', 'running')

const run = generateDailyRunFromCurrentSystem()
assert.equal(run.opportunitySummary.totalOpportunities >= 5, true)
assert.equal(run.salesSummary.totalLeads >= 3, true)
assert.equal(run.workflowSummary.totalRuns >= 1, true)
assert.equal(run.revenueSummary.expectedRevenue >= 21_799, true)
assert.equal(run.jarvisStandup.length > 20, true)

const rate = getDailyRunCompletionRate(run)
assert.equal(rate > 0 && rate < 100, true)

const artifactCheck = checkRequiredArtifacts(run.date)
assert.equal(artifactCheck.status, 'incomplete')
assert.equal(artifactCheck.missingArtifacts.length > 0, true)

const standup = generateJarvisStandup(run)
assert.match(standup, /机会/)
assert.match(standup, /销售/)
assert.match(standup, /收入/)
assert.match(standup, /风险/)

markArtifactCompleted('content_or_draft')
markArtifactBlocked('risk_audit', '需要 CEO 审批风险项')
const health = getCompanyRunHealth()
assert.equal(['attention', 'blocked', 'healthy'].includes(health.healthStatus), true)
assert.equal(health.blockedArtifacts.includes('risk_audit'), true)

assert.equal(dailyRunService.getTodayDailyRun().artifacts.length >= requiredArtifacts.length, true)

console.log('daily run service tests passed')
