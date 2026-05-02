import { useMemo, useState } from 'react'
import { ceoActionBoundaryService } from '../services/ceoActionBoundaryService'
import { dailyRunService } from '../services/dailyRunService'
import type { DailyRunArtifact, DailyRunLog } from '../types'

const statusLabels = {
  not_started: '未开始',
  running: '运行中',
  incomplete: '未完成',
  completed: '已完成',
  blocked: '已阻塞',
}

const artifactStatusLabels = {
  missing: '缺失',
  draft: '草稿',
  completed: '已完成',
  blocked: '已阻塞',
}

export function DailyCompanyRunPage() {
  const [version, setVersion] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [selectedLogId, setSelectedLogId] = useState('')
  const [exportText, setExportText] = useState('')
  const run = useMemo(() => dailyRunService.getTodayDailyRun(), [version])
  const health = useMemo(() => dailyRunService.getCompanyRunHealth(), [version])
  const logs = useMemo(() => dailyRunService.listDailyRunLogs(), [version])
  const latestLog = useMemo(() => dailyRunService.getLatestDailyRunLog(), [version])
  const selectedLog = useMemo(() => selectedLogId ? dailyRunService.getDailyRunLogById(selectedLogId) : latestLog, [selectedLogId, latestLog, version])
  const trend = useMemo(() => dailyRunService.getDailyRunTrendSummary(), [version])

  function regenerateRun() {
    dailyRunService.generateDailyRunFromCurrentSystem()
    setFeedback('已从当前系统状态重新生成 Daily Run 汇总。')
    setVersion(current => current + 1)
  }

  function completeArtifact(key: string) {
    ceoActionBoundaryService.assertActionAllowed({
      actionType: 'mark_artifact_completed',
      sourceModule: 'daily_run',
      sourceId: run.id,
      title: `标记每日产物完成：${key}`,
      description: 'Daily Run 本地状态更新',
      amount: 0,
      customerName: '',
      relatedOfferId: '',
      relatedWorkflowRunId: '',
      requestedByAgentId: 'jarvis',
      metadata: { artifactKey: key },
    })
    dailyRunService.markArtifactCompleted(key)
    setFeedback(`已本地标记产物完成：${key}`)
    setVersion(current => current + 1)
  }

  function blockArtifact(key: string) {
    ceoActionBoundaryService.assertActionAllowed({
      actionType: 'mark_artifact_blocked',
      sourceModule: 'daily_run',
      sourceId: run.id,
      title: `标记每日产物阻塞：${key}`,
      description: 'Daily Run 本地状态更新',
      amount: 0,
      customerName: '',
      relatedOfferId: '',
      relatedWorkflowRunId: '',
      requestedByAgentId: 'jarvis',
      metadata: { artifactKey: key },
    })
    dailyRunService.markArtifactBlocked(key, '本地模拟阻塞：等待负责人或 CEO 处理')
    setFeedback(`已本地标记产物阻塞：${key}`)
    setVersion(current => current + 1)
  }

  function generateSnapshot() {
    const log = dailyRunService.generateDailyRunSnapshot({ generatedBy: 'manual' })
    setSelectedLogId(log.id)
    setFeedback(`已生成今日运营快照：${log.id}`)
    setVersion(current => current + 1)
  }

  function exportLogs() {
    setExportText(JSON.stringify(dailyRunService.exportDailyRunLogs(), null, 2))
    setFeedback('已导出 Daily Run 运行日志 JSON。')
  }

  function clearLogs() {
    dailyRunService.clearDailyRunLogs()
    setSelectedLogId('')
    setExportText('')
    setFeedback('已清空 Daily Run 运行日志。')
    setVersion(current => current + 1)
  }

  function deleteLog(logId: string) {
    dailyRunService.deleteDailyRunLog(logId)
    if (selectedLogId === logId) setSelectedLogId('')
    setFeedback(`已删除运行日志：${logId}`)
    setVersion(current => current + 1)
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Daily Company Run</p>
          <h2>每日运营</h2>
          <p className="muted">一人公司每日自动运营闭环，只做检查、汇总、状态判断和模拟产物。</p>
        </div>
        <div className="hero-actions">
          <span className={`status-pill ${run.status}`}>{statusLabels[run.status]}</span>
          <button type="button" className="approve-button" onClick={regenerateRun}>重新生成今日汇总</button>
          <button type="button" className="secondary-button" onClick={generateSnapshot}>生成今日运营快照</button>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        生成运营快照只会记录当前状态，不会自动执行任何对外动作或财务动作。
      </div>
      {feedback && <div className="feedback-banner success page-banner">{feedback}</div>}

      <div className="metrics-grid metrics-grid-6">
        <article className={health.healthStatus === 'blocked' ? 'metric-card warning' : 'metric-card'}>
          <span>完成率</span>
          <strong>{run.completionRate}%</strong>
          <p>{health.summaryText}</p>
        </article>
        <article className="metric-card">
          <span>今日机会数</span>
          <strong>{run.opportunitySummary.todayNewOpportunities}</strong>
          <p>总机会 {run.opportunitySummary.totalOpportunities}</p>
        </article>
        <article className="metric-card">
          <span>销售管道金额</span>
          <strong>¥{run.salesSummary.pipelineValue.toLocaleString()}</strong>
        </article>
        <article className="metric-card warning">
          <span>待 CEO 审批</span>
          <strong>{run.riskSummary.ceoApprovalRequiredCount}</strong>
        </article>
        <article className="metric-card">
          <span>已确认收款</span>
          <strong>¥{run.revenueSummary.confirmedCash.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>正式确认收入</span>
          <strong>¥{run.revenueSummary.recognizedRevenue.toLocaleString()}</strong>
        </article>
      </div>

      <div className="daily-run-layout">
        <section className="form-panel">
          <div className="panel-header panel-header-top">
            <div>
              <p className="eyebrow">Required Artifacts</p>
              <h3>必需运营产物</h3>
            </div>
            <span className="metric-inline">{run.artifacts.length} 项</span>
          </div>
          <div className="stack-list compact-gap">
            {run.artifacts.map(artifact => (
              <ArtifactCard
                key={artifact.key}
                artifact={artifact}
                onComplete={() => completeArtifact(artifact.key)}
                onBlock={() => blockArtifact(artifact.key)}
              />
            ))}
          </div>
        </section>

        <section className="stack-list">
          <article className="daily-standup-card">
            <p className="eyebrow">Jarvis Standup</p>
            <h3>Jarvis 今日站会日报</h3>
            <p>{run.jarvisStandup}</p>
          </article>

          <article className="form-panel">
            <p className="eyebrow">Module Summary</p>
            <h3>模块摘要</h3>
            <div className="daily-summary-grid">
              <SummaryBlock title="Opportunity Summary" rows={[
                ['总机会', run.opportunitySummary.totalOpportunities],
                ['今日新增', run.opportunitySummary.todayNewOpportunities],
                ['高匹配', run.opportunitySummary.highFitOpportunities],
                ['需 CEO 决策', run.opportunitySummary.needsCeoDecision],
              ]} />
              <SummaryBlock title="Sales Summary" rows={[
                ['总线索', run.salesSummary.totalLeads],
                ['报价审批', run.salesSummary.quoteReviewCount],
                ['待收款', run.salesSummary.paymentPendingCount],
                ['已成交', run.salesSummary.wonCount],
              ]} />
              <SummaryBlock title="Workflow Summary" rows={[
                ['总工作流', run.workflowSummary.totalRuns],
                ['运行中', run.workflowSummary.runningRuns],
                ['待审批', run.workflowSummary.waitingApprovalRuns],
                ['失败', run.workflowSummary.failedRuns],
              ]} />
              <SummaryBlock title="Revenue Summary" rows={[
                ['预计收入', `¥${run.revenueSummary.expectedRevenue.toLocaleString()}`],
                ['待收款', `¥${run.revenueSummary.pendingPayment.toLocaleString()}`],
                ['已确认收款', `¥${run.revenueSummary.confirmedCash.toLocaleString()}`],
                ['正式收入', `¥${run.revenueSummary.recognizedRevenue.toLocaleString()}`],
              ]} />
              <SummaryBlock title="Risk Summary" rows={[
                ['总风险', run.riskSummary.totalRisks],
                ['阻塞风险', run.riskSummary.blockingRisks],
                ['审批需求', run.riskSummary.ceoApprovalRequiredCount],
                ['健康状态', health.healthStatus],
              ]} />
            </div>
          </article>

          <article className="form-panel">
            <p className="eyebrow">Agent Reports</p>
            <h3>Agent 今日报告</h3>
            <div className="stack-list compact-gap">
              {run.agentReports.map(report => (
                <div key={report.agentId} className="stack-item">
                  <div className="sales-card-top">
                    <strong>{report.agentName}</strong>
                    <span className="metric-inline">{report.role}</span>
                  </div>
                  <p className="history-note">今日重点：{report.todayFocus}</p>
                  <p className="history-note">完成项：{report.completedItems.join('；') || '无'}</p>
                  <p className="history-note">阻塞项：{report.blockedItems.join('；') || '无'}</p>
                  <p className="history-note">建议动作：{report.suggestedNextActions.join('；') || '无'}</p>
                  {report.riskNotes.length > 0 && <div className="feedback-banner error">{report.riskNotes.join('；')}</div>}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>

      <section className="form-panel">
        <div className="panel-header panel-header-top">
          <div>
            <p className="eyebrow">Run Logs</p>
            <h3>运行日志</h3>
          </div>
          <div className="form-actions revenue-actions">
            <button type="button" onClick={generateSnapshot}>生成今日运营快照</button>
            <button type="button" className="secondary-button" onClick={() => latestLog && setSelectedLogId(latestLog.id)}>查看最新快照</button>
            <button type="button" className="secondary-button" onClick={exportLogs}>导出运行日志</button>
            <button type="button" className="reject-button" onClick={clearLogs}>清空运行日志</button>
          </div>
        </div>

        {latestLog && (
          <div className="daily-standup-card">
            <p className="eyebrow">Latest Snapshot</p>
            <h3>{latestLog.id}</h3>
            <p>
              生成时间：{latestLog.generatedAt} · 健康：{latestLog.healthStatus} · 完成率：{latestLog.completionRate}% · 待审批：{latestLog.approvalSummary.pendingApprovals}
              {'\n'}{latestLog.jarvisStandup}
            </p>
          </div>
        )}

        <div className="daily-summary-grid">
          <SummaryBlock title="趋势摘要" rows={[
            ['最近运行次数', trend.recentRunCount],
            ['平均完成率', `${trend.averageCompletionRate}%`],
            ['最新健康状态', trend.latestHealthStatus],
            ['待审批趋势', trend.pendingApprovalTrend],
            ['收入趋势', `¥${trend.recognizedRevenueTrend.toLocaleString()}`],
            ['销售管道趋势', `¥${trend.pipelineValueTrend.toLocaleString()}`],
          ]} />
          <div className="stack-item">
            <strong>导出 JSON</strong>
            <textarea value={exportText} onChange={(event) => setExportText(event.target.value)} rows={8} placeholder="点击导出运行日志后显示 JSON" />
          </div>
        </div>

        <div className="stack-list compact-gap">
          {logs.map(log => (
            <DailyRunLogCard
              key={log.id}
              log={log}
              selected={selectedLog?.id === log.id}
              onSelect={() => setSelectedLogId(log.id)}
              onDelete={() => deleteLog(log.id)}
            />
          ))}
          {logs.length === 0 && (
            <div className="empty-state-card">
              <strong>暂无运行日志</strong>
              <p>点击“生成今日运营快照”沉淀当前运营状态。</p>
            </div>
          )}
        </div>

        {selectedLog && <DailyRunLogDetail log={selectedLog} />}
      </section>
    </section>
  )
}

function DailyRunLogCard({
  log,
  selected,
  onSelect,
  onDelete,
}: {
  log: DailyRunLog
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <article className={selected ? 'daily-artifact-card highlighted-card' : 'daily-artifact-card'}>
      <div className="sales-card-top">
        <div>
          <strong>{log.runDate}</strong>
          <p className="history-note">{log.generatedAt}</p>
        </div>
        <span className={`status-pill ${log.status}`}>{statusLabels[log.status]}</span>
      </div>
      <div className="sales-card-metrics">
        <span className="metric-inline">health：{log.healthStatus}</span>
        <span className="metric-inline">完成率：{log.completionRate}%</span>
        <span className="metric-inline">机会：{log.opportunitySummary.totalOpportunities}</span>
        <span className="metric-inline">管道：¥{log.salesSummary.pipelineValue.toLocaleString()}</span>
        <span className="metric-inline">待审批：{log.approvalSummary.pendingApprovals}</span>
        <span className="metric-inline">正式收入：¥{log.revenueSummary.recognizedRevenue.toLocaleString()}</span>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onSelect}>查看详情</button>
        <button type="button" className="reject-button" onClick={onDelete}>删除</button>
      </div>
    </article>
  )
}

function DailyRunLogDetail({ log }: { log: DailyRunLog }) {
  return (
    <article className="form-panel">
      <p className="eyebrow">Snapshot Detail</p>
      <h3>{log.id}</h3>
      <div className="daily-summary-grid">
        <SummaryBlock title="Opportunity Summary" rows={[
          ['总机会', log.opportunitySummary.totalOpportunities],
          ['今日新增', log.opportunitySummary.todayNewOpportunities],
          ['高匹配', log.opportunitySummary.highFitOpportunities],
          ['需 CEO 决策', log.opportunitySummary.needsCeoDecision],
        ]} />
        <SummaryBlock title="Sales Summary" rows={[
          ['总线索', log.salesSummary.totalLeads],
          ['报价审批', log.salesSummary.quoteReviewCount],
          ['待收款', log.salesSummary.paymentPendingCount],
          ['管道金额', `¥${log.salesSummary.pipelineValue.toLocaleString()}`],
        ]} />
        <SummaryBlock title="Workflow Summary" rows={[
          ['总工作流', log.workflowSummary.totalRuns],
          ['运行中', log.workflowSummary.runningRuns],
          ['待审批', log.workflowSummary.waitingApprovalRuns],
          ['失败', log.workflowSummary.failedRuns],
        ]} />
        <SummaryBlock title="Revenue Summary" rows={[
          ['预计收入', `¥${log.revenueSummary.expectedRevenue.toLocaleString()}`],
          ['待收款', `¥${log.revenueSummary.pendingPayment.toLocaleString()}`],
          ['已确认收款', `¥${log.revenueSummary.confirmedCash.toLocaleString()}`],
          ['正式收入', `¥${log.revenueSummary.recognizedRevenue.toLocaleString()}`],
        ]} />
        <SummaryBlock title="Approval Summary" rows={[
          ['总审批', log.approvalSummary.totalApprovals],
          ['pending', log.approvalSummary.pendingApprovals],
          ['approved', log.approvalSummary.approvedApprovals],
          ['rejected', log.approvalSummary.rejectedApprovals],
          ['A3 pending', log.approvalSummary.a3PendingCount],
          ['A4 pending', log.approvalSummary.a4PendingCount],
        ]} />
        <SummaryBlock title="Risk Summary" rows={[
          ['总风险', log.riskSummary.totalRisks],
          ['阻塞风险', log.riskSummary.blockingRisks],
          ['审批需求', log.riskSummary.ceoApprovalRequiredCount],
          ['最新审批', log.approvalSummary.latestApprovalTitles.join('；') || '无'],
        ]} />
      </div>
      <div className="daily-standup-card">
        <p className="eyebrow">Jarvis Standup</p>
        <p>{log.jarvisStandup}</p>
      </div>
      <div className="stack-list compact-gap">
        {log.artifacts.map(artifact => (
          <div key={artifact.key} className="stack-item">
            <strong>{artifact.label}</strong>
            <p className="history-note">{artifact.status} · {artifact.sourceModule} · {artifact.evidence || '暂无证据'}</p>
          </div>
        ))}
        {log.agentReports.map(report => (
          <div key={report.agentId} className="stack-item">
            <strong>{report.agentName}</strong>
            <p className="history-note">重点：{report.todayFocus}</p>
            <p className="history-note">建议：{report.suggestedNextActions.join('；') || '无'}</p>
          </div>
        ))}
      </div>
    </article>
  )
}

function ArtifactCard({
  artifact,
  onComplete,
  onBlock,
}: {
  artifact: DailyRunArtifact
  onComplete: () => void
  onBlock: () => void
}) {
  return (
    <article className="daily-artifact-card">
      <div className="sales-card-top">
        <div>
          <strong>{artifact.label}</strong>
          <p className="history-note">{artifact.key}</p>
        </div>
        <span className={`status-pill ${artifact.status}`}>{artifactStatusLabels[artifact.status]}</span>
      </div>
      <p>{artifact.description}</p>
      <div className="sales-card-metrics">
        <span className="metric-inline">owner：{artifact.ownerAgentId}</span>
        <span className="metric-inline">source：{artifact.sourceModule}</span>
      </div>
      <p className="history-note">evidence：{artifact.evidence || '暂无'}</p>
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onComplete}>标记完成</button>
        <button type="button" className="reject-button" onClick={onBlock}>标记阻塞</button>
      </div>
    </article>
  )
}

function SummaryBlock({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return (
    <div className="stack-item">
      <strong>{title}</strong>
      {rows.map(([label, value]) => (
        <p key={label} className="history-note">{label}：{value}</p>
      ))}
    </div>
  )
}
