import { useEffect, useState } from 'react'
import { MagicActivityLog } from '../components/magic-office/MagicActivityLog'
import { MagicAgentPanel } from '../components/magic-office/MagicAgentPanel'
import { MagicOfficeStage } from '../components/magic-office/MagicOfficeStage'
import { MagicSceneValuePanel } from '../components/magic-office/MagicSceneValuePanel'
import { fetchRuntimeStatus, type RuntimeMagicCharacter, type RuntimeStatusSnapshot } from '../services/runtimeStatusService'

export function MagicOfficePage() {
  const [snapshot, setSnapshot] = useState<RuntimeStatusSnapshot | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<RuntimeMagicCharacter | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const next = await fetchRuntimeStatus()
        if (!cancelled) {
          setSnapshot(next)
          setSelectedAgent((current) => {
            if (!current) return null
            return next.magic_office.characters.find((item) => item.agent_id === current.agent_id) ?? null
          })
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '魔法办公室读取失败')
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

  if (loading && !snapshot) {
    return <div className="panel magic-loading-panel">魔法办公室加载中...</div>
  }

  if (!snapshot) {
    return (
      <section className="panel magic-loading-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">魔法办公室</p>
            <h3>场景不可用</h3>
          </div>
          <span className="status-pill frozen">离线</span>
        </div>
        <p className="muted">{error || '未读取到魔法办公室状态'}</p>
      </section>
    )
  }

  const office = snapshot.magic_office

  return (
    <>
      <section className="hero-panel magic-hero-panel">
        <div>
          <p className="eyebrow">魔法办公室</p>
          <h2>一人公司动态魔法办公室</h2>
          <p className="muted">
            Agent 会按运行状态进入房间、发出气泡，并把任务、审批和风控状态可视化。
          </p>
        </div>
        <div className="hero-actions">
          <span className="status-pill idle">{snapshot.company_status}</span>
          <span className="status-pill review">{office.theme}</span>
          {error && <span className="status-pill review">{error}</span>}
        </div>
      </section>

      <section className="magic-office-layout">
        <article className="panel magic-stage-panel">
          <div className="panel-header panel-header-top">
            <div>
              <p className="eyebrow">原创魔法公司</p>
              <h3>实时办公场景 · 星图作战大厅</h3>
            </div>
            <span className="metric-inline">Agent {office.characters.length}</span>
          </div>

          <MagicOfficeStage
            office={office}
            selectedAgentId={selectedAgent?.agent_id}
            onSelectAgent={setSelectedAgent}
          />
          {/* MagicOfficeStage renders each moving Agent with the legacy-compatible agent-sprite class and action_state-driven motion. */}
        </article>

        <MagicAgentPanel
          selectedAgent={selectedAgent}
          rooms={office.rooms}
          safeNote={office.commercial_safe_note}
        />
      </section>

      <section className="magic-office-bottom-grid">
        <MagicActivityLog items={office.activity_log} />
        <MagicSceneValuePanel safeNote={office.commercial_safe_note} theme={office.theme} />
      </section>
    </>
  )
}
