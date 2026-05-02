import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { agentService } from '../services/agentService'
import { approvalBridgeService } from '../services/approvalBridgeService'
import { ceoActionBoundaryService } from '../services/ceoActionBoundaryService'
import { offerCatalogService } from '../services/offerCatalogService'
import { revenueConfirmationService } from '../services/revenueConfirmationService'
import { salesPipelineService } from '../services/salesPipelineService'
import { workflowService } from '../services/workflowService'
import type { SalesLead, SalesLeadStage } from '../types'

type SalesFilter = 'all' | 'approval' | 'payment_pending' | 'won' | 'lost'

const stages: SalesLeadStage[] = [
  'discovered',
  'qualified',
  'diagnosis',
  'proposal',
  'quote_review',
  'payment_pending',
  'won',
  'lost',
]

function filterLead(lead: SalesLead, filter: SalesFilter) {
  if (filter === 'approval') return lead.requiresCeoApproval
  if (filter === 'payment_pending') return lead.stage === 'payment_pending'
  if (filter === 'won') return lead.stage === 'won'
  if (filter === 'lost') return lead.stage === 'lost'
  return true
}

export function SalesPipelinePage() {
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const [filter, setFilter] = useState<SalesFilter>('all')
  const [feedback, setFeedback] = useState('')
  const agents = agentService.getAll()
  const agentNameById = useMemo(() => new Map(agents.map(agent => [agent.id, agent.name])), [agents])
  const leads = useMemo(() => salesPipelineService.listSalesLeads(), [version])
  const visibleLeads = leads.filter(lead => filterLead(lead, filter))

  const stats = {
    count: leads.length,
    value: leads.reduce((sum, lead) => sum + lead.valueEstimate, 0),
    approval: leads.filter(lead => lead.requiresCeoApproval).length,
    paymentPending: leads.filter(lead => lead.stage === 'payment_pending').length,
    won: leads.filter(lead => lead.stage === 'won').length,
  }

  function handleStageChange(lead: SalesLead, stage: SalesLeadStage) {
    const updated = salesPipelineService.updateSalesLeadStage(lead.id, stage)
    if (!updated) return
    const riskHint = salesPipelineService.getStageRiskHint(updated)
    setFeedback(riskHint
      ? `该动作需要 CEO 审批，当前为本地模拟，未执行真实外部动作。${riskHint}`
      : `已本地更新「${updated.customerName}」阶段为：${salesPipelineService.getStageLabel(updated.stage)}`)
    setVersion(current => current + 1)
  }

  function createDeliveryWorkflow(lead: SalesLead) {
    const boundary = ceoActionBoundaryService.assertActionAllowed({
      actionType: 'create_workflow_run',
      sourceModule: 'sales',
      sourceId: lead.id,
      title: `创建交付工作流：${lead.customerName}`,
      description: lead.painPoint,
      amount: lead.valueEstimate,
      customerName: lead.customerName,
      relatedOfferId: lead.recommendedOfferId,
      relatedWorkflowRunId: '',
      requestedByAgentId: lead.ownerAgentId,
      metadata: { stage: lead.stage },
    })
    const template = workflowService.getRecommendedWorkflowForSalesLead(lead)
    if (!template) {
      setFeedback('未找到可用交付工作流模板')
      return
    }

    const result = workflowService.createWorkflowRun(template.id, {
      contextType: 'sales_lead',
      contextId: lead.id,
    })
    setFeedback(result.created
      ? `内部动作已通过边界检查：${boundary.auditNote} 已创建交付工作流：${result.run.name}`
      : `该销售线索已存在交付工作流：${result.run.name}`)
    setVersion(current => current + 1)
  }

  function createRevenueRecord(lead: SalesLead, kind: 'quoted' | 'payment_pending' | 'expected') {
    const actionType = kind === 'quoted' ? 'quote_price' : kind === 'payment_pending' ? 'confirm_payment' : 'external_customer_commitment'
    const boundary = ceoActionBoundaryService.createApprovalIfRequired({
      actionType,
      sourceModule: 'sales',
      sourceId: lead.id,
      title: `${ceoActionBoundaryService.getActionTypeLabel(actionType)}：${lead.customerName}`,
      description: lead.painPoint,
      amount: lead.valueEstimate,
      customerName: lead.customerName,
      relatedOfferId: lead.recommendedOfferId,
      relatedWorkflowRunId: '',
      requestedByAgentId: lead.ownerAgentId,
      metadata: { stage: lead.stage, revenueKind: kind },
    })
    const result = kind === 'quoted'
      ? revenueConfirmationService.createQuotedRevenueFromSalesLead(lead.id)
      : kind === 'payment_pending'
        ? revenueConfirmationService.createPaymentPendingFromSalesLead(lead.id)
        : revenueConfirmationService.createExpectedRevenueFromSalesLead(lead.id)

    setFeedback(result.created
      ? `${boundary.decision.reason}${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''} 已创建收入确认记录：${revenueConfirmationService.getRevenueStatusLabel(result.record.status)} · ${result.record.offerName}`
      : `${boundary.decision.reason}${boundary.approvalId ? ` 模拟审批：${boundary.approvalId}` : ''} 该销售线索已存在同类型收入记录：${result.record.offerName}`)
    setVersion(current => current + 1)
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Sales Pipeline</p>
          <h2>销售管道</h2>
          <p className="muted">追踪从发现、诊断、方案、报价、待收款到成交/丢单的销售流程。所有对外动作仍需 CEO 审批。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">线索 {stats.count}</div>
          <div className="metric-inline">管道 ¥{stats.value.toLocaleString()}</div>
          <div className="metric-inline">需审批 {stats.approval}</div>
          <div className="metric-inline">待收款 {stats.paymentPending}</div>
          <div className="metric-inline">已成交 {stats.won}</div>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        正式报价、确认收款、退款、合同承诺、重大交付承诺和成交确认必须进入 CEO 审批。
      </div>
      {feedback && <div className={feedback.includes('CEO') || feedback.includes('审批') ? 'feedback-banner error page-banner' : 'feedback-banner success page-banner'}>{feedback}</div>}

      <div className="opportunity-toolbar">
        <label className="field-group compact-field">
          <span>筛选</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as SalesFilter)}>
            <option value="all">全部</option>
            <option value="approval">需要 CEO 审批</option>
            <option value="payment_pending">待收款</option>
            <option value="won">已成交</option>
            <option value="lost">已丢单</option>
          </select>
        </label>
      </div>

      <div className="sales-kanban">
        {stages.map(stage => {
          const stageLeads = visibleLeads.filter(lead => lead.stage === stage)
          return (
            <section key={stage} className="sales-column">
              <div className="sales-column-header">
                <strong>{salesPipelineService.getStageLabel(stage)}</strong>
                <span className="metric-inline">{stageLeads.length}</span>
              </div>
              <div className="stack-list compact-gap">
                {stageLeads.map(lead => (
                  <SalesLeadCard
                    key={lead.id}
                    lead={lead}
                    ownerName={agentNameById.get(lead.ownerAgentId) ?? lead.ownerAgentId}
                    onStageChange={handleStageChange}
                    onCreateDeliveryWorkflow={createDeliveryWorkflow}
                    onCreateRevenueRecord={createRevenueRecord}
                    onGoWorkflows={() => navigate('/workflows')}
                    onGoRevenueConfirmation={() => navigate('/revenue-confirmation')}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function SalesLeadCard({
  lead,
  ownerName,
  onStageChange,
  onCreateDeliveryWorkflow,
  onCreateRevenueRecord,
  onGoWorkflows,
  onGoRevenueConfirmation,
}: {
  lead: SalesLead
  ownerName: string
  onStageChange: (lead: SalesLead, stage: SalesLeadStage) => void
  onCreateDeliveryWorkflow: (lead: SalesLead) => void
  onCreateRevenueRecord: (lead: SalesLead, kind: 'quoted' | 'payment_pending' | 'expected') => void
  onGoWorkflows: () => void
  onGoRevenueConfirmation: () => void
}) {
  const offer = offerCatalogService.getOfferById(lead.recommendedOfferId)
  const riskHint = salesPipelineService.getStageRiskHint(lead)
  const approval = lead.stage === 'quote_review'
    ? approvalBridgeService.getApprovalStatusForSource('sales', lead.id, 'quote_price')
    : lead.stage === 'payment_pending'
      ? approvalBridgeService.getApprovalStatusForSource('sales', lead.id, 'confirm_payment')
      : lead.stage === 'won'
        ? approvalBridgeService.getApprovalStatusForSource('sales', lead.id, 'external_customer_commitment')
        : undefined

  return (
    <article className="sales-lead-card">
      <div className="sales-card-top">
        <strong>{lead.customerName}</strong>
        <span className={`status-pill ${lead.stage}`}>{salesPipelineService.getStageLabel(lead.stage)}</span>
      </div>
      <p>{lead.painPoint}</p>
      <div className="sales-card-metrics">
        <span className="metric-inline">¥{lead.valueEstimate.toLocaleString()}</span>
        <span className={lead.requiresCeoApproval ? 'status-pill rejected' : 'status-pill approved'}>
          {lead.requiresCeoApproval ? '需 CEO 审批' : '内部跟进'}
        </span>
      </div>
      <div className="stack-item">
        <strong>推荐产品</strong>
        {offer ? (
          <p>{offer.name} · ¥{offer.price.toLocaleString()} · {offer.requiresCeoQuoteApproval ? '报价需审批' : '标准价'} · {offer.deliveryWorkflowId}</p>
        ) : (
          <p>未匹配标准产品</p>
        )}
      </div>
      <p className="history-note">下一步：{lead.nextAction}</p>
      <p className="history-note">负责人：{ownerName}</p>
      {riskHint && <div className="feedback-banner error">{riskHint}</div>}
      {approval && <div className="feedback-banner success">审批状态：{approval.status} · {approval.id}</div>}
      {lead.approvalReason && <p className="history-note">审批原因：{lead.approvalReason}</p>}
      <label className="field-group">
        <span>更新阶段（本地模拟）</span>
        <select value={lead.stage} onChange={(event) => onStageChange(lead, event.target.value as SalesLeadStage)}>
          {stages.map(stage => (
            <option key={stage} value={stage}>{salesPipelineService.getStageLabel(stage)}</option>
          ))}
        </select>
      </label>
      {lead.stage === 'quote_review' && (
        <div className="form-actions">
          <button type="button" onClick={() => onCreateRevenueRecord(lead, 'quoted')}>
            生成报价收入
          </button>
          <button type="button" className="secondary-button" onClick={onGoRevenueConfirmation}>
            去收入确认查看
          </button>
        </div>
      )}
      {lead.stage === 'payment_pending' && (
        <div className="form-actions">
          <button type="button" onClick={() => onCreateRevenueRecord(lead, 'payment_pending')}>
            生成待收款记录
          </button>
          <button type="button" className="secondary-button" onClick={onGoRevenueConfirmation}>
            去收入确认查看
          </button>
        </div>
      )}
      {lead.stage === 'won' && (
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => onCreateRevenueRecord(lead, 'expected')}>
            查看/创建收入记录
          </button>
          <button type="button" onClick={() => onCreateDeliveryWorkflow(lead)}>
            创建交付工作流
          </button>
          <button type="button" className="secondary-button" onClick={onGoWorkflows}>
            去工作流查看
          </button>
          <button type="button" className="secondary-button" onClick={onGoRevenueConfirmation}>
            去收入确认查看
          </button>
        </div>
      )}
    </article>
  )
}
