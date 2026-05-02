import { useMemo, useState } from 'react'
import { offerCatalogService } from '../services/offerCatalogService'

type ApprovalFilter = 'all' | 'requires_approval' | 'no_approval'

export function OffersPage() {
  const offers = offerCatalogService.listOffers()
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const filteredOffers = useMemo(() => {
    return offers
      .filter(offer => {
        if (approvalFilter === 'requires_approval') return offer.requiresCeoQuoteApproval
        if (approvalFilter === 'no_approval') return !offer.requiresCeoQuoteApproval
        return true
      })
      .sort((a, b) => sortDirection === 'asc' ? a.price - b.price : b.price - a.price)
  }, [approvalFilter, offers, sortDirection])

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Offer Catalog</p>
          <h2>商业产品货架</h2>
          <p className="muted">标准化展示可销售产品、交付周期、交付物和报价审批边界。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">产品 {offers.length}</div>
          <div className="metric-inline">需审批 {offers.filter(offer => offer.requiresCeoQuoteApproval).length}</div>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        正式报价前必须进入 CEO 审批。
      </div>

      <div className="opportunity-toolbar">
        <label className="field-group compact-field">
          <span>报价审批</span>
          <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value as ApprovalFilter)}>
            <option value="all">全部产品</option>
            <option value="requires_approval">需要 CEO 审批</option>
            <option value="no_approval">无需报价审批</option>
          </select>
        </label>
        <button
          type="button"
          className="link-button"
          onClick={() => setSortDirection(current => current === 'asc' ? 'desc' : 'asc')}
        >
          价格 {sortDirection === 'asc' ? '从低到高' : '从高到低'}
        </button>
      </div>

      <div className="offer-grid">
        {filteredOffers.map(offer => (
          <article key={offer.id} className="offer-card">
            <div className="offer-card-header">
              <div>
                <p className="eyebrow">{offer.deliveryWorkflowId}</p>
                <h3>{offer.name}</h3>
              </div>
              <strong>¥{offer.price.toLocaleString()}</strong>
            </div>

            <p className="muted">{offer.description}</p>

            <div className="offer-meta-row">
              <span className="metric-inline">{offer.deliveryCycle}</span>
              <span className={offer.requiresCeoQuoteApproval ? 'status-pill rejected' : 'status-pill approved'}>
                {offer.requiresCeoQuoteApproval ? '报价需 CEO 审批' : '标准价可展示'}
              </span>
            </div>

            <div className="stack-item">
              <strong>目标客户</strong>
              <p>{offer.targetCustomer}</p>
            </div>

            <div>
              <strong className="label">痛点标签</strong>
              <div className="offer-tag-list">
                {offer.painPointTags.map(tag => (
                  <span key={tag} className="metric-inline">{tag}</span>
                ))}
              </div>
            </div>

            <div>
              <strong className="label">交付物</strong>
              <ul className="offer-deliverables">
                {offer.deliverables.map(deliverable => (
                  <li key={deliverable}>{deliverable}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
