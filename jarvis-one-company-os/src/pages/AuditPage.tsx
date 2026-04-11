import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { auditService } from '../services/auditService'
import { writebackService } from '../services/writebackService'

const riskLevelLabels: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '严重',
}

const statusLabels: Record<string, string> = {
  open: '待处理',
  reviewing: '审核中',
  resolved: '已解决',
  ignored: '已忽略',
}

const issueTypeLabels: Record<string, string> = {
  hallucination: '幻觉风险',
  overspend: '超预算风险',
  unauthorized: '越权执行',
  low_quality: '低质量交付',
  duplicate: '重复执行',
}

export function AuditPage() {
  useSnapshot()
  const navigate = useNavigate()
  const events = auditService.getAll()
  const openCount = auditService.getOpenCount()
  const [processingId, setProcessingId] = useState('')
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [inspecting, setInspecting] = useState(false)
  const [inspectionResult, setInspectionResult] = useState('')

  async function handleRunInspection() {
    setInspecting(true)
    setInspectionResult('')

    try {
      const result = await writebackService.runAuditInspection({ scope: 'recent' })
      await refreshSnapshot()
      const found = (result as Record<string, unknown>).issuesFound as number | undefined
      setInspectionResult(
        found && found > 0
          ? `巡检完成，发现 ${found} 个新问题`
          : '巡检通过，未发现异常',
      )
    } catch (error) {
      setInspectionResult(error instanceof Error ? error.message : '巡检失败')
    } finally {
      setInspecting(false)
    }
  }

  async function handleUpdate(eventId: string, status: 'resolved' | 'ignored', freezeTask?: boolean) {
    setProcessingId(eventId)
    setFeedback((prev) => ({ ...prev, [eventId]: '' }))

    try {
      await writebackService.updateAudit({ eventId, status, freezeTask })
      await refreshSnapshot()
      const msg = freezeTask
        ? '已标记并冻结关联任务'
        : status === 'resolved'
          ? '已标记为解决'
          : '已标记为忽略'
      setFeedback((prev) => ({ ...prev, [eventId]: msg }))
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        [eventId]: error instanceof Error ? error.message : '操作失败',
      }))
    } finally {
      setProcessingId('')
    }
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">审计中心</p>
          <h2>风控与审计事件</h2>
          <p className="muted">识别风险、冻结异常任务、拦截低质量产出。解决或忽略后事件关闭。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">待处理 {openCount}</div>
          <div className="metric-inline">总事件 {events.length}</div>
          <button
            type="button"
            className="approve-button"
            disabled={inspecting}
            onClick={handleRunInspection}
            style={{ border: 'none', cursor: inspecting ? 'not-allowed' : 'pointer', fontSize: 13 }}
          >
            {inspecting ? '巡检中...' : '自动巡检'}
          </button>
        </div>
      </div>

      {inspectionResult && (
        <div className={inspectionResult.includes('失败') ? 'feedback-banner error page-banner' : 'feedback-banner success page-banner'}>
          {inspectionResult}
        </div>
      )}

      <div className="stack-list">
        {events.length === 0 && (
          <div className="empty-state-card">
            <p>暂无审计事件。</p>
          </div>
        )}
        {events.map((event) => {
          const isOpen = event.status === 'open' || event.status === 'reviewing'
          const isProcessing = processingId === event.id
          const message = feedback[event.id]
          const hasTask = Boolean(event.taskId)

          return (
            <div key={event.id} className="stack-item approval-card">
              <div className="approval-card-header">
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                  <p className="history-note">
                    类型：{issueTypeLabels[event.issueType] ?? event.issueType} · {event.createdAt}
                    {hasTask && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="link-button"
                          style={{ display: 'inline', padding: '0 4px', fontSize: 12 }}
                          onClick={() => navigate(`/tasks?highlightTaskId=${event.taskId}`)}
                        >
                          查看关联任务
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <span className={`risk-tag ${event.level}`}>
                    {riskLevelLabels[event.level] ?? event.level}
                  </span>
                  <span className={`status-pill ${event.status}`}>
                    {statusLabels[event.status] ?? event.status}
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="approval-actions" style={{ flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="approve-button"
                    disabled={isProcessing}
                    onClick={() => handleUpdate(event.id, 'resolved')}
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    {isProcessing ? '处理中...' : '标记已解决'}
                  </button>
                  {hasTask && (
                    <button
                      type="button"
                      className="reject-button"
                      disabled={isProcessing}
                      onClick={() => handleUpdate(event.id, 'resolved', true)}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      {isProcessing ? '处理中...' : '解决并冻结任务'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="link-button"
                    disabled={isProcessing}
                    onClick={() => handleUpdate(event.id, 'ignored')}
                  >
                    忽略
                  </button>
                </div>
              )}

              {message && (
                <div className={message.includes('失败') ? 'feedback-banner error' : 'feedback-banner success'}>
                  {message}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
