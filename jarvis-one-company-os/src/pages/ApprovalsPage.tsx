import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { statusLabelMap } from '../app/status'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { approvalService } from '../services/approvalService'
import { taskService } from '../services/taskService'
import { writebackService } from '../services/writebackService'

type ApprovalsPageState = {
  successMessage?: string
  createdTaskId?: string
  createdTaskTitle?: string
}

type ApprovalFlowTarget = {
  taskId: string
  taskTitle: string
  description: string
  ownerAgentId: string
  taskType: 'ops' | 'tech' | 'growth' | 'finance' | 'audit' | 'product' | 'sales' | 'customer'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  budgetToken: number
  dueAt: string
  requiresApproval: boolean
}

export function ApprovalsPage() {
  useSnapshot()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const approvals = approvalService.getAll()
  const tasks = taskService.getAll()
  const highlightedTaskId = searchParams.get('highlightTaskId') ?? ''
  const [processingId, setProcessingId] = useState('')
  const [pageMessage, setPageMessage] = useState('')
  const [createdTaskTitle, setCreatedTaskTitle] = useState('')
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  useEffect(() => {
    const state = (location.state as ApprovalsPageState | null) ?? null
    if (state?.successMessage) {
      setPageMessage(state.successMessage)
    }
    if (state?.createdTaskTitle) {
      setCreatedTaskTitle(state.createdTaskTitle)
    }
    if (state?.successMessage || state?.createdTaskTitle || state?.createdTaskId) {
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const highlightedApprovalId = useMemo(() => {
    if (!highlightedTaskId && !createdTaskTitle) {
      return ''
    }

    const matched = approvals.find((item) => {
      if (item.status !== 'pending') {
        return false
      }

      if (createdTaskTitle && item.targetTitle === createdTaskTitle) {
        return true
      }

      if (item.targetId && highlightedTaskId && item.targetId === highlightedTaskId) {
        return true
      }

      return highlightedTaskId !== '' && item.reason.includes(highlightedTaskId)
    })

    return matched?.id ?? ''
  }, [approvals, createdTaskTitle, highlightedTaskId])

  const approvalFlowTarget = useMemo<ApprovalFlowTarget | null>(() => {
    const activeApproval = approvals.find((item) => item.id === processingId)
    if (!activeApproval) {
      return null
    }

    const matchedTask = tasks.find((task) => {
      if (activeApproval.targetId && task.id === activeApproval.targetId) {
        return true
      }

      return task.title === activeApproval.targetTitle
    })

    if (!matchedTask) {
      return null
    }

    return {
      taskId: matchedTask.id,
      taskTitle: matchedTask.title,
      description: matchedTask.description ?? '',
      ownerAgentId: matchedTask.ownerAgentId ?? 'hermione',
      taskType: matchedTask.taskType ?? 'tech',
      priority: matchedTask.priority,
      budgetToken: matchedTask.budgetToken,
      dueAt: matchedTask.dueAt,
      requiresApproval: matchedTask.requiresApproval ?? true,
    }
  }, [approvals, processingId, tasks])

  async function handleDecision(approvalId: string, status: 'approved' | 'rejected') {
    setProcessingId(approvalId)
    setFeedback((current) => ({ ...current, [approvalId]: '' }))

    try {
      await writebackService.decideApproval({
        approvalId,
        status,
        decisionNote: status === 'approved' ? '前端审批中心已确认通过。' : '前端审批中心已执行驳回。',
      })
      await refreshSnapshot()

      const flowTarget = approvalFlowTarget
      const nextPageMessage =
        status === 'approved'
          ? `审批已通过，任务${flowTarget ? `「${flowTarget.taskTitle}」` : ''}已回到任务页继续推进。`
          : `审批已驳回，任务${flowTarget ? `「${flowTarget.taskTitle}」` : ''}已回到待修正流。`

      setFeedback((current) => ({
        ...current,
        [approvalId]: nextPageMessage,
      }))

      if (flowTarget) {
        const params = new URLSearchParams({ highlightTaskId: flowTarget.taskId })
        if (status === 'rejected') {
          params.set('focus', 'create')
          params.set('title', flowTarget.taskTitle)
          params.set('description', flowTarget.description)
          params.set('ownerAgentId', flowTarget.ownerAgentId)
          params.set('taskType', flowTarget.taskType)
          params.set('priority', flowTarget.priority)
          params.set('budgetToken', String(flowTarget.budgetToken))
          params.set('dueAt', flowTarget.dueAt)
          params.set('requiresApproval', String(flowTarget.requiresApproval))
          params.set('sourceApprovalId', approvalId)
        }

        navigate(`/tasks?${params.toString()}`, {
          state: {
            successMessage: nextPageMessage,
            approvalDecision: status,
            highlightTaskId: flowTarget.taskId,
            taskTitle: flowTarget.taskTitle,
            sourceApprovalId: status === 'rejected' ? approvalId : undefined,
            isResubmission: status === 'rejected',
          },
        })
        return
      }

      setPageMessage(nextPageMessage)
      clearHighlight()
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [approvalId]: error instanceof Error ? error.message : '审批写回失败',
      }))
    } finally {
      setProcessingId('')
    }
  }

  function clearHighlight() {
    setSearchParams({}, { replace: true })
    setCreatedTaskTitle('')
    setPageMessage('')
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">审批中心</p>
          <h2>待决策事项</h2>
          <p className="muted">审批通过或驳回后，会立即写回 SQLite，并刷新当前页面数据。</p>
        </div>
        <div className="metric-inline">待处理 {approvalService.getPendingCount()}</div>
      </div>

      {pageMessage && <div className="feedback-banner success page-banner">{pageMessage}</div>}

      <div className="stack-list">
        {approvals.map((item) => {
          const isPending = item.status === 'pending'
          const isProcessing = processingId === item.id
          const isHighlighted = item.id === highlightedApprovalId
          const message = feedback[item.id]

          return (
            <div key={item.id} className={isHighlighted ? 'stack-item approval-card highlighted-card' : 'stack-item approval-card'}>
              <div className="approval-card-header">
                <div>
                  <strong>{item.targetTitle}</strong>
                  <p>
                    {item.requester} · {item.amount} Token · {item.createdAt}
                  </p>
                  {isHighlighted && <span className="inline-note">这是刚刚由任务创建流带来的审批事项</span>}
                  {item.resubmissionCount ? <p className="history-note">对应任务已重提 {item.resubmissionCount} 次</p> : null}
                  {item.latestRejectionNote ? <p className="history-note">最近驳回原因：{item.latestRejectionNote}</p> : null}
                </div>
                <span className={`status-pill ${item.status}`}>{statusLabelMap[item.status]}</span>
              </div>

              <p>{item.reason}</p>
              {item.latestDecisionNote && item.status !== 'pending' ? <p className="history-note">最近审批备注：{item.latestDecisionNote}</p> : null}

              <div className="approval-actions">
                <button
                  type="button"
                  className="approve-button"
                  disabled={!isPending || isProcessing}
                  onClick={() => handleDecision(item.id, 'approved')}
                >
                  {isProcessing ? '处理中...' : '批准'}
                </button>
                <button
                  type="button"
                  className="reject-button"
                  disabled={!isPending || isProcessing}
                  onClick={() => handleDecision(item.id, 'rejected')}
                >
                  {isProcessing ? '处理中...' : '驳回'}
                </button>
                {highlightedApprovalId && (
                  <button type="button" className="link-button" onClick={clearHighlight}>
                    清除高亮
                  </button>
                )}
              </div>

              {message && (
                <div className={message.includes('失败') || message.includes('Invalid') ? 'feedback-banner error' : 'feedback-banner success'}>
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
