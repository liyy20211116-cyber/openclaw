import { useState } from 'react'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { revenueService } from '../services/revenueService'
import { taskService } from '../services/taskService'
import { writebackService } from '../services/writebackService'
import { businessLineService } from '../services/businessLineService'

const initialForm = {
  title: '',
  businessLine: '',
  source: '',
  amountFiat: 0,
  mappedToken: 0,
  relatedTaskId: '',
  note: '',
}

type ViewTab = 'overview' | 'records' | 'analysis'

export function RevenuesPage() {
  useSnapshot()
  const revenues = revenueService.getAll()
  const totalRevenue = revenueService.getTotalRevenue()
  const tasks = taskService.getAll()
  const profitSummary = businessLineService.getProfitSummary()
  const businessLines = businessLineService.getAll()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [activeTab, setActiveTab] = useState<ViewTab>('overview')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback('')

    try {
      await writebackService.addRevenue({
        title: form.title.trim(),
        businessLine: form.businessLine.trim(),
        source: form.source.trim(),
        amountFiat: Number(form.amountFiat),
        mappedToken: Number(form.mappedToken),
        relatedTaskId: form.relatedTaskId || undefined,
        note: form.note.trim() || undefined,
      })
      await refreshSnapshot()
      setForm(initialForm)
      setFeedback('收入记录已添加')
      setShowForm(false)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '添加失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalTokenMapped = revenues.reduce((sum, item) => sum + item.tokenMapped, 0)

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">利润中心</p>
          <h2>收入与盈利复盘</h2>
          <p className="muted">记录真实收入，按业务线分析 ROI，追踪利润率变化。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">净利润 ¥{profitSummary.netProfit.toLocaleString()}</div>
          <div className="metric-inline">利润率 {profitSummary.profitMargin.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {([['overview', '总览'], ['records', '收入记录'], ['analysis', '业务线分析']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'approve-button' : 'link-button'}
            onClick={() => setActiveTab(key)}
            style={{ border: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="metrics-grid metrics-grid-6">
            <article className="metric-card">
              <span>累计收入</span>
              <strong>¥{totalRevenue.toLocaleString()}</strong>
            </article>
            <article className="metric-card">
              <span>总成本</span>
              <strong>¥{profitSummary.totalCostFiat.toLocaleString()}</strong>
            </article>
            <article className={profitSummary.netProfit > 0 ? 'metric-card' : 'metric-card warning'}>
              <span>净利润</span>
              <strong>¥{profitSummary.netProfit.toLocaleString()}</strong>
              <p>率{profitSummary.profitMargin.toFixed(1)}%</p>
            </article>
            <article className="metric-card">
              <span>收入笔数</span>
              <strong>{revenues.length}</strong>
            </article>
            <article className="metric-card">
              <span>业务线</span>
              <strong>{businessLines.filter((bl) => bl.status === 'active').length}/{businessLines.length}</strong>
            </article>
            <article className="metric-card">
              <span>Token映射</span>
              <strong>{totalTokenMapped.toLocaleString()}</strong>
            </article>
          </div>

          {profitSummary.businessLineBreakdown.length > 0 && (
            <div className="form-panel">
              <p className="eyebrow" style={{ marginBottom: 6 }}>业务线利润分布</p>
              <div className="stack-list compact-gap">
                {profitSummary.businessLineBreakdown.map((bl) => {
                  const barWidth = profitSummary.totalRevenue > 0 ? Math.max(5, (bl.revenue / profitSummary.totalRevenue) * 100) : 0
                  return (
                    <div key={bl.businessLine} className="stack-item" style={{ padding: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ fontSize: 13 }}>{bl.businessLine}</strong>
                        <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                          <span style={{ color: '#22c55e' }}>¥{bl.revenue.toLocaleString()}</span>
                          <span style={{ color: '#fbbf24' }}>¥{bl.costFiat.toLocaleString()}</span>
                          <span style={{ color: bl.profit > 0 ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                            净利 ¥{bl.profit.toLocaleString()} ({bl.margin.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.12)' }}>
                        <div style={{
                          width: `${barWidth}%`,
                          height: '100%',
                          borderRadius: 2,
                          background: bl.profit > 0
                            ? 'linear-gradient(90deg, #22c55e, #38bdf8)'
                            : 'linear-gradient(90deg, #ef4444, #fbbf24)',
                        }} />
                      </div>
                      <p className="history-note" style={{ margin: '2px 0 0' }}>
                        {bl.taskCount}任务 · {bl.completedTasks}完成
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 收入记录 Tab */}
      {activeTab === 'records' && (
        <>
          <div>
            <button
              type="button"
              className={showForm ? 'link-button' : 'approve-button'}
              onClick={() => setShowForm(!showForm)}
              style={{ border: 'none', cursor: 'pointer', fontSize: 12 }}
            >
              {showForm ? '收起表单' : '新增收入记录'}
            </button>
          </div>

          {feedback && (
            <div className={feedback.includes('已添加') ? 'feedback-banner success' : 'feedback-banner error'}>
              {feedback}
            </div>
          )}

          {showForm && (
            <form className="form-panel" onSubmit={handleSubmit}>
              <div>
                <p className="eyebrow">录入收入</p>
              </div>

              <label className="field-group">
                <span>收入标题</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="例如：AI 自动化搭建服务首单"
                  required
                />
              </label>

              <div className="form-grid-two">
                <label className="field-group">
                  <span>业务线</span>
                  <select
                    value={form.businessLine}
                    onChange={(e) => setForm((f) => ({ ...f, businessLine: e.target.value }))}
                    required
                  >
                    <option value="">选择业务线</option>
                    {businessLines.map((bl) => (
                      <option key={bl.id} value={bl.name}>{bl.name}</option>
                    ))}
                    <option value="__custom">手动输入...</option>
                  </select>
                </label>
                <label className="field-group">
                  <span>来源渠道</span>
                  <input
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    placeholder="例如：微信私域"
                    required
                  />
                </label>
              </div>

              <div className="form-grid-three">
                <label className="field-group">
                  <span>金额 (¥)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.amountFiat}
                    onChange={(e) => setForm((f) => ({ ...f, amountFiat: Number(e.target.value) }))}
                    required
                  />
                </label>
                <label className="field-group">
                  <span>映射 Token</span>
                  <input
                    type="number"
                    min={0}
                    value={form.mappedToken}
                    onChange={(e) => setForm((f) => ({ ...f, mappedToken: Number(e.target.value) }))}
                    required
                  />
                </label>
                <label className="field-group">
                  <span>关联任务</span>
                  <select
                    value={form.relatedTaskId}
                    onChange={(e) => setForm((f) => ({ ...f, relatedTaskId: e.target.value }))}
                  >
                    <option value="">无关联</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field-group">
                <span>备注</span>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="可选备注信息"
                  rows={2}
                />
              </label>

              <div className="form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '提交中...' : '录入收入'}
                </button>
              </div>
            </form>
          )}

          <div className="stack-list">
            {revenues.map((item) => (
              <div key={item.id} className="stack-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.businessLine} · ¥ {item.amount.toLocaleString()} · ROI {item.roi}
                    </p>
                  </div>
                  <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 18 }}>¥{item.amount.toLocaleString()}</span>
                </div>
                <p className="history-note">
                  来源任务：{item.sourceTask} · 映射 Token {item.tokenMapped.toLocaleString()}
                </p>
              </div>
            ))}
            {revenues.length === 0 && (
              <div className="empty-state-card" style={{ textAlign: 'center', padding: 32 }}>
                <p>暂无收入记录，点击上方「新增收入记录」开始。</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 业务线分析 Tab */}
      {activeTab === 'analysis' && (
        <>
          <div className="stack-list">
            {profitSummary.businessLineBreakdown.map((bl) => {
              const matchedBL = businessLines.find((b) => b.name === bl.businessLine)
              return (
                <div key={bl.businessLine} className="form-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <p className="eyebrow" style={{ marginBottom: 2 }}>{bl.businessLine}</p>
                      {matchedBL && <p className="muted">{matchedBL.description}</p>}
                    </div>
                    <span className={`status-pill ${bl.profit > 0 ? 'idle' : 'review'}`}>
                      {bl.profit > 0 ? '盈利' : '亏损'}
                    </span>
                  </div>

                  <div className="metrics-grid">
                    <article className="metric-card">
                      <span>收入</span>
                      <strong>¥{bl.revenue.toLocaleString()}</strong>
                    </article>
                    <article className="metric-card">
                      <span>成本</span>
                      <strong>¥{bl.costFiat.toLocaleString()}</strong>
                      <p>{bl.costToken.toLocaleString()}T</p>
                    </article>
                    <article className={bl.profit > 0 ? 'metric-card' : 'metric-card warning'}>
                      <span>净利润</span>
                      <strong>¥{bl.profit.toLocaleString()}</strong>
                      <p>率{bl.margin.toFixed(1)}%</p>
                    </article>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
                      <span>收入 vs 成本</span>
                      <span>{bl.taskCount}任务 / {bl.completedTasks}完成</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ flex: bl.revenue || 1, background: 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: '4px 0 0 4px' }} />
                      <div style={{ flex: bl.costFiat || 1, background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: '0 4px 4px 0' }} />
                    </div>
                  </div>

                  {matchedBL && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {matchedBL.pricingTiers.map((tier) => (
                        <span key={tier.name} className="metric-inline" style={{ fontSize: 10 }}>
                          {tier.name} ¥{tier.price.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {profitSummary.businessLineBreakdown.length === 0 && (
              <div className="empty-state-card" style={{ textAlign: 'center', padding: 20 }}>
                <p>暂无业务线数据。</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
