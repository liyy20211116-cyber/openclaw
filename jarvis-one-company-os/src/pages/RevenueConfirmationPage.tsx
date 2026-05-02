import { useMemo, useState } from 'react'
import { approvalBridgeService } from '../services/approvalBridgeService'
import { salesPipelineService } from '../services/salesPipelineService'
import { revenueConfirmationService } from '../services/revenueConfirmationService'
import type { RevenueRecord, RevenueStatus, SalesLead } from '../types'

type RevenueFilter =
  | 'all'
  | 'expected'
  | 'payment_pending'
  | 'confirmed_cash'
  | 'delivered'
  | 'recognized'
  | 'refunded'
  | 'approval'

const filterLabels: Record<RevenueFilter, string> = {
  all: '全部',
  expected: '预计收入',
  payment_pending: '待收款',
  confirmed_cash: '已确认收款',
  delivered: '已交付',
  recognized: '正式确认收入',
  refunded: '已退款',
  approval: '需要 CEO 审批',
}

function matchesFilter(record: RevenueRecord, filter: RevenueFilter) {
  if (filter === 'expected') return record.status === 'expected' || record.status === 'quoted'
  if (filter === 'payment_pending') return record.status === 'payment_pending'
  if (filter === 'confirmed_cash') return revenueConfirmationService.isConfirmedCash(record)
  if (filter === 'delivered') return record.status === 'delivered'
  if (filter === 'recognized') return revenueConfirmationService.isRecognizedRevenue(record)
  if (filter === 'refunded') return record.status === 'refunded'
  if (filter === 'approval') return record.requiresCeoApproval
  return true
}

