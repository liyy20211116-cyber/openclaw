import { useState } from 'react'

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

const DEFAULT_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'success', title: 'Agent 团队就绪', message: '10 个 Agent 全部配置完成，健康度 88.2/100', time: '刚刚', read: false },
  { id: '2', type: 'warning', title: '安全扫描发现', message: '2 处密钥泄露风险需要处理', time: '15分钟前', read: false },
  { id: '3', type: 'info', title: '纳威入职', message: '人资部 CHRO 纳威·隆巴顿已完成入职配置', time: '30分钟前', read: false },
  { id: '4', type: 'success', title: '绩效评估完成', message: '首次全员绩效评估：团队均分 74.3，6A4B', time: '1小时前', read: true },
  { id: '5', type: 'info', title: '服务目录就绪', message: '4 个标准服务包已创建，年潜力 CNY 312K', time: '2小时前', read: true },
]

export function NotificationPanel() {
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS)
  const [isExpanded, setIsExpanded] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
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
