import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { agentService } from '../services/agentService'
import { ceoActionBoundaryService } from '../services/ceoActionBoundaryService'
import { offerCatalogService } from '../services/offerCatalogService'
import { opportunityService } from '../services/opportunityService'
import { salesPipelineService } from '../services/salesPipelineService'
import { writebackService } from '../services/writebackService'
import type { Opportunity, OpportunitySource, OpportunityStatus, TaskItem } from '../types'

const sourceLabels: Record<OpportunitySource, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  bilibili: 'B站',
  wechat: '微信',
  tender: '招投标',
  job_site: '招聘站',
  manual: '手动录入',
  other: '其他',
}

const statusLabels: Record<OpportunityStatus, string> = {
  discovered: '已发现',
  qualified: '已评分',
  contact_draft: '跟进草稿',
  contacted: '已联系',
  proposal: '方案中',
  won: '已赢单',
  lost: '已丢单',
}

const allStatuses: Array<'all' | OpportunityStatus> = [
  'all',
  'discovered',
  'qualified',
  'contact_draft',
  'contacted',
  'proposal',
  'won',
  'lost',
]

function getFollowUpDueDate() {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  return date.toISOString().slice(0, 10)
}

function getScoreClass(score: number, invert = false) {
  if (invert) {
    if (score >= 65) return 'danger'
    if (score >= 35) return 'warning'
    return 'good'
  }
  if (score >= 75) return 'good'
  if (score >= 50) return 'warning'
  return 'danger'
}

function summarizeTaskCreateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('Failed to fetch')) return '写回服务未启动'
  if (message.includes('PrismaClientKnownRequestError')) return '写回服务返回数据库导出错误'
  if (message.includes('Invalid')) return '写回服务校验失败'
  return message.slice(0, 120)
}

