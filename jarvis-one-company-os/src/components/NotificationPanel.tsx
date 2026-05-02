import { useMemo, useState } from 'react'
import { useSnapshot } from '../hooks/useSnapshot'
import { getSnapshot } from '../lib/snapshotStore'

interface Notification {
  id: string
  type: 'info' | 'warning' | 'success' | 'error'
  title: string
  message: string
  time: string
  read: boolean
}

const TYPE_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  info: { icon: 'i', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)' },
  warning: { icon: '!', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
  success: { icon: 'v', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)' },
  error: { icon: 'x', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' },
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso.slice(0, 16).replace('T', ' ')
  const diffMs = Date.now() - t
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return iso.slice(0, 10)
}

function useNotifications(): Notification[] {
  useSnapshot()
  const snapshot = getSnapshot()
  const perf = snapshot.performanceSummary
  const openAudits = snapshot.auditEvents.filter((e) => e.status === 'open').length
  const pendingApprovals = snapshot.approvals.filter((a) => a.status === 'pending').length

  return useMemo(() => {
    const items: Notification[] = []

    if (perf) {
      const gradeText = (Object.entries(perf.gradeDistribution) as [string, number][])
        .filter(([, count]) => count > 0)
        .map(([g, count]) => `${count}${g}`)
        .join('')
      items.push({
        id: 'perf-latest',
        type: 'success',
        title: '绩效评估结果',
        message: `团队均分 ${perf.avgScore}${gradeText ? ` · ${gradeText}` : ''} · 领先：${perf.topPerformer || '-'}`,
        time: relativeTime(perf.reviewDate),
        read: false,
      })
    } else {
      items.push({
        id: 'perf-missing',
        type: 'info',
        title: '尚未生成绩效评估',
        message: '在 CEO 驾驶舱点击「刷新评分」可触发首次评估。',
        time: '',
        read: false,
      })
    }

    if (openAudits > 0) {
      items.push({
        id: 'audit-open',
        type: 'warning',
        title: '审计事件待处理',
        message: `当前 ${openAudits} 条 open 状态审计事件，需要跟进。`,
        time: '',
        read: false,
      })
    }

    if (pendingApprovals > 0) {
      items.push({
        id: 'approvals-pending',
        type: 'info',
        title: '待审批事项',
        message: `有 ${pendingApprovals} 条审批待 CEO 处理。`,
        time: '',
        read: false,
      })
    }

    if (items.length === 0) {
      items.push({
        id: 'all-clear',
        type: 'success',
        title: '当前无未处理事项',
        message: '审批、审计、绩效评估均已就绪。',
        time: '刚刚',
        read: true,
      })
    }

    return items
  }, [perf, openAudits, pendingApprovals])
}

export function NotificationPanel() {
  const items = useNotifications()
  const [reads, setReads] = useState<Record<string, boolean>>({})
  const [isExpanded, setIsExpanded] = useState(false)

  const notifications: Notification[] = items.map((n) => ({ ...n, read: reads[n.id] ?? n.read }))
  const unreadCount = notifications.filter((n) => !n.read).length

  function markAllRead() {
    const map: Record<string, boolean> = { ...reads }
    for (const n of notifications) map[n.id] = true
    setReads(map)
  }

  const displayList = isExpanded ? notifications : notifications.slice(0, 3)

  return (
    <div style={{
      padding: 14,
      borderRadius: 12,
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(148, 163, 184, 0.14)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p className="eyebrow" style={{ margin: 0 }}>通知中心</p>
          {unreadCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              background: 'rgba(248, 113, 113, 0.22)', color: '#fca5a5',
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: 11,
            }}
          >
            全部已读
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {displayList.map(n => {
          const style = TYPE_STYLES[n.type]
          return (
            <div key={n.id} style={{
              display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 8,
              background: n.read ? 'transparent' : style.bg,
              border: `1px solid ${n.read ? 'rgba(148, 163, 184, 0.06)' : `${style.color}20`}`,
              opacity: n.read ? 0.6 : 1,
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, flexShrink: 0,
                background: `${style.color}20`, color: style.color,
              }}>
                {style.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: n.read ? '#94a3b8' : '#e2e8f0' }}>
                    {n.title}
                  </span>
                  <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0 }}>{n.time}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  {n.message}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {notifications.length > 3 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'block', width: '100%', marginTop: 8,
            background: 'none', border: 'none', color: '#38bdf8',
            cursor: 'pointer', fontSize: 11, textAlign: 'center',
          }}
        >
          {isExpanded ? '收起' : `查看全部 (${notifications.length})`}
        </button>
      )}
    </div>
  )
}
