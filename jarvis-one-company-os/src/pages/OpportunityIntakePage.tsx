import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ceoActionBoundaryService } from '../services/ceoActionBoundaryService'
import { offerCatalogService } from '../services/offerCatalogService'
import { opportunityIntakeService } from '../services/opportunityIntakeService'
import type { OpportunityDraft } from '../types'

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

function getDraftTone(draft: OpportunityDraft) {
  if (draft.status === 'imported') return 'good'
  if (draft.status === 'rejected') return 'danger'
  if (draft.parseConfidence >= 70) return 'good'
  if (draft.parseConfidence >= 45) return 'warning'
  return 'danger'
}

export function OpportunityIntakePage() {
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlDescription, setUrlDescription] = useState('')
  const [csvInput, setCsvInput] = useState('title,companyName,contactHint,painPoint,estimatedBudget,sourceUrl,source,urgency\nWarehouse dashboard,B Co,wx_ops,Manual inventory report,20000,https://example.com/post,manual,high')
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [editingDraft, setEditingDraft] = useState<OpportunityDraft | null>(null)
  const [feedback, setFeedback] = useState('')

  const drafts = useMemo(() => opportunityIntakeService.listOpportunityDrafts(), [version])
  const summary = useMemo(() => opportunityIntakeService.getIntakeSummary(), [version])
  const selectedDraft = drafts.find(draft => draft.id === selectedDraftId) ?? drafts[0]
  const selectedOffer = selectedDraft?.recommendedOfferId ? offerCatalogService.getOfferById(selectedDraft.recommendedOfferId) : undefined

  function refresh(message?: string) {
    setVersion(current => current + 1)
    if (message) setFeedback(message)
  }

  function parseText() {
    if (!textInput.trim()) {
      setFeedback('请先粘贴外部机会文本。')
      return
    }
    const draft = opportunityIntakeService.parseTextToOpportunityDraft(textInput)
    setSelectedDraftId(draft.id)
    setEditingDraft(null)
    refresh(`已解析机会草稿：${draft.title}`)
  }

  function parseUrl() {
    if (!urlInput.trim()) {
      setFeedback('请先输入 URL。')
      return
    }
    const draft = opportunityIntakeService.parseUrlToOpportunityDraft(urlInput.trim(), urlDescription)
    setSelectedDraftId(draft.id)
    setEditingDraft(null)
    refresh(`已解析 URL 机会：${draft.title}`)
  }

  function parseCsv() {
    if (!csvInput.trim()) {
      setFeedback('请先粘贴 CSV。')
      return
    }
    const parsed = opportunityIntakeService.parseCsvToOpportunityDrafts(csvInput)
    setSelectedDraftId(parsed[0]?.id ?? selectedDraftId)
    setEditingDraft(null)
    refresh(`已批量解析 ${parsed.length} 条机会草稿。`)
  }

  function approveDraft(draftId: string) {
    const result = opportunityIntakeService.approveDraftToOpportunity(draftId)
    setSelectedDraftId(result.draft.id)
    setEditingDraft(null)
    refresh(`已导入 Opportunity：${result.opportunity.title}`)
  }

  function rejectDraft(draftId: string) {
    const draft = opportunityIntakeService.rejectOpportunityDraft(draftId, 'manual review rejected')
    setSelectedDraftId(draft.id)
    setEditingDraft(null)
    refresh(`已拒绝草稿：${draft.title}`)
  }

  function saveDraftEdits() {
    if (!editingDraft) return
    const updated = opportunityIntakeService.updateOpportunityDraft(editingDraft.id, editingDraft)
    if (updated) {
      setSelectedDraftId(updated.id)
      setEditingDraft(null)
      refresh(`已更新草稿：${updated.title}`)
    }
  }

  function approveBoundaryNote() {
    const decision = ceoActionBoundaryService.evaluateAction({
      actionType: 'update_internal_status',
      sourceModule: 'opportunity',
      sourceId: selectedDraft?.id ?? 'draft',
      title: 'Approve imported opportunity draft',
      description: selectedDraft?.painPoint ?? '',
      amount: selectedDraft?.estimatedBudget ?? 0,
      customerName: selectedDraft?.companyName ?? '',
      relatedOfferId: selectedDraft?.recommendedOfferId ?? '',
      relatedWorkflowRunId: '',
      requestedByAgentId: selectedDraft?.ownerAgentId ?? 'jarvis',
      metadata: { target: 'opportunity_import' },
    })
    return decision.auditNote
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Opportunity Intake</p>
          <h2>外部机会导入</h2>
          <p className="muted">把外部看到的项目需求粘贴进来，系统会解析成项目机会草稿。不会自动联系客户、不会自动报价。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">草稿 {summary.draftCount}</div>
          <div className="metric-inline">待审核 {summary.reviewCount}</div>
          <div className="metric-inline">已导入 {summary.importedCount}</div>
        </div>
      </div>

      <div className="feedback-banner warning page-banner">
        导入机会只是内部记录，不会触发外部联系、报价或成交。
      </div>

      {feedback && <div className="feedback-banner success page-banner">{feedback}</div>}

      <div className="opportunity-score-grid">
        <article className="score-card">
          <span>总导入记录</span>
          <strong>{summary.totalRecords}</strong>
        </article>
        <article className="score-card">
          <span>平均置信度</span>
          <strong>{summary.averageParseConfidence}%</strong>
        </article>
        <article className="score-card">
          <span>被拒绝</span>
          <strong>{summary.rejectedCount}</strong>
        </article>
      </div>

      <div className="grid-3">
        <article className="form-panel">
          <p className="eyebrow">粘贴文本</p>
          <textarea
            rows={8}
            value={textInput}
            onChange={event => setTextInput(event.target.value)}
            placeholder="某仓储团队每天人工整理库存报表，需要做自动化看板和异常提醒，预算约 2 万，月底前想上线。"
          />
          <button type="button" onClick={parseText}>解析为机会草稿</button>
        </article>

        <article className="form-panel">
          <p className="eyebrow">URL + 描述</p>
          <input value={urlInput} onChange={event => setUrlInput(event.target.value)} placeholder="https://example.com/post" />
          <textarea
            rows={6}
            value={urlDescription}
            onChange={event => setUrlDescription(event.target.value)}
            placeholder="可选：补充 URL 对应的需求描述。本阶段不会抓取网页内容。"
          />
          <button type="button" onClick={parseUrl}>解析 URL 机会</button>
        </article>

        <article className="form-panel">
          <p className="eyebrow">CSV 粘贴导入</p>
          <textarea rows={8} value={csvInput} onChange={event => setCsvInput(event.target.value)} />
          <p className="history-note">字段：title, companyName, contactHint, painPoint, estimatedBudget, sourceUrl, source, urgency</p>
          <button type="button" onClick={parseCsv}>批量解析</button>
        </article>
      </div>

      <div className="opportunity-layout">
        <div className="stack-list">
          {drafts.length === 0 && <div className="empty-state">暂无机会草稿。</div>}
          {drafts.map(draft => {
            const offer = draft.recommendedOfferId ? offerCatalogService.getOfferById(draft.recommendedOfferId) : undefined
            return (
              <button
                type="button"
                key={draft.id}
                className={selectedDraft?.id === draft.id ? 'opportunity-row highlighted-card' : 'opportunity-row'}
                onClick={() => {
                  setSelectedDraftId(draft.id)
                  setEditingDraft(null)
                }}
              >
                <div className="opportunity-row-top">
                  <strong>{draft.title}</strong>
                  <span className={`score-pill ${getDraftTone(draft)}`}>{draft.parseConfidence}%</span>
                </div>
                <p>{draft.companyName || '未识别客户'} · {draft.status}</p>
                <p>{draft.painPoint}</p>
                <div className="opportunity-row-meta">
                  <span className="metric-inline">{formatCurrency(draft.estimatedBudget)}</span>
                  <span className="metric-inline">fit {draft.fitScore}</span>
                  <span className="metric-inline">risk {draft.riskScore}</span>
                  <span className="metric-inline">{offer?.name ?? '未匹配标准产品'}</span>
                </div>
              </button>
            )
          })}
        </div>

        {selectedDraft && (
          <aside className="form-panel opportunity-detail">
            <div>
              <p className="eyebrow">{selectedDraft.source}</p>
              <h3>{selectedDraft.title}</h3>
              <p className="muted">{selectedDraft.companyName || '客户待补充'} · {selectedDraft.contactHint || '联系方式待补充'}</p>
            </div>

            <div className="opportunity-score-grid">
              <div className={`score-card ${getDraftTone(selectedDraft)}`}>
                <span>解析置信度</span>
                <strong>{selectedDraft.parseConfidence}%</strong>
              </div>
              <div className="score-card">
                <span>fitScore</span>
                <strong>{selectedDraft.fitScore}</strong>
              </div>
              <div className="score-card danger">
                <span>riskScore</span>
                <strong>{selectedDraft.riskScore}</strong>
              </div>
            </div>

            <div className="stack-item">
              <strong>痛点</strong>
              <p>{selectedDraft.painPoint}</p>
            </div>
            <div className="stack-item">
              <strong>推荐产品</strong>
              <p>{selectedOffer ? `${selectedOffer.name} · ${formatCurrency(selectedOffer.price)}` : '未匹配标准产品'}</p>
              <p className="history-note">{selectedDraft.matchReason}</p>
              {selectedOffer?.requiresCeoQuoteApproval && <div className="feedback-banner error">该产品正式报价需要 CEO 审批。</div>}
            </div>
            <div className="stack-item">
              <strong>缺失字段</strong>
              <p>{selectedDraft.missingFields.length ? selectedDraft.missingFields.join(', ') : '无'}</p>
            </div>
            <div className="stack-item">
              <strong>证据 URL</strong>
              <p>{selectedDraft.evidenceUrl || selectedDraft.sourceUrl || '暂无'}</p>
            </div>
            <div className="stack-item">
              <strong>原始文本</strong>
              <p>{selectedDraft.rawText || '暂无原始文本，需人工补充。'}</p>
            </div>

            <div className="feedback-banner warning">{approveBoundaryNote()}</div>

            <div className="form-actions">
              <button type="button" onClick={() => setEditingDraft(selectedDraft)}>编辑草稿</button>
              <button type="button" className="secondary-button" disabled={selectedDraft.status === 'imported'} onClick={() => approveDraft(selectedDraft.id)}>
                批准导入 Opportunity
              </button>
              <button type="button" className="link-button" disabled={selectedDraft.status === 'rejected'} onClick={() => rejectDraft(selectedDraft.id)}>
                拒绝草稿
              </button>
              <button type="button" className="link-button" onClick={() => navigate('/opportunities')}>去项目机会</button>
            </div>
          </aside>
        )}
      </div>

      {editingDraft && (
        <div className="form-panel">
          <p className="eyebrow">编辑草稿</p>
          <div className="grid-2">
            <label className="field-group">
              <span>标题</span>
              <input value={editingDraft.title} onChange={event => setEditingDraft({ ...editingDraft, title: event.target.value })} />
            </label>
            <label className="field-group">
              <span>客户/公司</span>
              <input value={editingDraft.companyName} onChange={event => setEditingDraft({ ...editingDraft, companyName: event.target.value })} />
            </label>
            <label className="field-group">
              <span>联系提示</span>
              <input value={editingDraft.contactHint} onChange={event => setEditingDraft({ ...editingDraft, contactHint: event.target.value })} />
            </label>
            <label className="field-group">
              <span>预算</span>
              <input type="number" value={editingDraft.estimatedBudget} onChange={event => setEditingDraft({ ...editingDraft, estimatedBudget: Number(event.target.value) })} />
            </label>
          </div>
          <label className="field-group">
            <span>痛点</span>
            <textarea rows={4} value={editingDraft.painPoint} onChange={event => setEditingDraft({ ...editingDraft, painPoint: event.target.value })} />
          </label>
          <div className="form-actions">
            <button type="button" onClick={saveDraftEdits}>保存草稿</button>
            <button type="button" className="link-button" onClick={() => setEditingDraft(null)}>取消</button>
          </div>
        </div>
      )}
    </section>
  )
}
