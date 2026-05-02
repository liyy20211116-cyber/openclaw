import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { dailyRunService } from '../services/dailyRunService'
import { fetchRuntimeStatus, type RuntimeStatusSnapshot } from '../services/runtimeStatusService'

function formatNumber(value: number | undefined) {
  return Number(value ?? 0).toLocaleString()
}

function statusClass(value: string) {
  if (['ready', 'online', 'mapped', 'configured', 'tracked', 'standby'].includes(value)) return 'idle'
  if (['degraded', 'skills_only', 'waiting_ceo', 'waiting_source'].includes(value)) return 'review'
  if (['not_configured', 'needs_skill_file', 'offline', 'failed', 'failed_interrupted_or_crashed'].includes(value)) return 'frozen'
  if (['connected', 'synced', 'running', 'normal', 'ok', '营业中'].includes(value)) return 'idle'
  if (['pending_connection', 'manual', 'waiting', 'planning', 'info'].includes(value)) return 'review'
  if (['blocked', 'warning', 'needs_connection'].includes(value)) return 'frozen'
  return 'busy'
}

function sourceLabel(value: string) {
  const labels: Record<string, string> = {
    synced: '真实同步',
    pending_connection: '待接入',
    manual: '人工录入',
    connected: '已连接',
    manual_confirm_first: '人工确认',
  }
  return labels[value] ?? value
}

function postStatusLabel(value: string) {
  const labels: Record<string, string> = {
    published: '已发布',
    draft: '草稿',
    rejected_interaction_bait: '已下架/违规',
    unknown: '未知',
  }
  return labels[value] ?? value
}