export function OpportunitiesPage() {
  useSnapshot()
  const navigate = useNavigate()
  const agents = agentService.getAll()
  const opportunities = opportunityService.listOpportunities()
  const [statusFilter, setStatusFilter] = useState<'all' | OpportunityStatus>('all')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [selectedId, setSelectedId] = useState(opportunities[0]?.id ?? '')
  const [processingId, setProcessingId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [salesLeadMessage, setSalesLeadMessage] = useState('')
  const [mockTasks, setMockTasks] = useState<TaskItem[]>([])

  const agentNameById = useMemo(() => {
    return new Map(agents.map(agent => [agent.id, agent.name]))
  }, [agents])

  const filtered = useMemo(() => {
    return opportunities
      .filter(opportunity => statusFilter === 'all' || opportunity.status === statusFilter)
      .sort((a, b) => {
        const delta = a.fitScore - b.fitScore
        return sortDirection === 'desc' ? -delta : delta
      })
  }, [opportunities, sortDirection, statusFilter])

  const selected = opportunityService.getOpportunityById(selectedId) ?? filtered[0] ?? opportunities[0]
  const selectedOfferMatch = selected ? offerCatalogService.matchOfferByOpportunity(selected) : null

  async function createFollowUpTask(opportunity: Opportunity) {
    setProcessingId(opportunity.id)
    setFeedback('')
    ceoActionBoundaryService.assertActionAllowed({
      actionType: 'create_internal_task',
      sourceModule: 'opportunity',
      sourceId: opportunity.id,
      title: `生成跟进任务：${opportunity.title}`,
      description: opportunity.painPoint,
      amount: opportunity.estimatedBudget,
      customerName: opportunity.companyName,
      relatedOfferId: '',
      relatedWorkflowRunId: '',
      requestedByAgentId: opportunity.ownerAgentId,
      metadata: { status: opportunity.status, source: opportunity.source },
    })
    const offerMatch = offerCatalogService.matchOfferByOpportunity(opportunity)
    const title = `跟进项目机会：${opportunity.title}`
    const description = [
      `痛点：${opportunity.painPoint}`,
      `推荐产品：${offerMatch.offer.name}`,
      `推荐理由：${offerMatch.matchReason}`,
      `证据链接：${opportunity.evidenceUrl}`,
      '',
      '边界：本任务只用于内部跟进准备，不自动发送私信、不自动报价、不自动确认成交。',
    ].join('\n')

    try {
      const result = await writebackService.createTask({
        title,
        description,
        taskType: 'sales',
        creatorAgentId: 'jarvis',
        ownerAgentId: opportunity.ownerAgentId,
        priority: opportunity.fitScore >= 75 ? 'high' : 'medium',
        budgetToken: opportunity.fitScore >= 75 ? 300 : 180,
        dueAt: getFollowUpDueDate(),
        requiresApproval: false,
      })
      await refreshSnapshot()
      setFeedback(`已创建跟进任务：${title}${result.taskId ? `（${result.taskId}）` : ''}`)
    } catch (error) {
      const mockTask: TaskItem = {
        id: `mock_task_${opportunity.id}`,
        title,
        owner: agentNameById.get(opportunity.ownerAgentId) ?? opportunity.ownerAgentId,
        ownerAgentId: opportunity.ownerAgentId,
        description,
        taskType: 'sales',
        priority: opportunity.fitScore >= 75 ? 'high' : 'medium',
        status: 'draft',
        budgetToken: opportunity.fitScore >= 75 ? 300 : 180,
        spentToken: 0,
        dueAt: getFollowUpDueDate(),
        requiresApproval: false,
      }
      setMockTasks(current => [mockTask, ...current.filter(task => task.id !== mockTask.id)])
      const message = summarizeTaskCreateError(error)
      setFeedback(`写回接口不可用，已生成本地 mock 跟进任务：${title}。原因：${message}`)
    } finally {
      setProcessingId('')
    }
  }

  function convertToSalesLead(opportunityId: string) {
    try {
      const opportunity = opportunityService.getOpportunityById(opportunityId)
      ceoActionBoundaryService.assertActionAllowed({
        actionType: 'update_internal_status',
        sourceModule: 'opportunity',
        sourceId: opportunityId,
        title: `转为销售线索：${opportunity?.title ?? opportunityId}`,
        description: opportunity?.painPoint ?? '',
        amount: opportunity?.estimatedBudget ?? 0,
        customerName: opportunity?.companyName ?? '',
        relatedOfferId: '',
        relatedWorkflowRunId: '',
        requestedByAgentId: opportunity?.ownerAgentId ?? 'fred',
        metadata: { target: 'sales_lead' },
      })
      const result = salesPipelineService.createSalesLeadFromOpportunity(opportunityId)
      setSalesLeadMessage(result.created
        ? `已转为销售线索：${result.lead.customerName}`
        : `该项目机会已存在销售线索：${result.lead.customerName}`)
    } catch (error) {
      setSalesLeadMessage(error instanceof Error ? error.message : '转为销售线索失败')
    }
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Opportunity Engine</p>
          <h2>项目机会引擎</h2>
          <p className="muted">记录、评分和跟进潜在项目机会。当前版本只创建内部跟进任务，不执行私信、报价、收款或成交动作。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">机会 {opportunities.length}</div>
          <div className="metric-inline">高匹配 {opportunities.filter(item => item.fitScore >= 75).length}</div>
        </div>
      </div>

      <div className="opportunity-toolbar">
        <label className="field-group compact-field">
          <span>状态筛选</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | OpportunityStatus)}>
            {allStatuses.map(status => (
              <option key={status} value={status}>{status === 'all' ? '全部状态' : statusLabels[status]}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="link-button"
          onClick={() => setSortDirection(current => current === 'desc' ? 'asc' : 'desc')}
        >
          fitScore {sortDirection === 'desc' ? '从高到低' : '从低到高'}
        </button>
        <button type="button" className="secondary-button" onClick={() => navigate('/opportunity-intake')}>
          导入外部机会
        </button>
      </div>

      {feedback && (
        <div className={feedback.includes('不可用') ? 'feedback-banner error page-banner' : 'feedback-banner success page-banner'}>
          {feedback}
        </div>
      )}
      {salesLeadMessage && (
        <div className="feedback-banner success page-banner">
          {salesLeadMessage}
          <button type="button" className="inline-mini-button" onClick={() => navigate('/sales')}>去销售管道查看</button>
        </div>
      )}

      <div className="opportunity-layout">
        <div className="stack-list">
          {filtered.map(opportunity => (
            <button
              key={opportunity.id}
              type="button"
              className={selected?.id === opportunity.id ? 'opportunity-row highlighted-card' : 'opportunity-row'}
              onClick={() => setSelectedId(opportunity.id)}
            >
              <div className="opportunity-row-top">
                <strong>{opportunity.title}</strong>
                <span className={`score-pill ${getScoreClass(opportunity.fitScore)}`}>{opportunity.fitScore}</span>
              </div>
              <p>{sourceLabels[opportunity.source]} · {opportunity.companyName}</p>
              <p>{opportunity.painPoint}</p>
              <div className="opportunity-row-meta">
                <span className="metric-inline">预算 ¥{opportunity.estimatedBudget.toLocaleString()}</span>
                <span className={`score-pill ${getScoreClass(opportunity.riskScore, true)}`}>风险 {opportunity.riskScore}</span>
                <span className="metric-inline">{offerCatalogService.matchOfferByOpportunity(opportunity).offer.name}</span>
                <span className={`status-pill ${opportunity.status}`}>{statusLabels[opportunity.status]}</span>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <aside className="form-panel opportunity-detail">
            <div>
              <p className="eyebrow">{sourceLabels[selected.source]}</p>
              <h3>{selected.title}</h3>
              <p className="muted">{selected.companyName} · {selected.contactHint}</p>
            </div>

            <div className="opportunity-score-grid">
              <div className={`score-card ${getScoreClass(selected.fitScore)}`}>
                <span>匹配分</span>
                <strong>{selected.fitScore}</strong>
              </div>
              <div className={`score-card ${getScoreClass(selected.riskScore, true)}`}>
                <span>风险分</span>
                <strong>{selected.riskScore}</strong>
              </div>
              <div className="score-card">
                <span>预计预算</span>
                <strong>¥{selected.estimatedBudget.toLocaleString()}</strong>
              </div>
            </div>

            <div className="stack-item">
              <strong>痛点</strong>
              <p>{selected.painPoint}</p>
            </div>

            <div className="stack-item">
              <strong>推荐产品</strong>
              {selectedOfferMatch && (
                <>
                  <p>{selectedOfferMatch.offer.name} · ¥{selectedOfferMatch.offer.price.toLocaleString()} · {selectedOfferMatch.offer.deliveryCycle}</p>
                  <p className="history-note">{selectedOfferMatch.matchReason}</p>
                  <p className="history-note">交付工作流：{selectedOfferMatch.offer.deliveryWorkflowId}</p>
                  {selectedOfferMatch.offer.requiresCeoQuoteApproval && (
                    <div className="feedback-banner error" style={{ marginTop: 8 }}>
                      该产品正式报价需要 CEO 审批。
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="stack-item">
              <strong>负责 Agent</strong>
              <p>{agentNameById.get(selected.ownerAgentId) ?? selected.ownerAgentId}</p>
            </div>

            <div className="stack-item">
              <strong>证据链接</strong>
              <p>{selected.evidenceUrl}</p>
            </div>

            <div className="opportunity-detail-meta">
              <span>状态：{statusLabels[selected.status]}</span>
              <span>创建：{selected.createdAt}</span>
              <span>更新：{selected.updatedAt}</span>
            </div>

            <div className="form-actions">
              <button type="button" disabled={processingId === selected.id} onClick={() => createFollowUpTask(selected)}>
                {processingId === selected.id ? '生成中...' : '生成跟进任务'}
              </button>
              <button type="button" className="secondary-button" onClick={() => convertToSalesLead(selected.id)}>
                转为销售线索
              </button>
            </div>
          </aside>
        )}
      </div>

      {mockTasks.length > 0 && (
        <div className="form-panel">
          <p className="eyebrow">本地 Mock 任务</p>
          <div className="stack-list compact-gap">
            {mockTasks.map(task => (
              <div key={task.id} className="stack-item">
                <strong>{task.title}</strong>
                <p>{task.owner} · {task.priority} · {task.dueAt}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