export function RevenueConfirmationPage() {
  const [version, setVersion] = useState(0)
  const [filter, setFilter] = useState<RevenueFilter>('all')
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [feedback, setFeedback] = useState('')

  const records = useMemo(() => revenueConfirmationService.listRevenueRecords(), [version])
  const summary = useMemo(() => revenueConfirmationService.getRevenueSummary(), [version])
  const leads = useMemo(() => salesPipelineService.listSalesLeads(), [version])
  const visibleRecords = records.filter(record => matchesFilter(record, filter))

  function refresh(message: string) {
    setFeedback(message)
    setVersion(current => current + 1)
  }

  function selectedLead(): SalesLead | undefined {
    const id = selectedLeadId || leads[0]?.id
    return id ? salesPipelineService.getSalesLeadById(id) : undefined
  }

  function createFromLead(kind: 'expected' | 'quoted' | 'payment_pending') {
    const lead = selectedLead()
    if (!lead) {
      setFeedback('请先选择销售线索。')
      return
    }
    const result = kind === 'expected'
      ? revenueConfirmationService.createExpectedRevenueFromSalesLead(lead.id)
      : kind === 'quoted'
        ? revenueConfirmationService.createQuotedRevenueFromSalesLead(lead.id)
        : revenueConfirmationService.createPaymentPendingFromSalesLead(lead.id)
    refresh(result.created ? result.message : `${result.message} 当前记录：${result.record.offerName}`)
  }

  function runAction(action: () => { message: string }) {
    const result = action()
    refresh(result.message)
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Revenue Confirmation</p>
          <h2>收入确认</h2>
          <p className="muted">区分预测、报价、待收款、已确认收款、交付和正式收入。只有 recognized 计入正式收入。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">记录 {summary.totalRecords}</div>
          <div className="metric-inline">需审批 {summary.requiresCeoApprovalCount}</div>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        收款确认、正式收入确认和退款必须进入 CEO 审批；本页仅做本地模拟，不执行真实财务动作。
      </div>
      {feedback && <div className={feedback.includes('CEO') || feedback.includes('审批') ? 'feedback-banner error page-banner' : 'feedback-banner success page-banner'}>{feedback}</div>}

      <div className="metrics-grid metrics-grid-6">
        <article className="metric-card">
          <span>预计收入</span>
          <strong>¥{summary.expectedRevenue.toLocaleString()}</strong>
          <p>expected + quoted</p>
        </article>
        <article className="metric-card">
          <span>待收款</span>
          <strong>¥{summary.paymentPending.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>已确认收款</span>
          <strong>¥{summary.confirmedCash.toLocaleString()}</strong>
          <p>不等于正式收入</p>
        </article>
        <article className="metric-card">
          <span>正式确认收入</span>
          <strong>¥{summary.recognizedRevenue.toLocaleString()}</strong>
        </article>
        <article className="metric-card warning">
          <span>已退款</span>
          <strong>¥{summary.refunded.toLocaleString()}</strong>
        </article>
        <article className="metric-card warning">
          <span>CEO 审批</span>
          <strong>{summary.requiresCeoApprovalCount}</strong>
        </article>
      </div>

      <div className="form-panel">
        <p className="eyebrow">从 SalesLead 创建收入记录</p>
        <div className="form-grid-two">
          <label className="field-group">
            <span>销售线索</span>
            <select value={selectedLeadId || leads[0]?.id || ''} onChange={(event) => setSelectedLeadId(event.target.value)}>
              {leads.map(lead => (
                <option key={lead.id} value={lead.id}>
                  {lead.customerName} · {salesPipelineService.getStageLabel(lead.stage)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions revenue-actions">
            <button type="button" className="secondary-button" onClick={() => createFromLead('expected')}>生成预计收入</button>
            <button type="button" onClick={() => createFromLead('quoted')}>生成报价收入</button>
            <button type="button" onClick={() => createFromLead('payment_pending')}>生成待收款记录</button>
          </div>
        </div>
      </div>

      <div className="opportunity-toolbar">
        <label className="field-group compact-field">
          <span>筛选</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as RevenueFilter)}>
            {(Object.keys(filterLabels) as RevenueFilter[]).map(key => (
              <option key={key} value={key}>{filterLabels[key]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="stack-list">
        {visibleRecords.map(record => (
          <RevenueRecordCard
            key={record.id}
            record={record}
            onAction={runAction}
          />
        ))}
        {visibleRecords.length === 0 && (
          <div className="empty-state-card">
            <strong>暂无收入确认记录</strong>
            <p>可从销售线索创建预计、报价或待收款记录。</p>
          </div>
        )}
      </div>
    </section>
  )
}

function RevenueRecordCard({
  record,
  onAction,
}: {
  record: RevenueRecord
  onAction: (action: () => { message: string }) => void
}) {
  const riskHint = revenueConfirmationService.getRevenueRiskHint(record)
  const confirmedCash = revenueConfirmationService.isConfirmedCash(record)
  const recognizedRevenue = revenueConfirmationService.isRecognizedRevenue(record)
  const approval = approvalBridgeService.getApprovalStatusForSource('revenue', record.id, record.status === 'delivered' ? 'recognize_revenue' : record.status === 'refunded' ? 'issue_refund' : 'confirm_payment')

  return (
    <article className="revenue-confirmation-card">
      <div className="sales-card-top">
        <div>
          <strong>{record.customerName}</strong>
          <p className="history-note">{record.offerName} · ¥{record.amount.toLocaleString()}</p>
        </div>
        <span className={`status-pill ${record.status}`}>{revenueConfirmationService.getRevenueStatusLabel(record.status)}</span>
      </div>

      <div className="sales-card-metrics">
        <span className="metric-inline">来源：{record.sourceType}</span>
        <span className={confirmedCash ? 'status-pill approved' : 'status-pill rejected'}>{confirmedCash ? '算已确认收款' : '不算已确认收款'}</span>
        <span className={recognizedRevenue ? 'status-pill approved' : 'status-pill rejected'}>{recognizedRevenue ? '算正式收入' : '不算正式收入'}</span>
        <span className={record.requiresCeoApproval ? 'status-pill rejected' : 'status-pill approved'}>{record.requiresCeoApproval ? '需 CEO 审批' : '无需审批'}</span>
      </div>

      {riskHint && <div className="feedback-banner error">{riskHint}</div>}
      {approval && (
        <div className="feedback-banner success">
          审批状态：{approval.status} · {approval.id} · {approval.updatedAt}
          {approval.status === 'approved' ? '。审批已通过，请手动执行状态更新；当前版本不会自动执行真实财务动作。' : ''}
        </div>
      )}
      {record.approvalReason && <p className="history-note">审批原因：{record.approvalReason}</p>}
      <p className="history-note">workflowRunId：{record.deliveryWorkflowRunId || '未关联'} · 创建时间：{record.createdAt}</p>
      {record.paymentEvidence && <p className="history-note">收款证据：{record.paymentEvidence}</p>}
      {record.notes && <p>{record.notes}</p>}

      <div className="form-actions revenue-actions">
        {record.status === 'payment_pending' && (
          <>
            <button type="button" onClick={() => onAction(() => revenueConfirmationService.requestPaymentConfirmation(record.id))}>
              请求 CEO 确认收款
            </button>
            <button type="button" className="secondary-button" onClick={() => onAction(() => revenueConfirmationService.confirmPayment(record.id, 'ceo'))}>
              本地模拟 CEO 确认收款
            </button>
          </>
        )}
        {record.status === 'payment_confirmed' && (
          <button type="button" className="secondary-button" onClick={() => onAction(() => revenueConfirmationService.markDeliveryStarted(record.id, record.deliveryWorkflowRunId || `manual_workflow_${record.id}`))}>
            标记开始交付
          </button>
        )}
        {record.status === 'delivery_started' && (
          <button type="button" className="secondary-button" onClick={() => onAction(() => revenueConfirmationService.markDelivered(record.id))}>
            标记已交付
          </button>
        )}
        {record.status === 'delivered' && (
          <>
            <button type="button" onClick={() => onAction(() => revenueConfirmationService.requestRevenueRecognition(record.id))}>
              请求 CEO 确认正式收入
            </button>
            <button type="button" className="secondary-button" onClick={() => onAction(() => revenueConfirmationService.recognizeRevenue(record.id, 'ceo'))}>
              本地模拟 CEO 确认收入
            </button>
          </>
        )}
        {record.status !== 'refunded' && (
          <button type="button" className="reject-button" onClick={() => onAction(() => revenueConfirmationService.requestRefund(record.id))}>
            请求退款
          </button>
        )}
      </div>
    </article>
  )
}
