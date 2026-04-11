import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface AgentScore {
  name: string
  score: number
  grade: string
}

const GRADE_COLORS: Record<string, string> = {
  S: '#a78bfa',
  A: '#22c55e',
  B: '#38bdf8',
  C: '#f59e0b',
  D: '#ef4444',
}

const DEFAULT_AGENTS: AgentScore[] = [
  { name: '贾维斯', score: 88, grade: 'A' },
  { name: '赫敏', score: 80, grade: 'A' },
  { name: '麦格', score: 75, grade: 'A' },
  { name: '卢娜', score: 75, grade: 'A' },
  { name: '珀西', score: 75, grade: 'A' },
  { name: '斯内普', score: 75, grade: 'A' },
  { name: '纳威', score: 70, grade: 'B' },
  { name: '多比', score: 70, grade: 'B' },
  { name: '弗雷德', score: 70, grade: 'B' },
  { name: '需求审核', score: 65, grade: 'B' },
]

export function AgentPerformanceChart({ agents = DEFAULT_AGENTS }: { agents?: AgentScore[] }) {
  const data = agents.sort((a, b) => b.score - a.score)

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 12,
            }}
            formatter={(value: number, _name: string, props: any) => [
              `${value}/100 (${props.payload.grade})`,
              '绩效'
            ]}
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry, i) => (
              <Cell key={i} fill={GRADE_COLORS[entry.grade] ?? '#64748b'} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
