import assert from 'node:assert/strict'
import { approvalBridgeService } from '../src/services/approvalBridgeService'
import { ceoActionBoundaryService } from '../src/services/ceoActionBoundaryService'
import { dailyRunService } from '../src/services/dailyRunService'
import { localPersistenceService, localStateKeys } from '../src/services/localPersistenceService'

localPersistenceService.clearAllOneCompanyLocalState()

const emptyTrend = dailyRunService.getDailyRunTrendSummary()
assert.equal(emptyTrend.recentRunCount, 0)
assert.equal(emptyTrend.averageCompletionRate, 0)

ceoActionBoundaryService.createApprovalIfRequired({
  actionType: 'quote_price',
  sourceModule: 'sales',
  sourceId: 'lead_daily_log_test',
  title: 'Daily log quote approval',
  description: 'Create approval for daily run log test',
  amount: 19800,
  customerName: 'Daily Log Customer',
  relatedOfferId: 'enterprise_automation_mvp',
  relatedWorkflowRunId: '',
  requestedByAgentId: 'fred',
  metadata: {},
})

const approvalSummary = dailyRunService.buildApprovalSummary()
assert.ok(approvalSummary.totalApprovals >= 1)
assert.ok(approvalSummary.pendingApprovals >= 1)
assert.ok(approvalSummary.a3PendingCount >= 1)
assert.ok(approvalSummary.latestApprovalTitles.length > 0)

const firstLog = dailyRunService.generateDailyRunSnapshot({ generatedBy: 'manual', notes: 'first snapshot' })
assert.ok(firstLog.id)
assert.equal(firstLog.generatedBy, 'manual')
assert.equal(firstLog.notes, 'first snapshot')
assert.ok(firstLog.jarvisStandup.length > 0)
assert.ok(firstLog.approvalSummary.pendingApprovals >= 1)

const secondLog = dailyRunService.generateDailyRunSnapshot({ generatedBy: 'jarvis', notes: 'second snapshot' })
assert.equal(secondLog.generatedBy, 'jarvis')

const logs = dailyRunService.listDailyRunLogs()
assert.ok(logs.length >= 2)
assert.equal(logs[0].id, secondLog.id)
assert.equal(dailyRunService.getLatestDailyRunLog()?.id, secondLog.id)
assert.equal(dailyRunService.getDailyRunLogById(firstLog.id)?.notes, 'first snapshot')

const comparison = dailyRunService.compareDailyRunLogs(secondLog.id, firstLog.id)
assert.ok(comparison)
assert.equal(typeof comparison?.completionRateDelta, 'number')
assert.equal(typeof comparison?.pendingApprovalsDelta, 'number')

const trend = dailyRunService.getDailyRunTrendSummary()
assert.ok(trend.recentRunCount >= 2)
assert.ok(trend.averageCompletionRate >= 0)
assert.ok(['healthy', 'attention', 'blocked', 'none'].includes(trend.latestHealthStatus))

const exported = localPersistenceService.exportAllOneCompanyLocalState()
assert.ok(exported[localStateKeys.dailyRunLogs], 'export should include daily_run_logs')

dailyRunService.deleteDailyRunLog(firstLog.id)
assert.equal(dailyRunService.getDailyRunLogById(firstLog.id), undefined)

dailyRunService.clearDailyRunLogs()
assert.equal(dailyRunService.listDailyRunLogs().length, 0)

approvalBridgeService.resetUnifiedApprovals()
localPersistenceService.clearAllOneCompanyLocalState()

console.log('daily run log service tests passed')
