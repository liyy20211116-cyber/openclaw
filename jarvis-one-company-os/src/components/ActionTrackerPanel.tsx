import { useEffect, useState } from 'react'
import type { ActiveAction } from './StickyWorkBar'

function AgentTimer({ startedAt }: { startedAt: number }) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSec(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  return (
    <span style={{
      fontSize: 10, color: '#64748b', fontVariantNumeric: 'tabular-nums',
      flexShrink: 0, minWidth: 24, textAlign: 'right',
    }}>
      {sec}s
    </span>
  )
}

export function ActionTrackerPanel({ actions, onDismiss }: { actions: ActiveAction[]; onDismiss: (id: string) => void }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const activeCount = actions.filter(a => a.status === 'working' || a.status === 'waiting').length
  const doneCount = actions.filter(a => a.status === 'done').length
  const failedCount = actions.filter(a => a.status === 'failed').length
  const anyActive = activeCount > 0
  const firstActive = actions.find(a => a.status === 'working' || a.status === 'waiting')

  useEffect(() => {
    if (!anyActive) return
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (firstActive?.startedAt ?? Date.now())) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [anyActive, firstActive?.startedAt])

  useEffect(() => {
    actions.forEach(a => {
      if (a.status === 'failed') {
        setExpandedIds(prev => new Set([...prev, a.id]))
      }
    })
  }, [actions])

  if (actions.length === 0) return null

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const statusIcon = (status: ActiveAction['status']) => {
    switch (status) {
      case 'working': return '⚡'
      case 'waiting': return '⏳'
      case 'done': return '✅'
      case 'failed': return '❌'
    }
  }
  const statusColor = (status: ActiveAction['status']) => {
    switch (status) {
      case 'working': return '#38bdf8'
      case 'waiting': return '#f59e0b'
      case 'done': return '#22c55e'
      case 'failed': return '#ef4444'
    }
  }

  const progressPct = actions.length > 0 ? Math.round(((doneCount + failedCount) / actions.length) * 100) : 0

  return (
    <div style={{
      borderRadius: 14,
      background: 'rgba(15, 23, 42, 0.7)',
      border: `1px solid ${failedCount > 0 ? 'rgba(239, 68, 68, 0.3)' : anyActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
      overflow: 'hidden',
      animation: 'fadeIn 0.3s ease-in',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', cursor: 'pointer',
          background: anyActive ? 'rgba(56, 189, 248, 0.06)' : failedCount > 0 ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.06)',
        }}
        onClick={() => setPanelCollapsed(p => !p)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {anyActive && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#38bdf8',
              display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite',
              boxShadow: '0 0 6px rgba(56, 189, 248, 0.6)',
            }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: anyActive ? '#38bdf8' : failedCount > 0 ? '#ef4444' : '#22c55e' }}>
            {anyActive ? `⚡ ${activeCount} 个部门执行中` : failedCount > 0 ? `❌ ${failedCount} 个异常` : `✅ ${doneCount} 个部门已完成`}
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {doneCount}/{actions.length} 完成{anyActive ? ` · ${elapsed}s` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`, height: '100%', borderRadius: 2,
              background: failedCount > 0 ? '#ef4444' : '#22c55e',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#64748b', transform: panelCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {!panelCollapsed && (
        <div style={{ padding: '4px 6px 6px' }}>
          {actions.map(action => {
            const isExpanded = expandedIds.has(action.id)
            const isFailed = action.status === 'failed'
            const color = statusColor(action.status)
            const briefResult = action.skillResult ? action.skillResult.slice(0, 80) + (action.skillResult.length > 80 ? '...' : '') : ''

            return (
              <div key={action.id} style={{
                margin: '3px 0', borderRadius: 10, overflow: 'hidden',
                background: isFailed ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                border: isFailed ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid transparent',
              }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', cursor: 'pointer', borderRadius: 8,
                    transition: 'background 0.15s',
                  }}
                  onClick={() => toggleExpand(action.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148, 163, 184, 0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = isFailed ? 'rgba(239, 68, 68, 0.05)' : 'transparent')}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{statusIcon(action.status)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color, flexShrink: 0, minWidth: 36 }}>
                    {action.assignee || '贾维斯'}
                  </span>
                  <span style={{
                    fontSize: 11, color: '#94a3b8', flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {briefResult || action.summary}
                  </span>
                  {action.status === 'working' && (
                    <AgentTimer startedAt={action.startedAt} />
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDismiss(action.id) }}
                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11, padding: '2px 4px', flexShrink: 0 }}
                    title="关闭"
                  >×</button>
                </div>

                {isExpanded && (
                  <div style={{ padding: '4px 10px 10px 36px', animation: 'fadeIn 0.2s ease-in' }}>
                    {action.steps.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {action.steps.map((step, i) => (
                          <span key={i} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 999,
                            background: step.done ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.08)',
                            color: step.done ? '#22c55e' : '#64748b',
                            border: `1px solid ${step.done ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.1)'}`,
                          }}>
                            {step.done ? '✓' : '○'} {step.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {action.skillResult && (
                      <div style={{
                        padding: '6px 10px', borderRadius: 8,
                        background: isFailed ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.04)',
                        border: `1px solid ${isFailed ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.1)'}`,
                        fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                        maxHeight: 150, overflow: 'auto',
                      }}>
                        {action.skillResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
