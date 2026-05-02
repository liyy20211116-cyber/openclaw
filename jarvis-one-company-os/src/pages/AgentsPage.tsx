import { useEffect, useMemo, useState } from 'react'
import { statusLabelMap } from '../app/status'
import { useSnapshot } from '../hooks/useSnapshot'
import { agentService } from '../services/agentService'
import { loadAppConfig } from '../services/configService'
import { ledgerService } from '../services/ledgerService'
import { performanceV2Service } from '../services/performanceV2Service'
import { taskService } from '../services/taskService'
import { CommercialReadinessRadar } from '../components/CommercialReadinessRadar'
import { OrgChart } from '../components/OrgChart'
import { MemoryBrowser } from '../components/MemoryBrowser'
import { PerformanceSparkline } from '../components/PerformanceSparkline'
import { gradeColor, scoreColor, fetchPerformanceHistory } from '../services/performanceService'
import type { CommercialDimensionKey, PerformanceHistoryPoint } from '../types'

const dimensionLabelMap: Record<CommercialDimensionKey, string> = {
  autonomy: '自主运行',
  revenue_contribution: '自主盈利',
  intelligence: '聪明大脑',
  execution: '灵活手脚',
  productization: '可商业化',
}

export function AgentsPage() {
  useSnapshot()
  const agents = agentService.getAll()
  const tasks = taskService.getAll()
  const ledger = ledgerService.getAll()
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [, setConfigVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadAppConfig().finally(() => {
      if (!cancelled) setConfigVersion((value) => value + 1)
    })
    return () => { cancelled = true }
  }, [])

  const commercialReport = performanceV2Service.getReport()

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )
  const selectedCommercial = useMemo(
    () => commercialReport.records.find((item) => item.agentId === selectedAgentId) ?? null,
    [commercialReport.records, selectedAgentId],
  )

  const agentTasks = useMemo(() => {
    if (!selectedAgent) return []
    return tasks.filter((t) => t.ownerAgentId === selectedAgent.id || t.owner === selectedAgent.name)
  }, [tasks, selectedAgent])

  const agentLedger = useMemo(() => {
    if (!selectedAgent) return []
    const agentCode = selectedAgent.id.replace('agent_', '').replaceAll('_', ' ')
    return ledger.filter((l) => l.actor === agentCode || l.actor === selectedAgent.id || l.actor === selectedAgent.name)
  }, [ledger, selectedAgent])

  const [historyByAgent, setHistoryByAgent] = useState<Record<string, PerformanceHistoryPoint[]>>({})

  useEffect(() => {
    let cancelled = false
    const agentCode = selectedAgent?.id
    if (!agentCode) return
    if (historyByAgent[agentCode] !== undefined) return
    fetchPerformanceHistory(agentCode, 20).then((points) => {
      if (cancelled) return
      setHistoryByAgent((prev) => ({ ...prev, [agentCode]: points }))
    })
    return () => { cancelled = true }
  }, [selectedAgent, historyByAgent])

  const history = selectedAgent ? historyByAgent[selectedAgent.id] ?? [] : []
  const historyLoading = !!selectedAgent && historyByAgent[selectedAgent.id] === undefined

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">角色中心</p>
          <h2>核心角色编制</h2>
          <p className="muted">点击角色卡片查看详细信息、近期任务和 Token 流水。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">角色 {agents.length}</div>
        </div>
      </div>

      <div className="page-split-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 340px)' }}>
        <div className="agent-grid">
          {agents.map((agent) => {
            const isSelected = agent.id === selectedAgentId
            return (
              <button
                key={agent.id}
                type="button"
                className={isSelected ? 'agent-card highlighted-card task-card-button' : 'agent-card task-card-button'}
                onClick={() => setSelectedAgentId(agent.id)}
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <div className="agent-header">
                  <div>
                    <strong>{agent.name}</strong>
                    <p>
                      {agent.role} · {agent.department}
                    </p>
                  </div>
                  <span className={`status-pill ${agent.status}`}>{statusLabelMap[agent.status]}</span>
                </div>
                <p className="muted">{agent.persona}</p>
                <div className="agent-stats">
                  <span>钱包 {agent.walletBalance}</span>
                  <span>任务 {agent.currentTasks}</span>
                  <span>合规 {agent.complianceScore}</span>
                  {commercialReport.records.find((item) => item.agentId === agent.id) && (
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>
                      商业就绪 {commercialReport.records.find((item) => item.agentId === agent.id)!.score} {commercialReport.records.find((item) => item.agentId === agent.id)!.grade}
                    </span>
                  )}
                  {agent.performance && (
                    <span style={{
                      color: scoreColor(agent.performance.score),
                      fontWeight: 600,
                    }}>
                      绩效 {agent.performance.score} {agent.performance.grade}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <aside className="timeline-panel">
          {selectedAgent ? (
            <>
              <div className="timeline-panel-header">
                <p className="eyebrow">角色详情</p>
                <h3>{selectedAgent.name}</h3>
                <p className="muted">{selectedAgent.role} · {selectedAgent.department}</p>
              </div>

              <div className="timeline-summary-grid">
                <div className="timeline-summary-card">
                  <span className="label">钱包余额</span>
                  <strong>{selectedAgent.walletBalance} Token</strong>
                </div>
                <div className="timeline-summary-card">
                  <span className="label">合规分</span>
                  <strong>{selectedAgent.complianceScore}</strong>
                </div>
                {selectedCommercial && (
                  <div className="timeline-summary-card" style={{
                    borderColor: `${gradeColor(selectedCommercial.grade)}55`,
                  }}>
                    <span className="label">商业就绪 v2</span>
                    <strong style={{ color: gradeColor(selectedCommercial.grade) }}>
                      {selectedCommercial.score}/100 {selectedCommercial.grade}
                    </strong>
                  </div>
                )}
                {selectedAgent.performance && (
                  <div className="timeline-summary-card" style={{
                    borderColor: `${gradeColor(selectedAgent.performance.grade)}55`,
                  }}>
                    <span className="label">绩效评分</span>
                    <strong style={{ color: scoreColor(selectedAgent.performance.score) }}>
                      {selectedAgent.performance.score}/100 {selectedAgent.performance.grade}
                    </strong>
                  </div>
                )}
              </div>

              {selectedCommercial && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 12 }}>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 8 }}>商业就绪评分 v2</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                      {Object.entries(selectedCommercial.breakdown).map(([key, value]) => (
                        <div key={key} style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid rgba(148, 163, 184, 0.14)',
                        }}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{dimensionLabelMap[key as CommercialDimensionKey]}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                            {value}/{20}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>{selectedCommercial.summary}</p>
                    {selectedCommercial.improvementAreas.length > 0 && (
                      <p style={{ marginTop: 8, fontSize: 11, color: '#f59e0b' }}>
                        待提升：{selectedCommercial.improvementAreas.map((key) => dimensionLabelMap[key]).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 8 }}>商业就绪雷达图</p>
                    <CommercialReadinessRadar record={selectedCommercial} />
                  </div>
                </div>
              )}

              {selectedAgent.performance && (
                <div>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>
                    绩效维度明细 v1
                    <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 400 }}>
                      评估时间 {selectedAgent.performance.reviewedAt.slice(0, 16).replace('T', ' ')} · 评估者 {selectedAgent.performance.reviewer}
                    </span>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                    {Object.entries(selectedAgent.performance.breakdown).map(([key, value]) => (
                      <div key={key} style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.14)',
                      }}>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{key}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedAgent.performance.improvementAreas.length > 0 && (
                    <p style={{ marginTop: 8, fontSize: 11, color: '#f59e0b' }}>
                      待提升：{selectedAgent.performance.improvementAreas.join(' · ')}
                    </p>
                  )}
                </div>
              )}

              <div>
                <PerformanceSparkline points={history} loading={historyLoading} />
              </div>

              <div>
                <p className="eyebrow" style={{ marginBottom: 8 }}>人格设定</p>
                <p className="muted">{selectedAgent.persona}</p>
              </div>

              {selectedAgent.goals.length > 0 && (
                <div>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>角色目标</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedAgent.goals.map((goal, index) => (
                      <span key={index} className="metric-inline">{goal}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="eyebrow" style={{ marginBottom: 8 }}>近期任务 ({agentTasks.length})</p>
                {agentTasks.length > 0 ? (
                  <div className="stack-list compact-gap">
                    {agentTasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="stack-item" style={{ padding: 12 }}>
                        <strong style={{ fontSize: 14 }}>{task.title}</strong>
                        <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                          <span className={`status-pill ${task.status}`} style={{ padding: '2px 8px', fontSize: 11 }}>
                            {statusLabelMap[task.status]}
                          </span>
                          {' '}{task.spentToken}/{task.budgetToken} Token
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">暂无关联任务。</p>
                )}
              </div>

              <div>
                <p className="eyebrow" style={{ marginBottom: 8 }}>近期流水 ({agentLedger.length})</p>
                {agentLedger.length > 0 ? (
                  <div className="stack-list compact-gap">
                    {agentLedger.slice(0, 5).map((item) => (
                      <div key={item.id} className="stack-item" style={{ padding: 12 }}>
                        <strong style={{ fontSize: 14 }}>
                          {item.amount > 0 ? '+' : ''}{item.amount} Token
                        </strong>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                          {item.note} · {item.createdAt}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">暂无流水记录。</p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state-card timeline-empty">
              <p>点击角色卡片，查看详细信息。</p>
            </div>
          )}
        </aside>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 10, marginTop: 10 }}>
        <div className="panel" style={{ padding: 0 }}>
          <p className="eyebrow" style={{ padding: '14px 14px 0' }}>组织架构</p>
          <OrgChart />
        </div>
        <MemoryBrowser />
      </div>
    </section>
  )
}
