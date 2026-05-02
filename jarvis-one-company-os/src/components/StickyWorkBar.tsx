import { useEffect, useState } from 'react'

export interface WorkStatus {
  phase: string
  detail: string
  startTime: number
  icon: string
  step?: number
  totalSteps?: number
}

export interface ActiveAction {
  id: string
  summary: string
  assignee: string
  status: 'working' | 'waiting' | 'done' | 'failed'
  steps: { label: string; done: boolean }[]
  startedAt: number
  updatedAt: number
  skillId?: string
  skillResult?: string
}

const WORK_PHASES = [
  { key: 'connect', label: '连接大脑', icon: '🧠', est: 2 },
  { key: 'think', label: '贾维斯思考中', icon: '💭', est: 8 },
  { key: 'reply', label: '组织回复', icon: '✍️', est: 3 },
  { key: 'dispatch', label: '派发任务', icon: '🚀', est: 2 },
  { key: 'execute', label: '各部门执行', icon: '⚡', est: 30 },
  { key: 'analyze', label: '分析结果', icon: '📋', est: 5 },
  { key: 'memory', label: '记忆沉淀', icon: '📝', est: 2 },
]

export function StickyWorkBar({ status, activeActions }: { status: WorkStatus | null; activeActions: ActiveAction[] }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!status) return
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - status.startTime) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  const working = activeActions.filter(a => a.status === 'working' || a.status === 'waiting')
  const done = activeActions.filter(a => a.status === 'done' || a.status === 'failed')

  if (!status && working.length === 0) return null

  const step = status?.step ?? 0
  const totalSteps = status?.totalSteps ?? WORK_PHASES.length
  const phasePct = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0
  const agentPct = activeActions.length > 0 ? Math.round((done.length / activeActions.length) * 100) : 0
  const overallPct = activeActions.length > 0 ? Math.round((phasePct + agentPct) / 2) : phasePct

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 14px',
      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.06), rgba(139, 92, 246, 0.06))',
      borderTop: '1px solid rgba(56, 189, 248, 0.15)',
      minHeight: 38,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: '#38bdf8',
        display: 'inline-block',
        animation: 'pulse 1.2s ease-in-out infinite',
        boxShadow: '0 0 6px rgba(56, 189, 248, 0.6)',
        flexShrink: 0,
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>{status?.icon ?? '⚡'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8' }}>
            {status?.phase ?? `${working.length} 个部门执行中`}
          </span>
          {status?.detail && (
            <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {status.detail}
            </span>
          )}
        </div>
        {totalSteps > 1 && (
          <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 2, borderRadius: 1,
                background: i < step ? '#38bdf8' : i === step ? 'rgba(56, 189, 248, 0.5)' : 'rgba(148, 163, 184, 0.15)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        )}
      </div>

      {activeActions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {activeActions.slice(0, 6).map(a => (
              <span key={a.id} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: a.status === 'done' ? '#22c55e' : a.status === 'failed' ? '#ef4444' : '#38bdf8',
                display: 'inline-block',
                animation: a.status === 'working' ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }} title={`${a.assignee}: ${a.status}`} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            {done.length}/{activeActions.length}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>
          {elapsed}s
        </span>
        <div style={{ width: 36, height: 36, position: 'relative' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(148, 163, 184, 0.1)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#38bdf8" strokeWidth="3"
              strokeDasharray={`${overallPct * 0.942} 100`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </svg>
          <span style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            fontSize: 9, fontWeight: 700, color: '#38bdf8',
          }}>
            {overallPct}%
          </span>
        </div>
      </div>
    </div>
  )
}
