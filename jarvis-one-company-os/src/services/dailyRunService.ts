import dailyRunSeed from '../../../config/daily-run-seeds.json'
import operatingPolicy from '../../../config/one-company-operating-policy.json'
import type {
  DailyAgentReport,
  DailyApprovalSummary,
  DailyOpportunitySummary,
  DailyRevenueSummary,
  DailyRiskSummary,
  DailyRun,
  DailyRunArtifact,
  DailyRunArtifactStatus,
  DailyRunLog,
  DailyRunSourceModule,
  DailyRunStatus,
  DailySalesSummary,
  DailyWorkflowSummary,
} from '../types'
import { agentService } from './agentService'
import { auditService } from './auditService'
import { opportunityService } from './opportunityService'
import { revenueConfirmationService } from './revenueConfirmationService'
import { salesPipelineService } from './salesPipelineService'
import { workflowService } from './workflowService'
import { ceoActionBoundaryService } from './ceoActionBoundaryService'
import { approvalBridgeService } from './approvalBridgeService'
import { localPersistenceService, localStateKeys } from './localPersistenceService'

type DailyRunFile = {
  runs: DailyRun[]
}

type OperatingPolicyFile = {
  required_daily_artifacts?: string[]
}

export type CompanyRunHealth = {
  healthStatus: 'healthy' | 'attention' | 'blocked'
  completionRate: number
  missingArtifacts: string[]
  blockedArtifacts: string[]
  ceoApprovalCount: number
  summaryText: string
}

const DEFAULT_REQUIRED_ARTIFACTS = [
  'content_or_draft',
  'monitoring_row',
  'lead_classification_or_zero_report',
  'reply_suggestions_if_needed',
  'risk_audit',
  'product_hypothesis',
  'agent_performance_record',
  'jarvis_standup',
]

const artifactMeta: Record<string, Omit<DailyRunArtifact, 'key' | 'status' | 'completedAt' | 'evidence'>> = {
  content_or_draft: {
    label: '内容或草稿',
    ownerAgentId: 'luna',
    description: '今日至少产出一条内容草稿、选题或发布候选。',
    sourceModule: 'content',
  },
  monitoring_row: {
    label: '监控记录',
    ownerAgentId: 'hermione',
    description: '记录运行中心、内容表现或系统健康监控。',
    sourceModule: 'runtime',
  },
  lead_classification_or_zero_report: {
    label: '线索分级或零报告',
    ownerAgentId: 'fred',
    description: '今日必须完成线索分级，若无线索则输出零报告。',
    sourceModule: 'sales',
  },
  reply_suggestions_if_needed: {
    label: '回复建议',
    ownerAgentId: 'dobby',
    description: '如有评论、私信或客户问题，仅生成回复建议，不自动发送。',
    sourceModule: 'content',
  },
  risk_audit: {
    label: '风险审计',
    ownerAgentId: 'snape',
    description: '检查发布、报价、收款、退款和交付承诺风险。',
    sourceModule: 'audit',
  },
  product_hypothesis: {
    label: '产品假设',
    ownerAgentId: 'mcgonagall',
    description: '根据机会和销售反馈更新产品假设。',
    sourceModule: 'opportunity',
  },
  agent_performance_record: {
    label: 'Agent 表现记录',
    ownerAgentId: 'neville',
    description: '记录 Agent 今日产出、阻塞和改进点。',
    sourceModule: 'runtime',
  },
  jarvis_standup: {
    label: 'Jarvis 站会日报',
    ownerAgentId: 'jarvis',
    description: '生成今日公司运营站会总结。',
    sourceModule: 'runtime',
  },
}

const seedData = dailyRunSeed as DailyRunFile
const policyData = operatingPolicy as OperatingPolicyFile

const seedRuns = seedData.runs.map(cloneRun)
let localRuns: DailyRun[] = localPersistenceService.getOrSeed(localStateKeys.dailyRuns, seedRuns).map(cloneRun)
let localLogs: DailyRunLog[] = localPersistenceService.getOrSeed(localStateKeys.dailyRunLogs, [] as DailyRunLog[])

function persistDailyRuns() {
  localPersistenceService.setItem(localStateKeys.dailyRuns, localRuns)
}

function refreshDailyRuns() {
  localRuns = localPersistenceService.getOrSeed(localStateKeys.dailyRuns, seedRuns).map(cloneRun)
}

function persistDailyRunLogs() {
  localPersistenceService.setItem(localStateKeys.dailyRunLogs, localLogs)
}

