import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useSnapshot } from '../hooks/useSnapshot'
import { agentService } from '../services/agentService'
import { fetchLatestPerformance, refreshPerformance, gradeColor } from '../services/performanceService'
import type { PerformanceGrade } from '../types'

interface AgentScore {
  name: string
  score: number
  grade: PerformanceGrade
}

export function AgentPerformanceChart({ agents }: { agents?: AgentScore[] }) {
  useSnapshot()
  const snapshotAgents = agentService.getAll()
  const [refreshing, setRefreshing] = useState(false)
  const [lastReviewDate, setLastReviewDate] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const dataFromSnapshot: AgentScore[] = snapshotAgents
    .filter((agent) => agent.performance != null && agent.id !== 'ceo')
    .map((agent) => ({
      name: agent.name,
      score: agent.performance!.score,
      grade: agent.performance!.grade,
    }))

  const data = (agents ?? dataFromSnapshot).slice().sort((a, b) => b.score - a.score)

  useEffect(() => {
    let cancelled = false
    fetchLatestPerformance().then((report) => {
      if (cancelled) return
      if (report.hasReport && report.reviewDate) {
        setLastReviewDate(report.reviewDate)
      }
    })
    return () => { cancelled = true }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setFeedback(null)
    const result = await refreshPerformance()
    setRefreshing(false)
    if (!result.ok) {
      setFeedback(`刷新失败：${result.error ?? '未知错误'}`)
      return
    }
    setLastReviewDate(result.reviewDate ?? new Date().toISOString())
    setFeedback(`已刷新，均分 ${result.avgScore ?? '-'}`)
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {lastReviewDate
            ? `上次评估：${lastReviewDate.slice(0, 16).replace('T', ' ')}`
            : '尚无评估记录，点击右侧按钮生成'}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            borderRadius: 6,
            border: '1px solid rgba(148,163,184,0.3)',
            background: refreshing ? 'rgba(148,163,184,0.2)' : 'rgba(56,189,248,0.1)',
            color: refreshing ? '#94a3b8' : '#38bdf8',
            cursor: refreshing ? 'not-allowed' : 'pointer',
          }}
        >
          {refreshing ? '评估中…' : '刷新评分'}
        </button>
      </div>
      {feedback && (
        <div style={{ fontSize: 11, color: feedback.startsWith('刷新失败') ? '#ef4444' : '#22c55e', marginBottom: 6 }}>
          {feedback}
        </div>
      )}
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          {data.length === 0 ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12 }}>
              暂无真实评分数据，请点击上方「刷新评分」触发一次评估。
            </div>
          ) : (
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
                formatter={((value: unknown, _name: unknown, props: { payload?: AgentScore }) => [
                  `${value}/100 (${props.payload?.grade ?? '-'})`,
                  '绩效',
                ]) as never}
              />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={gradeColor(entry.grade)} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
