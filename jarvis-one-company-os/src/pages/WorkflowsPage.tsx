import { useMemo, useState } from 'react'
import { agentService } from '../services/agentService'
import { ceoActionBoundaryService } from '../services/ceoActionBoundaryService'
import { workflowService } from '../services/workflowService'
import type { DeliveryWorkflowRun, DeliveryWorkflowStep, WorkflowStepRunStatus } from '../types'

const stepStatuses: WorkflowStepRunStatus[] = ['pending', 'running', 'waiting_approval', 'completed', 'failed', 'skipped']

const statusLabels: Record<string, string> = {
  pending: '待开始',
  running: '运行中',
  waiting_approval: '待审批',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
}

export function WorkflowsPage() {
  const [version, setVersion] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState('wf_ai_automation_diagnosis')
  const [feedback, setFeedback] = useState('')
  const templates = workflowService.listWorkflowTemplates()
  const runs = useMemo(() => workflowService.listWorkflowRuns(), [version])
  const agents = agentService.getAll()
  const agentNameById = useMemo(() => new Map(agents.map(agent => [agent.id, agent.name])), [agents])
  const selectedTemplate = workflowService.getWorkflowTemplateById(selectedTemplateId) ?? templates[0]

  const stats = {
    templates: templates.length,
    running: runs.filter(run => run.status === 'running').length,
    waitingApproval: runs.filter(run => run.status === 'waiting_approval').length,
    completed: runs.filter(run => run.status === 'completed').length,
    failed: runs.filter(run => run.status === 'failed').length,
  }

  function createManualRun() {
    ceoActionBoundaryService.assertActionAllowed({
      actionType: 'create_workflow_run',
      sourceModule: 'workflow',
      sourceId: selectedTemplate.id,
      title: `创建工作流：${selectedTemplate.name}`,
      description: selectedTemplate.description,
      amount: 0,
      customerName: '',
      relatedOfferId: '',
      relatedWorkflowRunId: '',
      requestedByAgentId: 'jarvis',
      metadata: { trigger: selectedTemplate.trigger },
    })
    const result = workflowService.createWorkflowRun(selectedTemplate.id, {
      contextType: 'manual',
      contextId: `manual_${Date.now()}`,
    })
    setFeedback(result.created ? `已创建工作流：${result.run.name}` : result.message)
    setVersion(current => current + 1)
  }

  function updateStep(step: DeliveryWorkflowStep, status: WorkflowStepRunStatus) {
    const updated = workflowService.updateWorkflowStepStatus(step.id, status)
    if (!updated) return
    if (updated.requiresApproval && status === 'waiting_approval') {
      ceoActionBoundaryService.createApprovalIfRequired({
        actionType: 'update_internal_status',
        sourceModule: 'workflow',
        sourceId: step.runId,
        title: `工作流步骤等待审批：${step.label}`,
        description: step.description,
        amount: 0,
        customerName: '',
        relatedOfferId: '',
        relatedWorkflowRunId: step.runId,
        requestedByAgentId: step.agentId,
        metadata: { stepId: step.id, skillId: step.skillId },
      })
      setFeedback('该步骤需要 CEO 审批，当前为本地模拟，未执行真实外部动作。')
    } else {
      setFeedback(`已本地更新步骤「${updated.label}」为：${statusLabels[updated.status]}`)
    }
    setVersion(current => current + 1)
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Workflows</p>
          <h2>交付工作流</h2>
          <p className="muted">从销售线索或手动操作创建标准交付流程。当前版本不执行真实 Agent，也不发送任何外部内容。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">模板 {stats.templates}</div>
          <div className="metric-inline">运行中 {stats.running}</div>
          <div className="metric-inline">待审批 {stats.waitingApproval}</div>
          <div className="metric-inline">完成 {stats.completed}</div>
          <div className="metric-inline">失败 {stats.failed}</div>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        需要审批的交付步骤必须进入 CEO 审批；本页状态更新为本地模拟，不触发真实 Agent 或外部动作。
      </div>
      {feedback && <div className={feedback.includes('CEO') ? 'feedback-banner error page-banner' : 'feedback-banner success page-banner'}>{feedback}</div>}

      <div className="workflow-layout">
        <aside className="form-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">模板</p>
              <h3>工作流模板</h3>
            </div>
          </div>
          <div className="stack-list compact-gap">
            {templates.map(template => (
              <button
                key={template.id}
                type="button"
                className={selectedTemplate.id === template.id ? 'template-card active' : 'template-card'}
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <strong>{template.name}</strong>
                <p>{template.description}</p>
                <div className="offer-meta-row">
                  <span className="metric-inline">{template.trigger}</span>
                  <span className="metric-inline">{template.steps.length} 步</span>
                </div>
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" onClick={createManualRun}>手动创建 WorkflowRun</button>
          </div>
        </aside>

        <div className="stack-list">
          {runs.length === 0 && (
            <div className="empty-state-card">
              <strong>暂无运行记录</strong>
              <p className="muted">选择左侧模板后手动创建一个 WorkflowRun。</p>
            </div>
          )}
          {runs.map(run => (
            <WorkflowRunCard
              key={run.id}
              run={run}
              agentNameById={agentNameById}
              onStepStatusChange={updateStep}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function WorkflowRunCard({
  run,
  agentNameById,
  onStepStatusChange,
}: {
  run: DeliveryWorkflowRun
  agentNameById: Map<string, string>
  onStepStatusChange: (step: DeliveryWorkflowStep, status: WorkflowStepRunStatus) => void
}) {
  const steps = workflowService.listWorkflowSteps(run.id)
  const progress = workflowService.getWorkflowProgress(run.id)

  return (
    <article className="workflow-run-card">
      <div className="workflow-run-header">
        <div>
          <p className="eyebrow">{run.contextType} · {run.contextId}</p>
          <h3>{run.name}</h3>
        </div>
        <span className={`status-pill ${run.status}`}>{statusLabels[run.status]}</span>
      </div>
      <div className="workflow-progress">
        <div style={{ width: `${progress.percentComplete}%` }} />
      </div>
      <p className="history-note">
        进度 {progress.completedSteps}/{progress.totalSteps} · {progress.percentComplete}%
        {progress.waitingApproval ? ' · 等待 CEO 审批' : ''}
        {progress.hasFailure ? ' · 存在失败步骤' : ''}
      </p>
      <div className="stack-list compact-gap">
        {steps.map(step => (
          <div key={step.id} className="workflow-step-row">
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
              <p className="history-note">
                Agent：{agentNameById.get(step.agentId) ?? step.agentId} · skillId：{step.skillId}
              </p>
              <p className="history-note">预期产出：{step.expectedOutput}</p>
              {step.outputSummary && <p className="history-note">输出：{step.outputSummary}</p>}
              {step.requiresApproval && <div className="feedback-banner error">该步骤需要 CEO 审批</div>}
            </div>
            <label className="field-group workflow-step-status">
              <span>状态</span>
              <select value={step.status} onChange={(event) => onStepStatusChange(step, event.target.value as WorkflowStepRunStatus)}>
                {stepStatuses.map(status => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </article>
  )
}
