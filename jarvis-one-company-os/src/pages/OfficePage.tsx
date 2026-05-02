import { useEffect, useMemo, useState } from 'react'
import { fetchRuntimeStatus, type RuntimeStatusSnapshot, type RuntimeWorkstation } from '../services/runtimeStatusService'

function statusClass(value: string) {
  if (['running', 'guarding', 'connected', 'synced'].includes(value)) return 'idle'
  if (['waiting', 'building', 'planning', 'in_progress', 'manual'].includes(value)) return 'review'
  if (['blocked', 'empty', 'warning'].includes(value)) return 'frozen'
  return 'busy'
}

function workstationsFor(zoneId: string, workstations: RuntimeWorkstation[]) {
  return workstations.filter((station) => station.zone_id === zoneId)
}

export function OfficePage() {
  const [snapshot, setSnapshot] = useState<RuntimeStatusSnapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const next = await fetchRuntimeStatus()
        if (!cancelled) {
          setSnapshot(next)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '办公室状态读取失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const complaintPoint = useMemo(
    () => snapshot?.enablement_points.find((point) => point.id === 'complaint_handling'),
    [snapshot],
  )

  if (loading && !snapshot) {
    return <div className="panel" style={{ padding: 18 }}>办公室加载中...</div>
  }

  if (!snapshot) {
    return (
      <section className="panel" style={{ padding: 18 }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">办公室</p>
            <h3>状态不可用</h3>
          </div>
          <span className="status-pill frozen">离线</span>
        </div>
        <p className="muted">{error || '未读取到办公室状态'}</p>
      </section>
    )
  }

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">办公室</p>
          <h2>一人公司办公室</h2>
          <p className="muted" style={{ margin: 0 }}>把 Agent 的办公环境、任务、卡点和赋能点具象化</p>
        </div>
        <div className="hero-actions">
          <span className={`status-pill ${statusClass(snapshot.company_status)}`}>{snapshot.company_status}</span>
          {error && <span className="status-pill review">{error}</span>}
        </div>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">办公区</p>
            <h3>公司平面图</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {snapshot.office.zones.map((zone) => {
            const stations = workstationsFor(zone.id, snapshot.office.workstations)
            return (
              <article className="panel" key={zone.id} style={{ padding: 12 }}>
                <div className="panel-header panel-header-top">
                  <div>
                    <p className="eyebrow">{zone.name}</p>
                    <h3 style={{ fontSize: 15 }}>{zone.purpose}</h3>
                  </div>
                  <span className={`status-pill ${statusClass(zone.status)}`}>{zone.status}</span>
                </div>
                <div className="stack-list">
                  {stations.map((station) => (
                    <div className="stack-item" key={station.agent_id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{station.desk_name}</strong>
                        <span className={`status-pill ${statusClass(station.status)}`}>{station.status}</span>
                      </div>
                      <p>{station.agent_name} · {station.current_task}</p>
                      <p>{station.blocker || station.next_action}</p>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">工位</p>
              <h3>当前办公内容</h3>
            </div>
          </div>
          <div className="table-list">
            {snapshot.office.workstations.map((station) => (
              <div className="table-row" key={station.agent_id} style={{ gridTemplateColumns: '1fr 0.7fr 1.3fr 1.3fr' }}>
                <div>
                  <strong>{station.agent_name}</strong>
                  <p>{station.desk_name}</p>
                </div>
                <span className={`status-pill ${statusClass(station.status)}`}>{station.status}</span>
                <div>
                  <strong>{station.current_task}</strong>
                  <p>{station.last_action}</p>
                </div>
                <div>
                  <strong>{station.next_action}</strong>
                  <p>{station.blocker || (station.needs_ceo_review ? '需要 CEO 审批' : '无卡点')}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">作息节奏</p>
              <h3>自主运营节拍</h3>
            </div>
          </div>
          <div className="stack-list">
            {snapshot.office.daily_rhythm.map((item) => (
              <div className="stack-item" key={`${item.time}-${item.name}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{item.time} · {item.name}</strong>
                  <span className="status-pill busy">{item.owner}</span>
                </div>
                <p>{item.output}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">赋能点</p>
              <h3>待优化和商业化补强</h3>
            </div>
          </div>
          <div className="stack-list">
            {snapshot.enablement_points.map((point) => (
              <div className="stack-item" key={point.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{point.name}</strong>
                  <span className={`status-pill ${statusClass(point.status)}`}>{point.owner}</span>
                </div>
                <p>{point.next_action}</p>
                <p>{point.evidence}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">客诉机制</p>
              <h3>客户问题流转</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <strong>入口</strong>
              <p>评论、私信、微信、交付反馈统一进入多比 CRO。</p>
            </div>
            <div className="stack-item">
              <strong>升级</strong>
              <p>严重问题进入斯内普 CAO；退款、补款、确认到账进入珀西 CFO。</p>
            </div>
            <div className="stack-item">
              <strong>当前状态</strong>
              <p>{complaintPoint?.next_action ?? '先建立流程，再接入真实客诉记录'}</p>
            </div>
          </div>
        </article>
      </section>
    </>
  )
}
