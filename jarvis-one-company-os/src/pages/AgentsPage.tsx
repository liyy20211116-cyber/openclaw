import { useMemo, useState } from 'react'
import { statusLabelMap } from '../app/status'
import { useSnapshot } from '../hooks/useSnapshot'
import { agentService } from '../services/agentService'
import { ledgerService } from '../services/ledgerService'
import { taskService } from '../services/taskService'

export function AgentsPage() {
  useSnapshot()
  const agents = agentService.getAll()
  const tasks = taskService.getAll()
  const ledger = ledgerService.getAll()
  const [selectedAgentId, setSelectedAgentId] = useState('')

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
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
    </section>
  )
}
