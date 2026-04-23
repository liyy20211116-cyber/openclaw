import type { PerformanceHistoryPoint } from '../types'
import { gradeColor, scoreColor } from '../services/performanceService'

interface Props {
  points: PerformanceHistoryPoint[]
  width?: number
  height?: number
  loading?: boolean
}

export function PerformanceSparkline({ points, width = 280, height = 70, loading = false }: Props) {
  if (loading) {
    return (
      <div style={{ fontSize: 11, color: '#64748b', padding: '12px 0' }}>加载历史曲线…</div>
    )
  }

  if (points.length === 0) {
    return (
      <div style={{ fontSize: 11, color: '#64748b', padding: '12px 0' }}>
        暂无历史评估。点击「刷新评分」生成第 1 条记录。
      </div>
    )
  }

  const padding = 6
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0
  const maxScore = 100
  const minScore = 0

  const coords = points.map((p, idx) => {
    const x = padding + idx * xStep
    const ratio = (p.score - minScore) / Math.max(1, maxScore - minScore)
    const y = padding + innerH - ratio * innerH
    return { x, y, point: p }
  })

  const pathD = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ')

  const areaD = `${pathD} L${coords[coords.length - 1].x.toFixed(2)},${padding + innerH} L${coords[0].x.toFixed(2)},${padding + innerH} Z`

  const last = points[points.length - 1]
  const first = points[0]
  const delta = Number((last.score - first.score).toFixed(1))
  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`
  const deltaColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#94a3b8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
        <span>历史评分曲线（最近 {points.length} 次）</span>
        {points.length >= 2 && (
          <span style={{ color: deltaColor, fontWeight: 600 }}>Δ {deltaLabel}</span>
        )}
      </div>
      <svg width={width} height={height} style={{ display: 'block', background: 'rgba(15, 23, 42, 0.35)', borderRadius: 6, border: '1px solid rgba(148, 163, 184, 0.14)' }}>
        <defs>
          <linearGradient id="sparklineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={scoreColor(last.score)} stopOpacity={0.35} />
            <stop offset="100%" stopColor={scoreColor(last.score)} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={padding}
            x2={width - padding}
            y1={padding + innerH * r}
            y2={padding + innerH * r}
            stroke="rgba(148, 163, 184, 0.08)"
            strokeDasharray="2 3"
          />
        ))}
        {points.length >= 2 && <path d={areaD} fill="url(#sparklineFill)" />}
        {points.length >= 2 ? (
          <path d={pathD} fill="none" stroke={scoreColor(last.score)} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {coords.map((c) => (
          <circle
            key={c.point.id}
            cx={c.x}
            cy={c.y}
            r={2.8}
            fill={gradeColor(c.point.grade)}
            stroke="rgba(15, 23, 42, 0.6)"
            strokeWidth={1}
          >
            <title>{`${c.point.reviewedAt.slice(0, 16).replace('T', ' ')} · ${c.point.score} (${c.point.grade}) · ${c.point.version}`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
        <span>{first.reviewedAt.slice(0, 10)}</span>
        <span>最新 {last.score.toFixed(1)} / {last.grade}</span>
      </div>
    </div>
  )
}
