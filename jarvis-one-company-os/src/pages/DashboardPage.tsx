import { useNavigate } from 'react-router'
import { useSnapshot } from '../hooks/useSnapshot'
import { dashboardService } from '../services/dashboardService'

export function DashboardPage() {
  useSnapshot()
  const navigate = useNavigate()
  const o = dashboardService.getOverview()

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
    </>
  )
}
