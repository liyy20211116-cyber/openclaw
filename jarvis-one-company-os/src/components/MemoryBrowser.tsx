import { useState } from 'react'

interface MemoryEntry {
  agentId: string
  agentName: string
  emoji: string
  learningsCount: number
  lastUpdated: string
  health: string
  topLearning: string
}

const MEMORY_DATA: MemoryEntry[] = [
  { agentId: 'jarvis-coo', agentName: '贾维斯', emoji: '🎯', learningsCount: 27, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Agent执行能力受限于平台工具挂载，非逻辑问题' },
  { agentId: 'hermione-tech', agentName: '赫敏', emoji: '📚', learningsCount: 1, lastUpdated: '2026-04-10', health: 'healthy', topLearning: 'ONES UI自动化使用Playwright+CDP直连方案' },
  { agentId: 'mcgonagall-product', agentName: '麦格', emoji: '🐱', learningsCount: 1, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Memory system initialized' },
  { agentId: 'luna-growth', agentName: '卢娜', emoji: '🌙', learningsCount: 1, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Memory system initialized' },
  { agentId: 'fred-sales', agentName: '弗雷德', emoji: '🎪', learningsCount: 1, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Memory system initialized' },
  { agentId: 'percy-finance', agentName: '珀西', emoji: '📊', learningsCount: 1, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Memory system initialized' },
  { agentId: 'snape-audit', agentName: '斯内普', emoji: '🦇', learningsCount: 1, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Memory system initialized' },
  { agentId: 'dobby-customer', agentName: '多比', emoji: '🧦', learningsCount: 1, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Memory system initialized' },
  { agentId: 'neville-hr', agentName: '纳威', emoji: '🌱', learningsCount: 1, lastUpdated: '2026-04-11', health: 'healthy', topLearning: 'Neville joins as CHRO' },
]

const HEALTH_STYLES: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Active', color: '#22c55e' },
  stale: { label: 'Stale', color: '#f59e0b' },
  empty: { label: 'Empty', color: '#64748b' },
}

export function MemoryBrowser() {
  const [expanded, setExpanded] = useState<string>('')

  const totalLearnings = MEMORY_DATA.reduce((sum, m) => sum + m.learningsCount, 0)

  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(148, 163, 184, 0.14)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Agent 记忆浏览器</p>
        <span style={{ fontSize: 11, color: '#64748b' }}>共 {totalLearnings} 条记忆</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {MEMORY_DATA.map(m => {
          const hs = HEALTH_STYLES[m.health] ?? HEALTH_STYLES.empty
          const isExpanded = expanded === m.agentId

          return (
            <div key={m.agentId}>
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? '' : m.agentId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '6px 10px', borderRadius: 8,
                  background: isExpanded ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                  border: `1px solid ${isExpanded ? 'rgba(56, 189, 248, 0.15)' : 'transparent'}`,
                  cursor: 'pointer', color: '#e2e8f0', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 16 }}>{m.emoji}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{m.agentName}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{m.learningsCount}</span>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: hs.color, flexShrink: 0,
                }} />
              </button>

              {isExpanded && (
                <div style={{
                  marginTop: 4, marginLeft: 28, padding: '8px 10px',
                  borderRadius: 8, background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(148, 163, 184, 0.08)',
                  fontSize: 11, color: '#94a3b8', lineHeight: 1.5,
                }}>
                  <div><strong style={{ color: '#cbd5e1' }}>Latest:</strong> {m.topLearning}</div>
                  <div style={{ marginTop: 4 }}>
                    <strong style={{ color: '#cbd5e1' }}>Updated:</strong> {m.lastUpdated}
                    <span style={{ marginLeft: 8, color: hs.color }}>{hs.label}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
