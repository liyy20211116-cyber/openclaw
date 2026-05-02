import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import type { AgentCommercialReadiness } from '../types'

const LABELS: Record<keyof AgentCommercialReadiness['dimensionPercentages'], string> = {
  autonomy: '自主运行',
  revenue_contribution: '自主盈利',
  intelligence: '聪明大脑',
  execution: '灵活手脚',
  productization: '可商业化',
}

export function CommercialReadinessRadar({ record }: { record: AgentCommercialReadiness }) {
  const data = Object.entries(record.dimensionPercentages).map(([key, value]) => ({
    dimension: LABELS[key as keyof AgentCommercialReadiness['dimensionPercentages']],
    score: value,
  }))

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(148,163,184,0.18)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Radar
            name="商业就绪"
            dataKey="score"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.28}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
