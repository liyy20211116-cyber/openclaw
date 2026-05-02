import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { statusLabelMap } from '../app/status'
import type { TaskTimelineEvent } from '../types'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { taskService } from '../services/taskService'
import { writebackService } from '../services/writebackService'

const ownerOptions = [
  { label: '贾维斯', value: 'jarvis' },
  { label: '赫敏·格兰杰', value: 'hermione' },
  { label: '麦格教授', value: 'mcgonagall' },
  { label: '卢娜·洛夫古德', value: 'luna' },
  { label: '弗雷德·韦斯莱', value: 'fred' },
  { label: '珀西·韦斯莱', value: 'percy' },
  { label: '斯内普', value: 'snape' },
  { label: '多比', value: 'dobby' },
] as const

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' },
] as const

const taskTypeOptions = [
  { label: '运营', value: 'ops' },
  { label: '技术', value: 'tech' },
  { label: '产品', value: 'product' },
  { label: '增长', value: 'growth' },
  { label: '销售', value: 'sales' },
  { label: '财务', value: 'finance' },
  { label: '审计', value: 'audit' },
  { label: '客户', value: 'customer' },
] as const

const timelineTypeLabelMap: Partial<Record<TaskTimelineEvent['type'], string>> = {
  created: '首次提交',
  resubmitted: '再次提交',
  approval_requested: '发起审批',
  approved: '审批通过',
  rejected: '审批驳回',
  start: '开始执行',
  approve: '审批通过',
}

const taskTypeLabels: Record<string, string> = {
  ops: '运营',
  tech: '技术',
  product: '产品',
  growth: '增长',
  sales: '销售',
  finance: '财务',
  audit: '审计',
  customer: '客户',
}

const priorityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

const initialForm = {
  title: '',
  description: '',
  taskType: 'tech' as const,
  ownerAgentId: 'hermione',
  priority: 'high' as const,
  budgetToken: 500,
  dueAt: '',
  requiresApproval: true,
}

type TasksPageState = {
  successMessage?: string
  approvalDecision?: 'approved' | 'rejected'
  highlightTaskId?: string
  taskTitle?: string
  sourceApprovalId?: string
  isResubmission?: boolean
}

type TaskAction = 'start' | 'submit_review' | 'complete' | 'freeze'

const statusActions: Record<string, { action: TaskAction; label: string; style: 'primary' | 'warning' }[]> = {
  approved: [{ action: 'start', label: '开始执行', style: 'primary' }],
  draft: [{ action: 'start', label: '开始执行', style: 'primary' }],
  in_progress: [
    { action: 'submit_review', label: '提交审核', style: 'primary' },
    { action: 'freeze', label: '冻结', style: 'warning' },
  ],
  review: [
    { action: 'complete', label: '标记完成', style: 'primary' },
    { action: 'freeze', label: '冻结', style: 'warning' },
  ],
}

const openclawEligibleStatuses = ['approved', 'in_progress']

