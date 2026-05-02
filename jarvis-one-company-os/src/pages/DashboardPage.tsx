import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSnapshot } from '../hooks/useSnapshot'
import { dashboardService, fetchLlmUsageSummary } from '../services/dashboardService'
import { AgentPerformanceChart } from '../components/AgentPerformanceChart'
import { NotificationPanel } from '../components/NotificationPanel'
import { agentService } from '../services/agentService'
import { loadAppConfig } from '../services/configService'
import { performanceV2Service } from '../services/performanceV2Service'
import { profitabilityService } from '../services/profitabilityService'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { LlmUsageSummary } from '../types'

const AGENT_COLORS = ['#38bdf8', '#a78bfa', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

function LlmCostPanel({ summary }: { summary: LlmUsageSummary }) {
  const pieData = summary.costByAgent
    .filter(a => a.estimatedCost > 0)
    .map(a => ({ name: a.agentId === 'unknown' ? '系统' : a.agentId, value: Math.round(a.estimatedCost * 10000) / 10000 }))

  return (
    <div className="panel" style={{ padding: 14 }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>LLM 成本追踪（本周）</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>今日成本</span>
          <div style={{ fontSize: 18, fontWeight: 700 }}>¥{summary.todayCost.toFixed(4)}</div>
          <span style={{ fontSize: 11, color: '#64748b' }}>{summary.todayCalls} 次调用</span>
        </div>
        <div>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>本周成本</span>
          <div style={{ fontSize: 18, fontWeight: 700 }}>¥{summary.weeklyCost.toFixed(4)}</div>
          <span style={{ fontSize: 11, color: '#64748b' }}>{summary.weeklyCalls} 次调用</span>
        </div>
        <div>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>本周 Token</span>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary.weeklyTokens.toLocaleString()}</div>
          <span style={{ fontSize: 11, color: '#64748b' }}>input+output</span>
        </div>
      </div>
      {pieData.length > 0 && (
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={2} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                {pieData.map((_, i) => <Cell key={i} fill={AGENT_COLORS[i % AGENT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `¥${Number(v).toFixed(4)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {pieData.length === 0 && <p style={{ color: '#64748b', fontSize: 12 }}>暂无调用数据</p>}
    </div>
  )
}

export function DashboardPage() {
  useSnapshot()
  const navigate = useNavigate()
  const o = dashboardService.getOverview()
  const agents = agentService.getAll()
  const [, setConfigVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadAppConfig().finally(() => {
      if (!cancelled) setConfigVersion((value) => value + 1)
    })
    return () => { cancelled = true }
  }, [])

  const commercialReport = performanceV2Service.getReport()
  const teamStats = (() => {
    const count = agents.filter((agent) => agent.id !== 'ceo').length
    const distText = (['S', 'A', 'B', 'C', 'D'] as const)
      .filter((grade) => (commercialReport.summary.gradeDistribution[grade] ?? 0) > 0)
      .map((grade) => `${commercialReport.summary.gradeDistribution[grade]}${grade}`)
      .join('')
    return {
      count,
      avgScore: commercialReport.summary.avgScore,
      grade: commercialReport.summary.companyReadinessGrade,
      distribution: distText,
    }
  })()

  const boundary = profitabilityService.getBoundary()
  const weeklyBurn = boundary.weeklyBurn
  const topBreakEven = boundary.breakEven
    .filter((b) => b.avgUnitProfit > 0 && b.ordersNeededPerMonth > 0)
    .sort((a, b) => a.ordersNeededPerMonth - b.ordersNeededPerMonth)[0]
  const boundaryTagline = topBreakEven
    ? `主推「${topBreakEven.name}」≈ ${topBreakEven.ordersPerWeek} 单/周即平衡`
    : boundary.currentNetProfit >= 0
      ? '已覆盖成本'
      : boundary.dailyBurn.monthlyFiatSpend === 0
        ? '先跑出 1 条真实流水'
        : '所有业务线单单亏损，需调整'

  const [llmSummary, setLlmSummary] = useState<LlmUsageSummary | null>(null)
  useEffect(() => {
    fetchLlmUsageSummary().then(setLlmSummary)
    const timer = setInterval(() => { fetchLlmUsageSummary().then(setLlmSummary) }, 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">CEO 驾驶舱</p>
          <h2>一人公司操作系统</h2>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={() => navigate('/ceo-chat?template=mvp-launch')}>新建目标</button>
          <button type="button" className="secondary" onClick={() => navigate('/playbook')}>盈利闭环</button>
        </div>
      </section>

      <section className="metrics-grid metrics-grid-6">
        <article className="metric-card">
          <span>累计收入</span>
          <strong>¥{o.weeklyRevenue.toLocaleString()}</strong>
        </article>
        <article className={o.netProfit > 0 ? 'metric-card' : 'metric-card warning'}>
          <span>净利润</span>
          <strong>¥{o.netProfit.toLocaleString()}</strong>
          <p>率 {o.profitMargin.toFixed(1)}%</p>
        </article>
        <article className="metric-card">
          <span>活跃任务</span>
          <strong>{o.activeTasks}</strong>
          <p>共{o.totalTasks} / 完成{o.completedTasks}</p>
        </article>
        <article className="metric-card warning">
          <span>Token支出</span>
          <strong>{o.weeklySpend.toLocaleString()}</strong>
          <p>余{o.treasuryBalance.toLocaleString()}</p>
        </article>
        <article className="metric-card">
          <span>待审批</span>
          <strong>{o.pendingApprovals}</strong>
        </article>
        <article className={o.openAuditEvents > 0 ? 'metric-card warning' : 'metric-card'}>
          <span>风险</span>
          <strong>{o.openAuditEvents}</strong>
          <p>冻结{o.frozenTasks}</p>
        </article>
      </section>

      <section className="metrics-grid metrics-grid-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <article
          className={boundary.currentNetProfit >= 0 ? 'metric-card' : 'metric-card warning'}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/profitability')}
        >
          <span style={{ color: boundary.currentNetProfit >= 0 ? '#22c55e' : '#f59e0b' }}>盈利边界</span>
          <strong>
            {topBreakEven
              ? `${topBreakEven.ordersNeededPerMonth} 单/月`
              : boundary.currentNetProfit >= 0 ? '已盈利' : '未知'}
          </strong>
          <p>{boundaryTagline}</p>
        </article>
        <article className="metric-card">
          <span style={{ color: '#22c55e' }}>商业就绪</span>
          <strong>{teamStats.avgScore.toFixed(1)}/100</strong>
          <p>
            {teamStats.count > 0
              ? `团队 ${teamStats.count} 人 · ${teamStats.grade}${teamStats.distribution ? ` · ${teamStats.distribution}` : ''}`
              : '暂无角色数据'}
          </p>
        </article>
        <article className="metric-card">
          <span style={{ color: '#38bdf8' }}>烧钱速率</span>
          <strong>¥{boundary.dailyBurn.dailyFiatSpend.toFixed(2)}/日</strong>
          <p>
            {boundary.dailyBurn.sampleDays > 0
              ? `本周 ¥${weeklyBurn.currentWeekFiatSpend.toFixed(0)} vs 上周 ¥${weeklyBurn.previousWeekFiatSpend.toFixed(0)}${weeklyBurn.deltaPercent != null ? ` · ${weeklyBurn.deltaPercent > 0 ? '+' : ''}${weeklyBurn.deltaPercent}%` : ''}`
              : '尚未产生真实账本流水'}
          </p>
        </article>
      </section>

      <section className="quick-actions-grid">
        <article className="panel action-card highlighted-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/playbook')}>
          <p className="eyebrow">核心</p>
          <h3>盈利闭环验证</h3>
          <p className="muted">选业务线，跑通端到端链路</p>
        </article>
        <article className="panel action-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/ceo-chat?template=mvp-launch')}>
          <p className="eyebrow">入口 01</p>
          <h3>CEO 目标拆解</h3>
          <p className="muted">输入目标 → 智能拆解 → 创建任务</p>
        </article>
        <article className="panel action-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
          <p className="eyebrow">入口 02</p>
          <h3>审批中心</h3>
          <p className="muted">待处理 {o.pendingApprovals} 条</p>
        </article>
        <article className="panel action-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/treasury')}>
          <p className="eyebrow">入口 03</p>
          <h3>Token 国库</h3>
          <p className="muted">发薪 · 可复投 ¥{o.reinvestableAmount.toLocaleString()}</p>
        </article>
        <article className="panel action-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/revenues')}>
          <p className="eyebrow">入口 04</p>
          <h3>利润中心</h3>
          <p className="muted">ROI {o.roiPercent.toFixed(0)}% · {o.activeBusinessLines}条业务线</p>
        </article>
        <article className="panel action-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/audit')}>
          <p className="eyebrow">入口 05</p>
          <h3>审计中心</h3>
          <p className="muted">{o.openAuditEvents > 0 ? `${o.openAuditEvents}个待处理` : '当前无风险'}</p>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 10 }}>
        <div className="panel" style={{ padding: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Agent 绩效概览</p>
          <AgentPerformanceChart />
        </div>
        <NotificationPanel />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {llmSummary && <LlmCostPanel summary={llmSummary} />}
        {llmSummary && llmSummary.recentLogs.length > 0 && (
          <div className="panel" style={{ padding: 14, overflow: 'auto', maxHeight: 320 }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>最近 LLM 调用</p>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>时间</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>调用方</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Token</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>成本</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>耗时</th>
                </tr>
              </thead>
              <tbody>
                {llmSummary.recentLogs.slice(0, 15).map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '3px 6px', color: '#64748b' }}>{String(log.createdAt).slice(11, 19)}</td>
                    <td style={{ padding: '3px 6px' }}>{log.callerFunction || log.agentId || '-'}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right' }}>{log.totalTokens.toLocaleString()}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#f59e0b' }}>¥{log.estimatedCost.toFixed(4)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#64748b' }}>{(log.durationMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