export function RuntimePage() {
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
        if (!cancelled) setError(err instanceof Error ? err.message : '运行状态读取失败')
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

  const safetyRows = useMemo(() => {
    if (!snapshot) return []
    return [
      ['自动发布', snapshot.safety.allow_publish],
      ['自动评论', snapshot.safety.allow_comment_reply],
      ['自动私信', snapshot.safety.allow_private_message],
      ['无收款写收入', snapshot.safety.allow_revenue_write_without_payment],
      ['只读补数', Boolean(snapshot.safety.allow_readonly_metric_catchup)],
    ] as const
  }, [snapshot])

  if (loading && !snapshot) {
    return <div className="panel" style={{ padding: 18 }}>运行状态加载中...</div>
  }

  if (!snapshot) {
    return (
      <section className="panel" style={{ padding: 18 }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">运行中心</p>
            <h3>状态不可用</h3>
          </div>
          <span className="status-pill frozen">离线</span>
        </div>
        <p className="muted">{error || '未读取到运行状态快照'}</p>
      </section>
    )
  }

  const metrics = snapshot.company_metrics
  const contentPosts = snapshot.content_posts ?? []
  const latestDailyRunLog = dailyRunService.getLatestDailyRunLog()

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">运行中心</p>
          <h2>一人公司运行状态</h2>
          <p className="muted" style={{ margin: 0 }}>最近更新：{snapshot.generated_at}</p>
        </div>
        <div className="hero-actions">
          <span className={`status-pill ${statusClass(snapshot.company_status)}`}>{snapshot.company_status}</span>
          <Link to="/daily-run" className="link-button">每日运营</Link>
          {error && <span className="status-pill review">{error}</span>}
        </div>
      </section>

      <section className="metrics-grid metrics-grid-6">
        <article className="metric-card">
          <span>总曝光</span>
          <strong>{formatNumber(metrics.total_views)}</strong>
          <p>{metrics.connected_platforms}/{metrics.active_platforms} 平台接通</p>
        </article>
        <article className="metric-card">
          <span>总互动</span>
          <strong>{formatNumber(metrics.total_interactions)}</strong>
          <p>评论 {formatNumber(metrics.public_comments)}</p>
        </article>
        <article className={metrics.qualified_leads > 0 ? 'metric-card' : 'metric-card warning'}>
          <span>有效线索</span>
          <strong>{formatNumber(metrics.qualified_leads)}</strong>
          <p>私信 {formatNumber(metrics.private_messages)}</p>
        </article>
        <article className={metrics.pending_replies > 0 ? 'metric-card warning' : 'metric-card'}>
          <span>待回复</span>
          <strong>{formatNumber(metrics.pending_replies)}</strong>
          <p>只生成建议，人工确认</p>
        </article>
        <article className="metric-card">
          <span>健康守护</span>
          <strong>{snapshot.guardian.state}</strong>
          <p>结果 {snapshot.guardian.last_result}</p>
        </article>
        <article className="metric-card">
          <span>防卡死</span>
          <strong>{Math.round(snapshot.guardian.runtime_seconds ?? 0)}s</strong>
          <p>{snapshot.guardian.mode}</p>
        </article>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header panel-header-top">
          <div>
            <p className="eyebrow">Daily Run Snapshot</p>
            <h3>每日运营日志</h3>
          </div>
          <Link to="/daily-run" className="link-button">查看每日运营日志</Link>
        </div>
        {latestDailyRunLog ? (
          <div className="sales-card-metrics">
            <span className="metric-inline">最新快照：{latestDailyRunLog.generatedAt}</span>
            <span className={`status-pill ${latestDailyRunLog.healthStatus === 'blocked' ? 'frozen' : latestDailyRunLog.healthStatus === 'attention' ? 'review' : 'idle'}`}>
              {latestDailyRunLog.healthStatus}
            </span>
            <span className="metric-inline">完成率：{latestDailyRunLog.completionRate}%</span>
            <span className="metric-inline">待审批：{latestDailyRunLog.approvalSummary.pendingApprovals}</span>
          </div>
        ) : (
          <p className="muted">暂无 Daily Run 快照。进入每日运营页手动生成今日运营快照。</p>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 10 }}>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header panel-header-top">
            <div>
              <p className="eyebrow">模型健康</p>
              <h3>路由与可用模型</h3>
            </div>
            <span className={`status-pill ${statusClass(snapshot.model_health.status)}`}>{snapshot.model_health.status}</span>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <strong>{snapshot.model_health.default_model || '未配置默认模型'}</strong>
              <p>{snapshot.model_health.default_provider || '未配置默认供应商'}</p>
            </div>
            {snapshot.model_health.models.map((model) => (
              <div className="stack-item" key={`${model.provider}-${model.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <strong>{model.alias || model.name}</strong>
                  <p>{model.provider} / {model.id}</p>
                </div>
                <span className={`status-pill ${statusClass(model.status)}`}>{model.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header panel-header-top">
            <div>
              <p className="eyebrow">全公司作战队列</p>
              <h3>每个角色都要动起来</h3>
            </div>
            <span className="metric-inline">{snapshot.company_work_queue.length} 项工作</span>
          </div>
          <div className="table-list">
            {snapshot.company_work_queue.map((item) => (
              <div className="table-row" key={`${item.owner}-${item.workstream}`} style={{ gridTemplateColumns: '0.8fr 0.7fr 1.7fr 0.9fr' }}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.role || item.owner}</p>
                </div>
                <span className={`status-pill ${statusClass(item.status)}`}>{item.status}</span>
                <div>
                  <strong>{item.next_action}</strong>
                  <p>{item.workstream}</p>
                </div>
                <div>
                  <strong>{item.evidence}</strong>
                  <p>{item.cadence}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
        {snapshot.revenue_goal && (
          <article className="panel" style={{ padding: 14 }}>
            <div className="panel-header panel-header-top">
              <div>
                <p className="eyebrow">营收目标</p>
                <h3>{snapshot.revenue_goal.days || 30} 天经营闭环</h3>
              </div>
              <span className={`status-pill ${statusClass(snapshot.revenue_goal.active ? 'running' : 'standby')}`}>
                {snapshot.revenue_goal.mode || (snapshot.revenue_goal.active ? '运行中' : '待启动')}
              </span>
            </div>
            <div className="metric-grid" style={{ marginTop: 12 }}>
              <div>
                <p>目标</p>
                <strong>¥{formatNumber(snapshot.revenue_goal.target_cny)}</strong>
              </div>
              <div>
                <p>缺口</p>
                <strong>¥{formatNumber(snapshot.revenue_goal.current_gap_cny)}</strong>
              </div>
              <div>
                <p>已内部执行</p>
                <strong>{formatNumber(snapshot.revenue_goal.internal_executed_count)}</strong>
              </div>
              <div>
                <p>待你批准</p>
                <strong>{formatNumber(snapshot.revenue_goal.approval_gated_count || snapshot.revenue_goal.approval_queue_count)}</strong>
              </div>
            </div>
            <div className="stack-item" style={{ marginTop: 12 }}>
              <strong>{snapshot.revenue_goal.selected_project || '尚未选择主项目'}</strong>
              <p>项目评分 {snapshot.revenue_goal.selected_score || 0} / Run {snapshot.revenue_goal.run_id || '-'}</p>
            </div>
            <div className="stack-item" style={{ marginTop: 10 }}>
              <strong>{snapshot.revenue_goal.next_action}</strong>
              <p>{snapshot.revenue_goal.artifacts?.plan || snapshot.revenue_goal.artifacts?.evidence || '等待营收循环产出计划与证据'}</p>
            </div>
          </article>
        )}
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header panel-header-top">
          <div>
            <p className="eyebrow">Agent 职责在线</p>
            <h3>职责、模型层级与技能状态</h3>
          </div>
          <span className="metric-inline">{snapshot.agent_roster.length} 个角色</span>
        </div>
        <div className="table-list">
          {snapshot.agent_roster.map((agent) => (
            <div className="table-row" key={agent.agent_id} style={{ gridTemplateColumns: '0.9fr 0.7fr 1.5fr 0.7fr 0.7fr' }}>
              <div>
                <strong>{agent.name}</strong>
                <p>{agent.role_label || agent.role}</p>
              </div>
              <span className={`status-pill ${statusClass(agent.status)}`}>{agent.status}</span>
              <div>
                <strong>{agent.responsibility}</strong>
                <p>{agent.task_types.join(' / ') || '-'}</p>
              </div>
              <span className={`status-pill ${statusClass(agent.skill_status)}`}>{agent.skill_status}</span>
              <span className={`status-pill ${statusClass(agent.openclaw_status)}`}>{agent.openclaw_status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header panel-header-top">
          <div>
            <p className="eyebrow">HR 学习沉淀</p>
            <h3>爆款学习库与素材包</h3>
          </div>
          <span className="metric-inline">{snapshot.hr_learning_assets?.length ?? 0} 组资产</span>
        </div>
        <div className="table-list">
          {(snapshot.hr_learning_assets ?? []).map((asset) => (
            <div className="table-row" key={asset.id} style={{ gridTemplateColumns: '0.95fr 0.85fr 0.7fr 1.8fr' }}>
              <div>
                <strong>{asset.title}</strong>
                <p>{asset.owner}</p>
              </div>
              <div>
                <strong>{asset.platforms.join(' / ') || '-'}</strong>
                <p>学习平台</p>
              </div>
              <div>
                <strong>{asset.patterns_count}</strong>
                <p>模式沉淀</p>
              </div>
              <div>
                <strong>{asset.next_action}</strong>
                <p>{asset.content_kit_path || asset.knowledge_path}</p>
              </div>
            </div>
          ))}
          {(snapshot.hr_learning_assets ?? []).length === 0 && (
            <div className="stack-item">
              <strong>暂无 HR 学习资产</strong>
              <p>运行 HR 平台学习脚本后，会在这里显示知识库、素材包和部门赋能任务。</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header panel-header-top">
          <div>
            <p className="eyebrow">账号运营</p>
            <h3>平台矩阵与数据源</h3>
          </div>
        </div>
        <div className="table-list">
          {snapshot.platforms.map((platform) => (
            <div className="table-row" key={platform.id} style={{ gridTemplateColumns: '1.1fr 0.8fr 0.8fr 0.7fr 0.7fr 1.5fr' }}>
              <div>
                <strong>{platform.name}</strong>
                <p>{platform.account_name || '未填写账号名'}</p>
              </div>
              <span className={`status-pill ${statusClass(platform.connection_status)}`}>{sourceLabel(platform.connection_status)}</span>
              <span className={`status-pill ${statusClass(platform.data_source)}`}>{sourceLabel(platform.data_source)}</span>
              <div>
                <strong>{formatNumber(platform.views)}</strong>
                <p>曝光</p>
              </div>
              <div>
                <strong>{formatNumber(platform.qualified_leads)}</strong>
                <p>线索</p>
              </div>
              <div>
                <strong>{platform.next_action}</strong>
                <p>上次 {platform.last_sync || '-'} / 下次 {platform.next_check || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header panel-header-top">
          <div>
            <p className="eyebrow">内容运营</p>
            <h3>发布追踪与下一步</h3>
          </div>
          <span className="metric-inline">{contentPosts.length} 条内容</span>
        </div>
        <div className="table-list">
          {contentPosts.length > 0 ? contentPosts.map((post) => (
            <div className="table-row" key={`${post.platform}-${post.post_title}-${post.published_at}`} style={{ gridTemplateColumns: '1.35fr 0.72fr 0.58fr 0.7fr 0.6fr 1.05fr 1.35fr' }}>
              <div>
                <strong>{post.post_title}</strong>
                <p>{post.platform} · 发布 {post.published_at || '-'}</p>
              </div>
              <span className={`status-pill ${statusClass(post.status === 'published' ? 'synced' : 'warning')}`}>{postStatusLabel(post.status)}</span>
              <div>
                <strong>{formatNumber(post.views)}</strong>
                <p>曝光</p>
              </div>
              <div>
                <strong>{formatNumber(post.likes + post.favorites + post.comments + post.shares)}</strong>
                <p>赞藏评转</p>
              </div>
              <div>
                <strong>{formatNumber(post.qualified_leads)}</strong>
                <p>线索</p>
              </div>
              <div>
                <strong>{post.review_status === 'needs_review' ? '待复盘' : '已追踪'}</strong>
                <p>{post.next_topic}</p>
              </div>
              <div>
                <strong>{post.private_domain_action}</strong>
                <p>最近检查 {post.last_checked_at || '-'}</p>
              </div>
            </div>
          )) : (
            <div className="stack-item">
              <strong>暂无内容监控记录</strong>
              <p>先把已发布内容写入运营监控 CSV，再进入复盘和线索承接。</p>
            </div>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">内容战役</p>
              <h3>从选题到复盘</h3>
            </div>
          </div>
          <div className="stack-list">
            {snapshot.campaigns.map((campaign) => (
              <div className="stack-item" key={campaign.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{campaign.name}</strong>
                  <span className={`status-pill ${statusClass(campaign.stage)}`}>{campaign.stage}</span>
                </div>
                <p>{campaign.platforms.join(' / ')}</p>
                <p>已发布 {campaign.assets_published}/{campaign.assets_ready}，曝光 {formatNumber(campaign.total_views)}，线索 {formatNumber(campaign.qualified_leads)}</p>
                <p>{campaign.next_action}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">线索漏斗</p>
              <h3>从流量到收款</h3>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {snapshot.lead_funnel.stages.map((stage) => (
              <div className="stack-item" key={stage.id}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{stage.name}</span>
                <strong style={{ display: 'block', marginTop: 4, fontSize: 20 }}>{formatNumber(stage.count)}</strong>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>{snapshot.lead_funnel.next_action}</p>
        </article>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Agent 作战室</p>
            <h3>角色职责与卡点</h3>
          </div>
        </div>
        <div className="table-list">
          {snapshot.agent_ops.map((agent) => (
            <div className="table-row" key={agent.agent_id} style={{ gridTemplateColumns: '1fr 0.7fr 1.4fr 1.4fr' }}>
              <div>
                <strong>{agent.name}</strong>
                <p>{agent.role}</p>
              </div>
              <span className={`status-pill ${statusClass(agent.status)}`}>{agent.status}</span>
              <div>
                <strong>{agent.current_task}</strong>
                <p>{agent.last_action}</p>
              </div>
              <div>
                <strong>{agent.next_action}</strong>
                <p>{agent.blocker || (agent.needs_ceo_review ? '需要 CEO 审批' : '无卡点')}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">风险告警</p>
              <h3>商业化缺口</h3>
            </div>
          </div>
          <div className="stack-list">
            {snapshot.risk_alerts.map((alert) => (
              <div className="stack-item" key={`${alert.owner}-${alert.title}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{alert.title}</strong>
                  <span className={`status-pill ${statusClass(alert.level)}`}>{alert.owner}</span>
                </div>
                <p>{alert.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">自动化权限</p>
              <h3>安全边界</h3>
            </div>
          </div>
          <div className="stack-list">
            {safetyRows.map(([label, enabled]) => (
              <div className="stack-item" key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <strong>{label}</strong>
                <span className={enabled ? 'status-pill idle' : 'status-pill frozen'}>{enabled ? '允许' : '关闭'}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">健康守护</p>
              <h3>计划任务</h3>
            </div>
          </div>
          <div className="table-list">
            {snapshot.scheduled_tasks.map((task) => (
              <div className="table-row" key={task.name}>
                <div>
                  <strong>{task.name}</strong>
                  <p>下次：{task.next_run_time || '-'}</p>
                </div>
                <span className={`status-pill ${statusClass(task.result)}`}>{task.state}</span>
                <span>{task.result}</span>
                <span>{task.result_code ?? '-'}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">下一步</p>
              <h3>循环检查</h3>
            </div>
          </div>
          <div className="stack-list">
            {snapshot.next_actions.map((action) => (
              <div className="stack-item" key={action}>
                <p style={{ margin: 0 }}>{action}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  )
}
