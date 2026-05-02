import { useState, useEffect } from 'react'
import { loadAppConfig, type AgentConfig, getCeoName } from '../services/configService'

interface OrgNode {
  id: string
  name: string
  role: string
  emoji: string
  score?: number
  grade?: string
  children?: OrgNode[]
}

const AGENT_EMOJIS: Record<string, string> = {
  'jarvis-coo': '🎯', 'hermione-tech': '📚', 'mcgonagall-product': '🐱',
  'luna-growth': '🌙', 'fred-sales': '🎪', 'percy-finance': '📊',
  'snape-audit': '🦇', 'dobby-customer': '🧦', 'neville-hr': '🌱',
}

function buildOrgData(agents: AgentConfig[], ceoName: string): OrgNode {
  const coo = agents.find(a => a.role === 'COO') ?? agents[0]
  const others = agents.filter(a => a.id !== coo?.id)

  return {
    id: 'ceo',
    name: `CEO (${ceoName})`,
    role: '创始人',
    emoji: '👤',
    children: coo ? [{
      id: coo.id.split('-')[0],
      name: coo.display_name,
      role: coo.role,
      emoji: AGENT_EMOJIS[coo.id] ?? '🎯',
      score: 88,
      grade: 'A',
      children: others.filter(a => a.enabled).map(a => ({
        id: a.id.split('-')[0],
        name: a.display_name,
        role: a.role,
        emoji: AGENT_EMOJIS[a.id] ?? '🤖',
        score: 75,
        grade: 'A',
      })),
    }] : [],
  }
}

const FALLBACK_ORG: OrgNode = {
  id: 'ceo', name: 'CEO', role: '创始人', emoji: '👤',
  children: [{ id: 'jarvis', name: 'Jarvis', role: 'COO', emoji: '🎯', children: [] }],
}

const GRADE_COLORS: Record<string, string> = {
  S: '#a78bfa', A: '#22c55e', B: '#38bdf8', C: '#f59e0b', D: '#ef4444',
}

function OrgNodeCard({ node, onSelect }: { node: OrgNode; onSelect: (id: string) => void }) {
  const gradeColor = node.grade ? GRADE_COLORS[node.grade] ?? '#64748b' : '#94a3b8'

  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(15, 23, 42, 0.7)',
        border: `1px solid ${gradeColor}40`,
        cursor: 'pointer', color: '#e2e8f0',
        minWidth: 120, textAlign: 'left',
        transition: 'border-color 0.2s, transform 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = gradeColor; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${gradeColor}40`; e.currentTarget.style.transform = 'none' }}
    >
      <span style={{ fontSize: 20 }}>{node.emoji}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{node.name}</div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {node.role}
          {node.score != null && (
            <span style={{ color: gradeColor, fontWeight: 700, marginLeft: 6 }}>
              {node.score} {node.grade}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export function OrgChart() {
  const [selected, setSelected] = useState<string>('')
  const [orgData, setOrgData] = useState<OrgNode>(FALLBACK_ORG)

  useEffect(() => {
    loadAppConfig().then(cfg => {
      if (cfg.agents?.length) {
        setOrgData(buildOrgData(cfg.agents, getCeoName(cfg)))
      }
    })
  }, [])

  const ceo = orgData
  const coo = ceo.children?.[0]
  const departments = coo?.children ?? []

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <OrgNodeCard node={ceo} onSelect={setSelected} />

        <div style={{ width: 1, height: 20, background: 'rgba(148, 163, 184, 0.2)' }} />

        {coo && <OrgNodeCard node={coo} onSelect={setSelected} />}

        <div style={{ width: 1, height: 20, background: 'rgba(148, 163, 184, 0.2)' }} />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 8, width: '100%',
        }}>
          {departments.map(dept => (
            <OrgNodeCard key={dept.id} node={dept} onSelect={setSelected} />
          ))}
        </div>
      </div>

      {selected && (
        <div style={{
          marginTop: 12, padding: 10, borderRadius: 8,
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.15)',
          fontSize: 11, color: '#94a3b8',
        }}>
          Selected: {selected} - Click agent cards for details in the Agents page.
        </div>
      )}
    </div>
  )
}
