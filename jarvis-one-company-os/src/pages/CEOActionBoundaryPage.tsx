import { useMemo, useState } from 'react'
import { ceoActionBoundaryService } from '../services/ceoActionBoundaryService'
import type { ActionDecision, ActionLevel, ActionType } from '../types'

const actionLevels: ActionLevel[] = [
  'A0_READ_ONLY',
  'A1_INTERNAL_DRAFT',
  'A2_INTERNAL_WRITE',
  'A3_EXTERNAL_ACTION',
  'A4_FINANCIAL_LEGAL',
]

const levelDescriptions: Record<ActionLevel, string> = {
  A0_READ_ONLY: '只读分析、数据整理、机会识别、报告生成。允许自动执行。',
  A1_INTERNAL_DRAFT: '生成内容草稿、方案草稿、任务草稿、报价草稿。允许自动执行，但应记录来源。',
  A2_INTERNAL_WRITE: '创建内部任务、更新内部状态、创建工作流、写入分析结果。默认允许，并记录边界说明。',
  A3_EXTERNAL_ACTION: '对外发布、私信、正式报价、发送方案、客户承诺。必须 CEO 审批。',
  A4_FINANCIAL_LEGAL: '确认收款、退款、合同、发票、正式确认收入、法律承诺。必须 CEO 审批。',
}

export function CEOActionBoundaryPage() {
  const actionPolicy = useMemo(() => ceoActionBoundaryService.listActionPolicy(), [])
  const [version, setVersion] = useState(0)
  const [selectedActionType, setSelectedActionType] = useState<ActionType>('quote_price')
  const [decision, setDecision] = useState<ActionDecision | null>(null)
  const approvals = useMemo(() => ceoActionBoundaryService.listMockApprovalRequests(), [version])

  function evaluateSelected() {
    setDecision(ceoActionBoundaryService.evaluateAction({
      actionType: selectedActionType,
      sourceModule: 'manual',
      sourceId: 'manual_boundary_test',
      title: ceoActionBoundaryService.getActionTypeLabel(selectedActionType),
      description: '动作边界测试评估，不执行真实动作。',
      amount: selectedActionType === 'quote_price' ? 19800 : 0,
      customerName: 'Boundary Test Customer',
      relatedOfferId: '',
      relatedWorkflowRunId: '',
      requestedByAgentId: 'jarvis',
      metadata: { source: 'action-boundary-page' },
    }))
  }

  function createApproval() {
    const result = ceoActionBoundaryService.createApprovalIfRequired({
      actionType: selectedActionType,
      sourceModule: 'manual',
      sourceId: 'manual_boundary_test',
      title: ceoActionBoundaryService.getActionTypeLabel(selectedActionType),
      description: '动作边界测试创建模拟审批，不执行真实动作。',
      amount: selectedActionType === 'quote_price' ? 19800 : 0,
      customerName: 'Boundary Test Customer',
      relatedOfferId: '',
      relatedWorkflowRunId: '',
      requestedByAgentId: 'jarvis',
      metadata: { source: 'action-boundary-page' },
    })
    setDecision(result.decision)
    setVersion(current => current + 1)
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">CEO Action Boundary</p>
          <h2>CEO 动作边界</h2>
          <p className="muted">统一判断哪些动作可自动执行，哪些必须 CEO 审批，哪些必须阻塞。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">动作 {actionPolicy.length}</div>
          <div className="metric-inline">模拟审批 {approvals.length}</div>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        系统不会自动执行对外动作、报价、收款、退款、合同、发票或法律承诺，必须经过 CEO 审批。
      </div>

      <div className="action-boundary-layout">
        <section className="form-panel">
          <p className="eyebrow">Action Levels</p>
          <h3>动作等级说明</h3>
          <div className="stack-list compact-gap">
            {actionLevels.map(level => (
              <div key={level} className="stack-item">
                <strong>{ceoActionBoundaryService.getActionLevelLabel(level)}</strong>
                <p>{levelDescriptions[level]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="form-panel">
          <p className="eyebrow">Boundary Test</p>
          <h3>测试评估区</h3>
          <label className="field-group">
            <span>动作类型</span>
            <select value={selectedActionType} onChange={(event) => setSelectedActionType(event.target.value as ActionType)}>
              {actionPolicy.map(item => (
                <option key={item.actionType} value={item.actionType}>{item.label} · {item.actionType}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="button" onClick={evaluateSelected}>评估动作边界</button>
            <button type="button" className="secondary-button" onClick={createApproval}>创建模拟审批</button>
          </div>
          {decision && (
            <div className={decision.requiresCeoApproval || decision.blocked ? 'feedback-banner error' : 'feedback-banner success'}>
              <strong>{ceoActionBoundaryService.getActionTypeLabel(decision.actionType)}</strong>
              <p>{decision.reason}</p>
              <p>{ceoActionBoundaryService.getBoundaryRiskHint(decision)}</p>
            </div>
          )}
        </section>
      </div>

      <section className="form-panel">
        <p className="eyebrow">Action Policy</p>
        <h3>动作类型清单</h3>
        <div className="table-list">
          {actionPolicy.map(item => (
            <div key={item.actionType} className="table-row action-boundary-row">
              <div>
                <strong>{item.label}</strong>
                <p>{item.actionType}</p>
              </div>
              <span className={`status-pill ${item.actionLevel}`}>{ceoActionBoundaryService.getActionLevelLabel(item.actionLevel)}</span>
              <span className={item.allowed ? 'status-pill approved' : 'status-pill rejected'}>{item.allowed ? '允许自动' : '不允许自动'}</span>
              <span className={item.requiresCeoApproval ? 'status-pill rejected' : 'status-pill approved'}>{item.requiresCeoApproval ? '需 CEO 审批' : '无需审批'}</span>
              <p>{item.riskHint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="form-panel">
        <p className="eyebrow">Mock Approval Requests</p>
        <h3>模拟审批请求</h3>
        <div className="stack-list compact-gap">
          {approvals.map(approval => (
            <div key={approval.id} className="stack-item">
              <div className="sales-card-top">
                <strong>{approval.title}</strong>
                <span className={`status-pill ${approval.status}`}>{approval.status}</span>
              </div>
              <p>{approval.description}</p>
              <div className="sales-card-metrics">
                <span className="metric-inline">{approval.sourceModule}/{approval.sourceId}</span>
                <span className="metric-inline">{ceoActionBoundaryService.getActionTypeLabel(approval.actionType)}</span>
                <span className="metric-inline">{ceoActionBoundaryService.getActionLevelLabel(approval.actionLevel)}</span>
                <span className="metric-inline">{approval.customerName || '无客户'}</span>
                <span className="metric-inline">¥{approval.amount.toLocaleString()}</span>
                <span className="metric-inline">{approval.createdAt}</span>
              </div>
            </div>
          ))}
          {approvals.length === 0 && (
            <div className="empty-state-card">
              <strong>暂无模拟审批</strong>
              <p>选择 A3/A4 动作后点击“创建模拟审批”。</p>
            </div>
          )}
        </div>
      </section>
    </section>
  )
}