function refreshDailyRunLogs() {
  localLogs = localPersistenceService.getOrSeed(localStateKeys.dailyRunLogs, [] as DailyRunLog[])
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function timestampId() {
  return new Date().toISOString().replace(/[^0-9]/g, '')
}

function cloneRun(run: DailyRun): DailyRun {
  return {
    ...run,
    artifacts: run.artifacts.map(artifact => ({ ...artifact })),
    agentReports: run.agentReports.map(report => ({
      ...report,
      completedItems: [...report.completedItems],
      blockedItems: [...report.blockedItems],
      suggestedNextActions: [...report.suggestedNextActions],
      riskNotes: [...report.riskNotes],
    })),
    opportunitySummary: { ...run.opportunitySummary },
    salesSummary: { ...run.salesSummary },
    workflowSummary: { ...run.workflowSummary },
    revenueSummary: { ...run.revenueSummary },
    riskSummary: { ...run.riskSummary, riskNotes: [...run.riskSummary.riskNotes] },
  }
}

function sourceFor(key: string): DailyRunSourceModule {
  return artifactMeta[key]?.sourceModule ?? 'manual'
}

function buildArtifact(key: string, status: DailyRunArtifactStatus = 'missing', evidence = ''): DailyRunArtifact {
  const meta = artifactMeta[key] ?? {
    label: key,
    ownerAgentId: 'jarvis',
    description: '自定义每日运营产物。',
    sourceModule: 'manual' as DailyRunSourceModule,
  }
  return {
    key,
    label: meta.label,
    ownerAgentId: meta.ownerAgentId,
    status,
    description: meta.description,
    sourceModule: sourceFor(key),
    completedAt: status === 'completed' ? today() : '',
    evidence,
  }
}

function getTodayIndex() {
  refreshDailyRuns()
  const date = today()
  return localRuns.findIndex(run => run.date === date)
}

function upsertTodayRun(run: DailyRun) {
  const index = getTodayIndex()
  if (index >= 0) {
    localRuns = localRuns.map((item, itemIndex) => itemIndex === index ? cloneRun(run) : item)
  } else {
    localRuns = [cloneRun(run), ...localRuns]
  }
  persistDailyRuns()
}

function statusFromArtifacts(artifacts: DailyRunArtifact[]): DailyRunStatus {
  if (artifacts.some(artifact => artifact.status === 'blocked')) return 'blocked'
  if (artifacts.every(artifact => artifact.status === 'completed')) return 'completed'
  if (artifacts.some(artifact => artifact.status === 'missing')) return 'incomplete'
  return 'running'
}

export function getRequiredDailyArtifacts(): string[] {
  const configured = Array.isArray(policyData.required_daily_artifacts) ? policyData.required_daily_artifacts : []
  return configured.length > 0 ? [...configured] : [...DEFAULT_REQUIRED_ARTIFACTS]
}

export function buildOpportunitySummary(): DailyOpportunitySummary {
  const opportunities = opportunityService.listOpportunities()
  const date = today()
  return {
    totalOpportunities: opportunities.length,
    todayNewOpportunities: opportunities.filter(opportunity => opportunity.createdAt === date).length,
    highFitOpportunities: opportunities.filter(opportunity => opportunity.fitScore >= 70).length,
    needsCeoDecision: opportunities.filter(opportunity => opportunity.status === 'proposal' || opportunity.status === 'won' || opportunity.riskScore >= 60).length,
  }
}

export function buildSalesSummary(): DailySalesSummary {
  const leads = salesPipelineService.listSalesLeads()
  return {
    totalLeads: leads.length,
    quoteReviewCount: leads.filter(lead => lead.stage === 'quote_review').length,
    paymentPendingCount: leads.filter(lead => lead.stage === 'payment_pending').length,
    wonCount: leads.filter(lead => lead.stage === 'won').length,
    lostCount: leads.filter(lead => lead.stage === 'lost').length,
    pipelineValue: leads.reduce((sum, lead) => sum + lead.valueEstimate, 0),
  }
}

export function buildWorkflowSummary(): DailyWorkflowSummary {
  const runs = workflowService.listWorkflowRuns()
  return {
    totalRuns: runs.length,
    runningRuns: runs.filter(run => run.status === 'running').length,
    waitingApprovalRuns: runs.filter(run => run.status === 'waiting_approval').length,
    completedRuns: runs.filter(run => run.status === 'completed').length,
    failedRuns: runs.filter(run => run.status === 'failed').length,
  }
}

export function buildRevenueSummary(): DailyRevenueSummary {
  const summary = revenueConfirmationService.getRevenueSummary()
  return {
    expectedRevenue: summary.expectedRevenue,
    pendingPayment: summary.paymentPending,
    confirmedCash: summary.confirmedCash,
    recognizedRevenue: summary.recognizedRevenue,
    refundedRevenue: summary.refunded,
    needsCeoApproval: summary.requiresCeoApprovalCount,
  }
}

export function buildRiskSummary(): DailyRiskSummary {
  const openAudits = auditService.getOpenEvents()
  const sales = buildSalesSummary()
  const workflow = buildWorkflowSummary()
  const revenue = buildRevenueSummary()
  const boundaryApprovalCount = ceoActionBoundaryService.listMockApprovalRequests().filter(approval => approval.status === 'pending').length
  const approvalCount = sales.quoteReviewCount + sales.paymentPendingCount + workflow.waitingApprovalRuns + revenue.needsCeoApproval + boundaryApprovalCount
  const riskNotes = [
    ...openAudits.map(event => event.title || event.detail || '审计风险待处理'),
    ...(sales.quoteReviewCount > 0 ? [`${sales.quoteReviewCount} 条线索处于报价审批。`] : []),
    ...(sales.paymentPendingCount > 0 ? [`${sales.paymentPendingCount} 条线索等待 CEO 确认收款。`] : []),
    ...(workflow.waitingApprovalRuns > 0 ? [`${workflow.waitingApprovalRuns} 个工作流等待审批。`] : []),
    ...(revenue.needsCeoApproval > 0 ? [`${revenue.needsCeoApproval} 条收入记录需要 CEO 审批。`] : []),
    ...(boundaryApprovalCount > 0 ? [`${boundaryApprovalCount} 条统一动作边界审批待处理。`] : []),
  ]
  return {
    totalRisks: riskNotes.length,
    blockingRisks: workflow.failedRuns,
    ceoApprovalRequiredCount: approvalCount,
    riskNotes,
  }
}

export function buildApprovalSummary(): DailyApprovalSummary {
  const approvals = approvalBridgeService.listUnifiedApprovals()
  const pending = approvals.filter(approval => approval.status === 'pending')
  return {
    totalApprovals: approvals.length,
    pendingApprovals: pending.length,
    approvedApprovals: approvals.filter(approval => approval.status === 'approved').length,
    rejectedApprovals: approvals.filter(approval => approval.status === 'rejected').length,
    a3PendingCount: pending.filter(approval => approval.actionLevel === 'A3_EXTERNAL_ACTION').length,
    a4PendingCount: pending.filter(approval => approval.actionLevel === 'A4_FINANCIAL_LEGAL').length,
    highRiskApprovalCount: pending.filter(approval => approval.actionLevel === 'A3_EXTERNAL_ACTION' || approval.actionLevel === 'A4_FINANCIAL_LEGAL').length,
    latestApprovalTitles: approvals.slice(0, 5).map(approval => approval.title),
  }
}

function buildArtifactsFromSystem(): DailyRunArtifact[] {
  const opportunity = buildOpportunitySummary()
  const sales = buildSalesSummary()
  const workflow = buildWorkflowSummary()
  const revenue = buildRevenueSummary()
  const risk = buildRiskSummary()

  return getRequiredDailyArtifacts().map(key => {
    if (key === 'lead_classification_or_zero_report') {
      return buildArtifact(key, sales.totalLeads > 0 ? 'completed' : 'missing', sales.totalLeads > 0 ? `已识别 ${sales.totalLeads} 条销售线索` : '')
    }
    if (key === 'risk_audit') {
      return buildArtifact(key, risk.totalRisks > 0 ? 'draft' : 'completed', risk.totalRisks > 0 ? risk.riskNotes[0] : '暂无开放风险')
    }
    if (key === 'product_hypothesis') {
      return buildArtifact(key, opportunity.highFitOpportunities > 0 ? 'draft' : 'missing', opportunity.highFitOpportunities > 0 ? `${opportunity.highFitOpportunities} 个高匹配机会可更新产品假设` : '')
    }
    if (key === 'monitoring_row') {
      return buildArtifact(key, workflow.totalRuns > 0 || revenue.confirmedCash > 0 ? 'completed' : 'draft', '已汇总 workflow/revenue 运行指标')
    }
    if (key === 'jarvis_standup') {
      return buildArtifact(key, 'completed', 'Jarvis 今日站会摘要已生成')
    }
    return buildArtifact(key)
  })
}

function buildAgentReports(risk: DailyRiskSummary): DailyAgentReport[] {
  const agents = agentService.getAll()
  const byId = new Map(agents.map(agent => [agent.id, agent]))
  const reportDefs = [
    ['jarvis', '汇总每日运营闭环', ['生成今日公司运行摘要'], ['确认缺失产物'], ['先处理 CEO 审批队列'], risk.riskNotes],
    ['fred', '推进销售管道', ['复查报价和待收款线索'], [], ['推进 quote_review 和 payment_pending'], risk.riskNotes.filter(note => note.includes('线索'))],
    ['percy', '检查收入确认口径', ['区分收款与正式收入'], [], ['复查待确认收入和退款风险'], risk.riskNotes.filter(note => note.includes('收入'))],
    ['snape', '审计风险边界', ['检查对外动作边界'], risk.totalRisks > 0 ? ['存在待处理风险'] : [], ['阻止自动发布、报价、收款和退款'], risk.riskNotes],
  ] as const

  return reportDefs.map(([agentId, todayFocus, completedItems, blockedItems, suggestedNextActions, riskNotes]) => {
    const agent = byId.get(agentId)
    return {
      agentId,
      agentName: agent?.name ?? agentId,
      role: agent?.role ?? 'Agent',
      todayFocus,
      completedItems: [...completedItems],
      blockedItems: [...blockedItems],
      suggestedNextActions: [...suggestedNextActions],
      riskNotes: [...riskNotes],
    }
  })
}

export function generateJarvisStandup(run = generateDailyRunFromCurrentSystem(false)): string {
  const { opportunitySummary, salesSummary, workflowSummary, revenueSummary, riskSummary } = run
  const mainRisk = riskSummary.riskNotes[0] ?? '暂无重大风险'
  return [
    `Jarvis 今日站会：今天系统共记录 ${opportunitySummary.totalOpportunities} 个机会，其中 ${opportunitySummary.highFitOpportunities} 个高匹配机会。`,
    `销售侧共有 ${salesSummary.totalLeads} 条线索，${salesSummary.quoteReviewCount} 条报价审批，${salesSummary.paymentPendingCount} 条待收款，管道金额 ¥${salesSummary.pipelineValue.toLocaleString()}。`,
    `交付侧共有 ${workflowSummary.totalRuns} 个工作流，${workflowSummary.runningRuns} 个运行中，${workflowSummary.waitingApprovalRuns} 个等待审批。`,
    `收入侧预计收入 ¥${revenueSummary.expectedRevenue.toLocaleString()}，待收款 ¥${revenueSummary.pendingPayment.toLocaleString()}，已确认收款 ¥${revenueSummary.confirmedCash.toLocaleString()}，正式确认收入 ¥${revenueSummary.recognizedRevenue.toLocaleString()}。`,
    `当前风险：${mainRisk}。建议 CEO 今天优先处理报价审批、收款确认和阻塞产物。`,
  ].join('\n')
}

export function getDailyRunCompletionRate(run: Pick<DailyRun, 'artifacts'>): number {
  if (run.artifacts.length === 0) return 0
  const completed = run.artifacts.filter(artifact => artifact.status === 'completed').length
  return Math.round((completed / run.artifacts.length) * 100)
}

export function generateDailyRunFromCurrentSystem(persist = true): DailyRun {
  const opportunitySummary = buildOpportunitySummary()
  const salesSummary = buildSalesSummary()
  const workflowSummary = buildWorkflowSummary()
  const revenueSummary = buildRevenueSummary()
  const riskSummary = buildRiskSummary()
  const artifacts = buildArtifactsFromSystem()
  const partialRun: DailyRun = {
    id: `daily_run_${today()}`,
    date: today(),
    status: statusFromArtifacts(artifacts),
    artifacts,
    agentReports: buildAgentReports(riskSummary),
    opportunitySummary,
    salesSummary,
    workflowSummary,
    revenueSummary,
    riskSummary,
    jarvisStandup: '',
    completionRate: 0,
    createdAt: today(),
    updatedAt: today(),
  }
  partialRun.jarvisStandup = generateJarvisStandup(partialRun)
  partialRun.completionRate = getDailyRunCompletionRate(partialRun)
  if (persist) upsertTodayRun(partialRun)
  return cloneRun(partialRun)
}

export function listDailyRuns(): DailyRun[] {
  refreshDailyRuns()
  return localRuns.map(cloneRun)
}

export function getTodayDailyRun(): DailyRun {
  refreshDailyRuns()
  const existing = localRuns.find(run => run.date === today())
  return existing ? cloneRun(existing) : generateDailyRunFromCurrentSystem()
}

export function checkRequiredArtifacts(date: string): { status: DailyRunStatus; missingArtifacts: string[]; blockedArtifacts: string[] } {
  refreshDailyRuns()
  const run = localRuns.find(item => item.date === date) ?? generateDailyRunFromCurrentSystem()
  const missingArtifacts = run.artifacts.filter(artifact => artifact.status === 'missing').map(artifact => artifact.key)
  const blockedArtifacts = run.artifacts.filter(artifact => artifact.status === 'blocked').map(artifact => artifact.key)
  return {
    status: blockedArtifacts.length > 0 ? 'blocked' : missingArtifacts.length > 0 ? 'incomplete' : run.artifacts.every(artifact => artifact.status === 'completed') ? 'completed' : 'running',
    missingArtifacts,
    blockedArtifacts,
  }
}

function updateTodayArtifact(artifactKey: string, updater: (artifact: DailyRunArtifact) => DailyRunArtifact): DailyRun {
  const run = getTodayDailyRun()
  const artifacts = run.artifacts.map(artifact => artifact.key === artifactKey ? updater(artifact) : artifact)
  const nextRun = {
    ...run,
    artifacts,
    status: statusFromArtifacts(artifacts),
    completionRate: getDailyRunCompletionRate({ artifacts }),
    updatedAt: today(),
  }
  upsertTodayRun(nextRun)
  return cloneRun(nextRun)
}

export function markArtifactCompleted(artifactKey: string): DailyRun {
  return updateTodayArtifact(artifactKey, artifact => ({
    ...artifact,
    status: 'completed',
    completedAt: today(),
    evidence: artifact.evidence || 'CEO/本地模拟标记完成',
  }))
}

export function markArtifactBlocked(artifactKey: string, reason: string): DailyRun {
  return updateTodayArtifact(artifactKey, artifact => ({
    ...artifact,
    status: 'blocked',
    completedAt: '',
    evidence: reason,
  }))
}

export function getCompanyRunHealth(): CompanyRunHealth {
  const run = getTodayDailyRun()
  const check = checkRequiredArtifacts(run.date)
  const healthStatus: CompanyRunHealth['healthStatus'] = check.blockedArtifacts.length > 0
    ? 'blocked'
    : check.missingArtifacts.length > 0 || run.riskSummary.ceoApprovalRequiredCount > 0
      ? 'attention'
      : 'healthy'
  return {
    healthStatus,
    completionRate: run.completionRate,
    missingArtifacts: check.missingArtifacts,
    blockedArtifacts: check.blockedArtifacts,
    ceoApprovalCount: run.riskSummary.ceoApprovalRequiredCount,
    summaryText: healthStatus === 'healthy'
      ? '今日运营闭环已完成。'
      : healthStatus === 'blocked'
        ? '今日运营存在阻塞，需要 CEO 或负责人处理。'
        : '今日运营未完成，存在缺失产物或待审批事项。',
  }
}

export function resetDailyRunMockStateForTest() {
  resetDailyRunsToSeed()
}

export function resetDailyRunsToSeed() {
  localRuns = seedRuns.map(cloneRun)
  persistDailyRuns()
}

export function exportDailyRuns(): DailyRun[] {
  return listDailyRuns()
}

export function generateDailyRunSnapshot(options: { generatedBy?: 'manual' | 'system' | 'jarvis'; notes?: string } = {}): DailyRunLog {
  const run = generateDailyRunFromCurrentSystem()
  const health = getCompanyRunHealth()
  const approvalSummary = buildApprovalSummary()
  const generatedAt = new Date().toISOString()
  const log: DailyRunLog = {
    id: `daily_run_log_${timestampId()}`,
    runDate: run.date,
    generatedAt,
    generatedBy: options.generatedBy ?? 'manual',
    status: run.status,
    completionRate: run.completionRate,
    healthStatus: health.healthStatus,
    dailyRunId: run.id,
    opportunitySummary: { ...run.opportunitySummary },
    salesSummary: { ...run.salesSummary },
    workflowSummary: { ...run.workflowSummary },
    revenueSummary: { ...run.revenueSummary },
    riskSummary: { ...run.riskSummary, riskNotes: [...run.riskSummary.riskNotes] },
    approvalSummary,
    artifacts: run.artifacts.map(artifact => ({ ...artifact })),
    jarvisStandup: run.jarvisStandup,
    agentReports: run.agentReports.map(report => ({
      ...report,
      completedItems: [...report.completedItems],
      blockedItems: [...report.blockedItems],
      suggestedNextActions: [...report.suggestedNextActions],
      riskNotes: [...report.riskNotes],
    })),
    notes: options.notes ?? '',
    snapshotVersion: 'daily-run-log-v1',
  }
  refreshDailyRunLogs()
  localLogs = [log, ...localLogs]
  persistDailyRunLogs()
  return log
}

export function listDailyRunLogs(): DailyRunLog[] {
  refreshDailyRunLogs()
  return [...localLogs].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
}

export function getDailyRunLogById(logId: string): DailyRunLog | undefined {
  return listDailyRunLogs().find(log => log.id === logId)
}

export function getLatestDailyRunLog(): DailyRunLog | undefined {
  return listDailyRunLogs()[0]
}

export function deleteDailyRunLog(logId: string) {
  refreshDailyRunLogs()
  localLogs = localLogs.filter(log => log.id !== logId)
  persistDailyRunLogs()
}

export function clearDailyRunLogs() {
  localLogs = []
  persistDailyRunLogs()
}

export function exportDailyRunLogs(): DailyRunLog[] {
  return listDailyRunLogs()
}

export function compareDailyRunLogs(currentLogId: string, previousLogId: string) {
  const current = getDailyRunLogById(currentLogId)
  const previous = getDailyRunLogById(previousLogId)
  if (!current || !previous) return null
  return {
    opportunityDelta: current.opportunitySummary.totalOpportunities - previous.opportunitySummary.totalOpportunities,
    pipelineValueDelta: current.salesSummary.pipelineValue - previous.salesSummary.pipelineValue,
    pendingApprovalsDelta: current.approvalSummary.pendingApprovals - previous.approvalSummary.pendingApprovals,
    recognizedRevenueDelta: current.revenueSummary.recognizedRevenue - previous.revenueSummary.recognizedRevenue,
    completionRateDelta: current.completionRate - previous.completionRate,
  }
}

export function getDailyRunTrendSummary() {
  const logs = listDailyRunLogs().slice(0, 10)
  if (logs.length === 0) {
    return {
      recentRunCount: 0,
      averageCompletionRate: 0,
      latestHealthStatus: 'none' as const,
      pendingApprovalTrend: 0,
      recognizedRevenueTrend: 0,
      pipelineValueTrend: 0,
    }
  }
  const latest = logs[0]
  const oldest = logs[logs.length - 1]
  return {
    recentRunCount: logs.length,
    averageCompletionRate: Math.round(logs.reduce((sum, log) => sum + log.completionRate, 0) / logs.length),
    latestHealthStatus: latest.healthStatus,
    pendingApprovalTrend: latest.approvalSummary.pendingApprovals - oldest.approvalSummary.pendingApprovals,
    recognizedRevenueTrend: latest.revenueSummary.recognizedRevenue - oldest.revenueSummary.recognizedRevenue,
    pipelineValueTrend: latest.salesSummary.pipelineValue - oldest.salesSummary.pipelineValue,
  }
}

export const dailyRunService = {
  getRequiredDailyArtifacts,
  getTodayDailyRun,
  listDailyRuns,
  generateDailyRunFromCurrentSystem,
  checkRequiredArtifacts,
  markArtifactCompleted,
  markArtifactBlocked,
  getCompanyRunHealth,
  buildOpportunitySummary,
  buildSalesSummary,
  buildWorkflowSummary,
  buildRevenueSummary,
  buildRiskSummary,
  buildApprovalSummary,
  generateJarvisStandup,
  getDailyRunCompletionRate,
  generateDailyRunSnapshot,
  listDailyRunLogs,
  getDailyRunLogById,
  getLatestDailyRunLog,
  deleteDailyRunLog,
  clearDailyRunLogs,
  exportDailyRunLogs,
  compareDailyRunLogs,
  getDailyRunTrendSummary,
  resetDailyRunMockStateForTest,
  resetDailyRunsToSeed,
  exportDailyRuns,
}