export function TasksPage() {
  useSnapshot()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tasks = taskService.getAll()
  const formPanelRef = useRef<HTMLFormElement | null>(null)
  const highlightTaskId = searchParams.get('highlightTaskId') ?? ''
  const sourceApprovalId = searchParams.get('sourceApprovalId') ?? ''
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [actionFeedback, setActionFeedback] = useState('')
  const [openclawLoading, setOpenclawLoading] = useState(false)

  const pendingApprovalCount = useMemo(
    () => tasks.filter((task) => task.status === 'pending_approval').length,
    [tasks],
  )

  const selectedTask = useMemo(() => {
    const taskId = selectedTaskId || highlightTaskId
    return taskId ? taskService.getById(taskId) ?? null : null
  }, [highlightTaskId, selectedTaskId, tasks])

  useEffect(() => {
    const state = (location.state as TasksPageState | null) ?? null
    if (state?.successMessage) {
      setSuccessMessage(state.successMessage)
    }

    if (state?.successMessage || state?.approvalDecision || state?.highlightTaskId || state?.taskTitle || state?.sourceApprovalId) {
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  useEffect(() => {
    const nextForm = {
      title: searchParams.get('title') ?? initialForm.title,
      description: searchParams.get('description') ?? initialForm.description,
      taskType: (searchParams.get('taskType') as typeof initialForm.taskType | null) ?? initialForm.taskType,
      ownerAgentId: (searchParams.get('ownerAgentId') as typeof initialForm.ownerAgentId | null) ?? initialForm.ownerAgentId,
      priority: (searchParams.get('priority') as typeof initialForm.priority | null) ?? initialForm.priority,
      budgetToken: Number(searchParams.get('budgetToken') ?? initialForm.budgetToken),
      dueAt: searchParams.get('dueAt') ?? initialForm.dueAt,
      requiresApproval: (searchParams.get('requiresApproval') ?? String(initialForm.requiresApproval)) === 'true',
    }

    setForm(nextForm)

    if (searchParams.get('focus') === 'create') {
      requestAnimationFrame(() => {
        formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [searchParams])

  useEffect(() => {
    if (highlightTaskId) {
      setSelectedTaskId(highlightTaskId)
    }
  }, [highlightTaskId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const requiresApproval = form.requiresApproval
      const isResubmission = Boolean(sourceApprovalId && highlightTaskId)
      const result = await writebackService.createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        taskType: form.taskType,
        creatorAgentId: 'jarvis',
        ownerAgentId: form.ownerAgentId,
        priority: form.priority,
        budgetToken: Number(form.budgetToken),
        dueAt: form.dueAt || undefined,
        requiresApproval,
        approverId: requiresApproval ? 'ceo' : undefined,
        taskId: isResubmission ? highlightTaskId : undefined,
        sourceApprovalId: isResubmission ? sourceApprovalId : undefined,
      })

      await refreshSnapshot()
      setForm(initialForm)

      const nextSuccessMessage = isResubmission
        ? requiresApproval
          ? `任务 ${result.taskId} 已修正并重新提交审批。`
          : `任务 ${result.taskId} 已修正并直接写回看板。`
        : requiresApproval
          ? `任务 ${result.taskId} 已创建，并已进入审批流。`
          : `任务 ${result.taskId} 已创建并同步到看板。`

      setSuccessMessage(nextSuccessMessage)

      if (result.taskId) {
        setSelectedTaskId(result.taskId)
        const nextParams = new URLSearchParams({ highlightTaskId: result.taskId })
        setSearchParams(nextParams, { replace: true })

        if (requiresApproval) {
          navigate(`/approvals?highlightTaskId=${result.taskId}&from=${isResubmission ? 'task-resubmitted' : 'task-created'}`, {
            state: {
              successMessage: nextSuccessMessage,
              createdTaskId: result.taskId,
              createdTaskTitle: form.title.trim(),
            },
          })
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '创建任务失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTaskAction(taskId: string, action: TaskAction, ownerAgentId: string | undefined) {
    setActionLoading(`${taskId}_${action}`)
    setActionFeedback('')

    try {
      await writebackService.updateTaskStatus({
        taskId,
        action,
        operatorId: ownerAgentId?.startsWith('agent_') ? ownerAgentId : `agent_${ownerAgentId ?? 'jarvis'}`,
      })
      await refreshSnapshot()

      const actionLabels: Record<string, string> = {
        start: '已开始执行',
        submit_review: '已提交审核',
        complete: '已标记完成，Token 已结算',
        freeze: '已冻结',
      }
      setActionFeedback(actionLabels[action] ?? '操作成功')
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionLoading('')
    }
  }

  async function handleOpenClawExecute(taskId: string) {
    setOpenclawLoading(true)
    setActionFeedback('')

    try {
      const result = await writebackService.executeTaskOpenClaw({
        taskId,
        operatorId: 'jarvis',
      })
      await refreshSnapshot()

      if (result.ok) {
        setActionFeedback(
          result.executionStatus === 'completed'
            ? 'OpenClaw 执行完成，任务已进入审核'
            : `OpenClaw 执行状态: ${result.executionStatus ?? '已提交'}`,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '执行失败'
      setActionFeedback(msg.includes('fetch') || msg.includes('connect')
        ? 'OpenClaw 服务未启动，请先启动 OpenClaw 再试'
        : msg)
    } finally {
      setOpenclawLoading(false)
    }
  }

  function clearHighlight() {
    if (!highlightTaskId) {
      return
    }

    setSearchParams({}, { replace: true })
  }

  const availableActions = selectedTask ? (statusActions[selectedTask.status] ?? []) : []

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">任务看板</p>
          <h2>任务作战室</h2>
          <p className="muted">创建任务、推进状态、查看审批轨迹，所有操作实时写回数据库。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">当前任务 {tasks.length}</div>
          <div className="metric-inline">待审批 {pendingApprovalCount}</div>
        </div>
      </div>

      <div className="page-split-grid task-page-grid-extended">
        <form className="form-panel" onSubmit={handleSubmit} ref={formPanelRef}>
          <div>
            <p className="eyebrow">创建任务</p>
            <h3>新建执行任务</h3>
          </div>

          <label className="field-group">
            <span>任务标题</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="例如：补齐审批页交互闭环"
              required
            />
          </label>

          <label className="field-group">
            <span>任务描述</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="说明任务目标、交付物与注意事项"
              rows={3}
              required
            />
          </label>

          <div className="form-grid-two">
            <label className="field-group">
              <span>任务类型</span>
              <select
                value={form.taskType}
                onChange={(event) => setForm((current) => ({ ...current, taskType: event.target.value as typeof current.taskType }))}
              >
                {taskTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>负责人</span>
              <select
                value={form.ownerAgentId}
                onChange={(event) => setForm((current) => ({ ...current, ownerAgentId: event.target.value as typeof current.ownerAgentId }))}
              >
                {ownerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid-three">
            <label className="field-group">
              <span>优先级</span>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as typeof current.priority }))}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>预算 Token</span>
              <input
                type="number"
                min={0}
                step={100}
                value={form.budgetToken}
                onChange={(event) => setForm((current) => ({ ...current, budgetToken: Number(event.target.value) }))}
                required
              />
            </label>

            <label className="field-group">
              <span>截止日期</span>
              <input
                type="date"
                value={form.dueAt}
                onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
              />
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(event) => setForm((current) => ({ ...current, requiresApproval: event.target.checked }))}
            />
            <span>该任务需要走审批流</span>
          </label>

          {(error || successMessage) && (
            <div className={error ? 'feedback-banner error' : 'feedback-banner success'}>
              {error || successMessage}
            </div>
          )}

          <div className="form-actions split-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '正在写回...' : sourceApprovalId ? '修正并重新提交任务' : '创建并写回任务'}
            </button>
            {highlightTaskId && (
              <button type="button" className="link-button" onClick={clearHighlight}>
                清除高亮
              </button>
            )}
          </div>
        </form>

        <div className="table-list compact-gap">
          {tasks.map((task) => {
            const isHighlighted = task.id === highlightTaskId
            const isSelected = task.id === selectedTaskId
            const highlightNote =
              isHighlighted && task.status === 'rejected'
                ? '审批已驳回，当前会在原任务上修正并重新提交'
                : isHighlighted && task.status === 'approved'
                  ? '审批已通过，可点击右侧面板开始执行'
                  : isHighlighted
                    ? '刚刚创建，已自动同步到任务看板'
                    : ''

            return (
              <button
                key={task.id}
                type="button"
                className={isHighlighted || isSelected ? 'table-row task-table-row highlighted-card task-card-button' : 'table-row task-table-row task-card-button'}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div>
                  <strong>{task.title}</strong>
                  <p>
                    {task.owner} · {taskTypeLabels[task.taskType ?? ''] ?? ''} · {priorityLabels[task.priority] ?? task.priority}
                  </p>
                  {highlightNote && <span className="inline-note">{highlightNote}</span>}
                  {task.resubmissionCount ? <p className="history-note">已重提 {task.resubmissionCount} 次</p> : null}
                  {task.latestRejectionNote ? <p className="history-note">最近驳回：{task.latestRejectionNote}</p> : null}
                </div>
                <span className={`status-pill ${task.status}`}>{statusLabelMap[task.status]}</span>
                <span>
                  {task.spentToken}/{task.budgetToken} Token
                </span>
              </button>
            )
          })}
        </div>

        <aside className="timeline-panel">
          {selectedTask ? (
            <>
              <div className="timeline-panel-header">
                <p className="eyebrow">任务详情与操作</p>
                <h3>{selectedTask.title}</h3>
                {selectedTask.description && <p className="muted">{selectedTask.description}</p>}
              </div>

              <div className="timeline-summary-grid">
                <div className="timeline-summary-card">
                  <span className="label">当前状态</span>
                  <strong>{statusLabelMap[selectedTask.status]}</strong>
                </div>
                <div className="timeline-summary-card">
                  <span className="label">Token 消耗</span>
                  <strong>{selectedTask.spentToken} / {selectedTask.budgetToken}</strong>
                </div>
              </div>

              {availableActions.length > 0 && (
                <div className="approval-actions" style={{ flexWrap: 'wrap' }}>
                  {availableActions.map(({ action, label, style }) => (
                    <button
                      key={action}
                      type="button"
                      className={style === 'warning' ? 'reject-button' : 'approve-button'}
                      disabled={actionLoading !== ''}
                      onClick={() => handleTaskAction(selectedTask.id, action, selectedTask.ownerAgentId)}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      {actionLoading === `${selectedTask.id}_${action}` ? '处理中...' : label}
                    </button>
                  ))}
                </div>
              )}

              {selectedTask.status && openclawEligibleStatuses.includes(selectedTask.status) && (
                <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: 12 }}>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>OpenClaw 智能体执行</p>
                  <button
                    type="button"
                    className="approve-button"
                    disabled={openclawLoading}
                    onClick={() => handleOpenClawExecute(selectedTask.id)}
                    style={{ border: 'none', cursor: openclawLoading ? 'not-allowed' : 'pointer', width: '100%' }}
                  >
                    {openclawLoading ? 'OpenClaw 执行中...' : 'OpenClaw 自动执行'}
                  </button>
                  <p className="history-note" style={{ marginTop: 6 }}>
                    将任务派发给对应角色的 OpenClaw Agent 自动执行
                  </p>
                </div>
              )}

              {actionFeedback && (
                <div className={
                  actionFeedback.includes('失败') || actionFeedback.includes('Cannot') || actionFeedback.includes('未启动')
                    ? 'feedback-banner error'
                    : 'feedback-banner success'
                }>
                  {actionFeedback}
                </div>
              )}

              <div style={{ marginTop: 4 }}>
                <p className="eyebrow">审批轨迹</p>
              </div>
              <div className="timeline-list">
                {(selectedTask.timeline ?? []).length > 0 ? (
                  selectedTask.timeline?.map((event) => (
                    <div key={event.id} className="timeline-item">
                      <div className="timeline-marker" />
                      <div className="timeline-content">
                        <div className="timeline-topline">
                          <span className="timeline-type">{timelineTypeLabelMap[event.type] ?? event.type}</span>
                          <span className="timeline-time">{event.createdAt}</span>
                        </div>
                        <p className="timeline-meta">第 {event.submissionIndex} 次提交 · {event.actor}</p>
                        <p>{event.note}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state-card">
                    <p>当前任务还没有可展示的轨迹。</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state-card timeline-empty">
              <p>点击任务卡片，查看详情与操作面板。</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
