import { useState } from 'react'
import { useSnapshot } from '../hooks/useSnapshot'
import { profitabilityService } from '../services/profitabilityService'

const ENGINE_COLOR = '#22c55e'
const LEAK_COLOR = '#ef4444'
const NEUTRAL_COLOR = '#38bdf8'
const UNKNOWN_COLOR = '#64748b'

function classColor(classification: string): string {
  if (classification === 'engine') return ENGINE_COLOR
  if (classification === 'leak') return LEAK_COLOR
  if (classification === 'neutral') return NEUTRAL_COLOR
  return UNKNOWN_COLOR
}

function classLabel(classification: string): string {
  if (classification === 'engine') return '利润引擎'
  if (classification === 'leak') return '利润黑洞'
  if (classification === 'neutral') return '持平'
  return '数据不足'
}

export function ProfitabilityPage() {
  useSnapshot()
  const boundary = profitabilityService.getBoundary()
  const defaultBusinessLineId = boundary.unitEconomics[0]?.businessLineId ?? ''
  const [whatIfBusinessLineId, setWhatIfBusinessLineId] = useState(defaultBusinessLineId)
  const [priceDeltaPercent, setPriceDeltaPercent] = useState(20)
  const [costDeltaPercent, setCostDeltaPercent] = useState(0)
  const activeBusinessLineId = boundary.unitEconomics.some((item) => item.businessLineId === whatIfBusinessLineId)
    ? whatIfBusinessLineId
    : defaultBusinessLineId
  const scenario = activeBusinessLineId
    ? profitabilityService.simulateWhatIf({
        businessLineId: activeBusinessLineId,
        priceDeltaPercent,
        costDeltaPercent,
      })
    : null

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">盈利边界</p>
          <h2>从"感觉能赚"到"数字能赚"</h2>
          <p className="muted">{boundary.headline}</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">每日烧钱 ¥{boundary.dailyBurn.dailyFiatSpend.toFixed(2)}</div>
          <div className="metric-inline">月度 ¥{boundary.dailyBurn.monthlyFiatSpend.toFixed(0)}</div>
        </div>
      </div>

      <section className="metrics-grid metrics-grid-4">
        <article className={boundary.currentRevenue > 0 ? 'metric-card' : 'metric-card warning'}>
          <span>当前累计收入</span>
          <strong>¥{boundary.currentRevenue.toLocaleString()}</strong>
          <p>{boundary.currentRevenue > 0 ? '已有真实营收' : '尚无真实营收流水'}</p>
        </article>
        <article className="metric-card">
          <span>累计开销</span>
          <strong>¥{boundary.currentCostFiat.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <p>Token 折合 ¥{boundary.currentCostFiat.toFixed(2)}</p>
        </article>
        <article className={boundary.currentNetProfit >= 0 ? 'metric-card' : 'metric-card warning'}>
          <span>净利润</span>
          <strong>¥{boundary.currentNetProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <p>{boundary.currentNetProfit >= 0 ? '已覆盖成本' : '仍在亏损'}</p>
        </article>
        <article className="metric-card">
          <span>烧钱速率</span>
          <strong>¥{boundary.dailyBurn.dailyFiatSpend.toFixed(2)}/日</strong>
          <p>
            {boundary.dailyBurn.sampleDays > 0
              ? `样本 ${boundary.dailyBurn.sampleDays} 天 · 周 ¥${boundary.dailyBurn.weeklyFiatSpend.toFixed(0)}`
              : '尚无烧钱样本'}
          </p>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div className="panel" style={{ padding: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>本周烧钱速率</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <div className="metric-card" style={{ minHeight: 'auto' }}>
              <span>本周</span>
              <strong>¥{boundary.weeklyBurn.currentWeekFiatSpend.toFixed(2)}</strong>
              <p>{boundary.weeklyBurn.currentWeekTokenSpend.toLocaleString()} Token</p>
            </div>
            <div className="metric-card" style={{ minHeight: 'auto' }}>
              <span>上周</span>
              <strong>¥{boundary.weeklyBurn.previousWeekFiatSpend.toFixed(2)}</strong>
              <p>{boundary.weeklyBurn.previousWeekTokenSpend.toLocaleString()} Token</p>
            </div>
            <div className={boundary.weeklyBurn.trend === 'up' ? 'metric-card warning' : 'metric-card'} style={{ minHeight: 'auto' }}>
              <span>环比</span>
              <strong>{boundary.weeklyBurn.deltaFiatSpend > 0 ? '+' : ''}¥{boundary.weeklyBurn.deltaFiatSpend.toFixed(2)}</strong>
              <p>
                {boundary.weeklyBurn.deltaPercent != null
                  ? `${boundary.weeklyBurn.deltaPercent > 0 ? '+' : ''}${boundary.weeklyBurn.deltaPercent}%`
                  : '上周无基线'}
              </p>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <p className="eyebrow" style={{ margin: 0 }}>What-If 模拟器</p>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>定价/成本变动 {'->'} 盈亏平衡重算</span>
          </div>
          {scenario ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <span>业务线</span>
                  <select
                    value={activeBusinessLineId}
                    onChange={(event) => setWhatIfBusinessLineId(event.target.value)}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: '8px 10px' }}
                  >
                    {boundary.unitEconomics.map((item) => (
                      <option key={item.businessLineId} value={item.businessLineId}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <span>价格变动</span>
                  <input
                    type="number"
                    value={priceDeltaPercent}
                    min={-50}
                    max={100}
                    step={5}
                    onChange={(event) => setPriceDeltaPercent(Number(event.target.value))}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: '8px 10px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <span>成本变动</span>
                  <input
                    type="number"
                    value={costDeltaPercent}
                    min={-50}
                    max={100}
                    step={5}
                    onChange={(event) => setCostDeltaPercent(Number(event.target.value))}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: '8px 10px' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <div className="metric-card" style={{ minHeight: 'auto' }}>
                  <span>平均客单价</span>
                  <strong>¥{scenario.target.after.avgUnitPrice.toFixed(0)}</strong>
                  <p>{scenario.target.after.avgUnitPrice - scenario.target.before.avgUnitPrice >= 0 ? '+' : ''}¥{(scenario.target.after.avgUnitPrice - scenario.target.before.avgUnitPrice).toFixed(0)}</p>
                </div>
                <div className="metric-card" style={{ minHeight: 'auto' }}>
                  <span>平均单单利润</span>
                  <strong>¥{scenario.target.after.avgUnitProfit.toFixed(0)}</strong>
                  <p>{scenario.target.after.avgUnitProfit - scenario.target.before.avgUnitProfit >= 0 ? '+' : ''}¥{(scenario.target.after.avgUnitProfit - scenario.target.before.avgUnitProfit).toFixed(0)}</p>
                </div>
                <div className={scenario.target.after.ordersNeededPerMonth <= scenario.target.before.ordersNeededPerMonth ? 'metric-card' : 'metric-card warning'} style={{ minHeight: 'auto' }}>
                  <span>盈亏平衡线</span>
                  <strong>{scenario.target.after.ordersNeededPerMonth > 0 ? `${scenario.target.after.ordersNeededPerMonth} 单/月` : 'N/A'}</strong>
                  <p>
                    {scenario.target.before.ordersNeededPerMonth > 0 && scenario.target.after.ordersNeededPerMonth > 0
                      ? `${scenario.target.after.ordersNeededPerMonth - scenario.target.before.ordersNeededPerMonth > 0 ? '+' : ''}${scenario.target.after.ordersNeededPerMonth - scenario.target.before.ordersNeededPerMonth} 单/月`
                      : '当前无法估算'}
                  </p>
                </div>
                <div className="metric-card" style={{ minHeight: 'auto' }}>
                  <span>毛利率</span>
                  <strong>{scenario.target.after.grossMargin.toFixed(1)}%</strong>
                  <p>{scenario.target.after.grossMargin - scenario.target.before.grossMargin >= 0 ? '+' : ''}{(scenario.target.after.grossMargin - scenario.target.before.grossMargin).toFixed(1)}pp</p>
                </div>
              </div>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>暂无可模拟的业务线。</p>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div className="panel" style={{ padding: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>业务线单位经济</p>
          <div className="stack-list compact-gap">
            {boundary.unitEconomics.map((ue) => (
              <div key={ue.businessLineId} className="stack-item" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{ue.name}</strong>
                  <span className={`status-pill ${ue.status === 'active' ? 'approved' : 'pending'}`} style={{ fontSize: 11 }}>
                    {ue.status === 'active' ? '运营中' : ue.status === 'planning' ? '规划中' : '已暂停'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  均价 ¥{ue.avgUnitPrice.toFixed(0)} · 单单成本 ¥{ue.avgUnitCostFiat.toFixed(0)} · 毛利 ¥{ue.avgUnitProfit.toFixed(0)}（{ue.avgGrossMargin.toFixed(1)}%）
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ue.tiers.map((tier) => (
                    <div key={tier.name} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 11,
                      color: tier.unitProfit >= 0 ? '#cbd5e1' : '#fca5a5',
                    }}>
                      <span>{tier.name}</span>
                      <span>
                        ¥{tier.price.toLocaleString()} · 毛利 ¥{tier.unitProfit.toFixed(0)}（{tier.grossMargin}%）
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>盈亏平衡地图</p>
          {boundary.dailyBurn.monthlyFiatSpend === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>
              当前每月烧钱 ¥0（尚无真实账本流水），无法推算盈亏平衡。建议先运行 1 单真实任务产生流水。
            </p>
          ) : (
            <div className="stack-list compact-gap">
              {boundary.breakEven.map((be) => (
                <div key={be.businessLineId} className="stack-item" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong>{be.name}</strong>
                    <span style={{
                      fontSize: 16, fontWeight: 700,
                      color: be.avgUnitProfit > 0 ? '#22c55e' : '#ef4444',
                    }}>
                      {be.avgUnitProfit > 0 ? `${be.ordersNeededPerMonth} 单/月` : 'N/A'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                    {be.avgUnitProfit > 0
                      ? `≈ ${be.ordersPerWeek} 单/周 · 单单毛利 ¥${be.avgUnitProfit.toFixed(0)}`
                      : `单单毛利 ¥${be.avgUnitProfit.toFixed(0)}，无法覆盖成本`}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#f59e0b' }}>
                    {be.feasibilityNote}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div className="panel" style={{ padding: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>利润引擎（Top 5）</p>
          {boundary.profitEngines.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>尚无明确的利润引擎——需要先跑通"任务→收入"归因。</p>
          ) : (
            <div className="stack-list compact-gap">
              {boundary.profitEngines.map((a) => (
                <div key={a.agentId} className="stack-item" style={{ padding: 10 }}>
                  <strong>{a.name}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: ENGINE_COLOR }}>
                    RPC {a.rpc ?? '-'} · 净贡献 ¥{a.netContribution.toFixed(2)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{a.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>利润黑洞（Top 5）</p>
          {boundary.profitLeaks.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>暂无明显利润黑洞。若后续消耗增长但收入未跟上，此处会自动出现。</p>
          ) : (
            <div className="stack-list compact-gap">
              {boundary.profitLeaks.map((a) => (
                <div key={a.agentId} className="stack-item" style={{ padding: 10 }}>
                  <strong>{a.name}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: LEAK_COLOR }}>
                    花费 ¥{a.spentFiat.toFixed(2)} · 收入 ¥{a.attributedRevenue.toFixed(2)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{a.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel" style={{ padding: 14, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Agent 盈利能力全景</p>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>RPC = 单位成本带来的收入；越大越好</span>
        </div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Agent</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>花费 ¥</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>归因收入 ¥</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>净贡献</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>RPC</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>完成率</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>分类</th>
            </tr>
          </thead>
          <tbody>
            {boundary.agentRPC.map((a) => (
              <tr key={a.agentId} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                <td style={{ padding: '6px 8px' }}>
                  <strong>{a.name}</strong>
                  <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11 }}>{a.role}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>¥{a.spentFiat.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>¥{a.attributedRevenue.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '6px 8px', color: a.netContribution >= 0 ? '#22c55e' : '#ef4444' }}>
                  ¥{a.netContribution.toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>{a.rpc ?? '—'}</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>{a.completionRate}% ({a.completedTasks}/{a.totalTasks})</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999,
                    background: `${classColor(a.classification)}22`,
                    color: classColor(a.classification),
                  }}>
                    {classLabel(a.classification)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {boundary.taskPnL.length > 0 && (
        <section className="panel" style={{ padding: 14, marginTop: 10 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>任务级 P&amp;L（Top 20）</p>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>任务</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>负责人</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>花费 ¥</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>收入 ¥</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>盈亏</th>
              </tr>
            </thead>
            <tbody>
              {boundary.taskPnL.slice(0, 20).map((t) => (
                <tr key={t.taskId} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                  <td style={{ padding: '6px 8px', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</td>
                  <td style={{ padding: '6px 8px' }}>{t.owner}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>¥{t.spentFiat.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>¥{t.attributedRevenue.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: t.profit >= 0 ? '#22c55e' : '#ef4444' }}>
                    ¥{t.profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  )
}
