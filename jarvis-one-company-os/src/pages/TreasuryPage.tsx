import { useState } from 'react'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { agentService } from '../services/agentService'
import { ledgerService } from '../services/ledgerService'
import { treasuryService } from '../services/treasuryService'
import { writebackService } from '../services/writebackService'

export function TreasuryPage() {
  useSnapshot()
  const ledger = ledgerService.getAll()
  const agents = agentService.getAll()
  const treasury = treasuryService.getTreasury()
  const totalWallet = ledgerService.getTotalWalletBalance()
  const weeklySpend = ledgerService.getWeeklySpend()

  const [isPayingSalary, setIsPayingSalary] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handlePaySalary() {
    setIsPayingSalary(true)
    setFeedback('')

    try {
      const result = await writebackService.paySalary({})
      await refreshSnapshot()
      setFeedback(`发薪成功：共 ${(result as Record<string, unknown>).paidAgents ?? '?'} 人，合计 ${(result as Record<string, unknown>).totalSalary ?? '?'} Token`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '发薪失败')
    } finally {
      setIsPayingSalary(false)
    }
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Token 国库</p>
          <h2>预算与流水管理</h2>
          <p className="muted">管理公司内部预算、发放工资、查看 Token 流水明细。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">总余额 {treasury.totalBalance.toLocaleString()}</div>
          <div className="metric-inline">可用 {treasury.availableBalance.toLocaleString()}</div>
        </div>
      </div>

      <div className="metrics-grid">
        <article className="metric-card">
          <span>国库总余额</span>
          <strong>{treasury.totalBalance.toLocaleString()}</strong>
          <p>预留{treasury.reservedBalance.toLocaleString()} · 可用{treasury.availableBalance.toLocaleString()}</p>
        </article>
        <article className="metric-card">
          <span>角色钱包</span>
          <strong>{totalWallet.toLocaleString()}</strong>
        </article>
        <article className="metric-card warning">
          <span>本周支出</span>
          <strong>{weeklySpend.toLocaleString()}</strong>
        </article>
      </div>

      <div className="form-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="eyebrow">薪资发放</p>
            <p className="muted">一键为全部角色发放周期工资</p>
          </div>
          <button
            type="button"
            className="approve-button"
            disabled={isPayingSalary}
            onClick={handlePaySalary}
            style={{ border: 'none', cursor: 'pointer' }}
          >
            {isPayingSalary ? '发放中...' : '一键发薪'}
          </button>
        </div>
        {feedback && (
          <div className={feedback.includes('成功') ? 'feedback-banner success' : 'feedback-banner error'}>
            {feedback}
          </div>
        )}
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>角色钱包</p>
      </div>
      <div className="agent-grid">
        {agents.map((agent) => (
          <div key={agent.id} className="agent-card" style={{ padding: 8 }}>
            <div className="agent-header">
              <div>
                <strong style={{ fontSize: 13 }}>{agent.name}</strong>
                <p style={{ fontSize: 11 }}>{agent.role}</p>
              </div>
              <span className="metric-inline">{agent.walletBalance}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>流水记录</p>
      </div>
      <div className="stack-list compact-gap">
        {ledger.map((item) => (
          <div key={item.id} className="stack-item">
            <strong>
              {item.actor} {item.amount > 0 ? '+' : ''}
              {item.amount} Token
            </strong>
            <p>
              {item.note} · {item.type} · {item.createdAt}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
