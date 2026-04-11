import { useState } from 'react'

interface OrgNode {
  id: string
  name: string
  role: string
  emoji: string
  score?: number
  grade?: string
  children?: OrgNode[]
}

const ORG_DATA: OrgNode = {
  id: 'ceo',
  name: 'CEO (李原野)',
  role: '创始人',
  emoji: '👤',
  children: [
    {
      id: 'jarvis',
      name: '贾维斯',
      role: 'COO',
      emoji: '🎯',
      score: 88,
      grade: 'A',
      children: [
        { id: 'hermione', name: '赫敏', role: 'CTO', emoji: '📚', score: 80, grade: 'A' },
        { id: 'mcgonagall', name: '麦格', role: 'CPO', emoji: '🐱', score: 75, grade: 'A' },
        { id: 'luna', name: '卢娜', role: 'CGO', emoji: '🌙', score: 75, grade: 'A' },
        { id: 'fred', name: '弗雷德', role: 'Sales', emoji: '🎪', score: 70, grade: 'B' },
        { id: 'percy', name: '珀西', role: 'CFO', emoji: '📊', score: 75, grade: 'A' },
        { id: 'snape', name: '斯内普', role: 'Audit', emoji: '🦇', score: 75, grade: 'A' },
        { id: 'dobby', name: '多比', role: 'CS', emoji: '🧦', score: 70, grade: 'B' },
        { id: 'neville', name: '纳威', role: 'CHRO', emoji: '🌱', score: 70, grade: 'B' },
      ],
    },
  ],
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
  const ceo = ORG_DATA
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
