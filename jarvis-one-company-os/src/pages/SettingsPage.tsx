import { useEffect, useRef, useState, useCallback } from 'react'
import { loadAppConfig, invalidateConfigCache, type AppConfig, type AgentConfig, type LlmProvider, type LlmProviderModel } from '../services/configService'

type Tab = 'company' | 'agents' | 'token' | 'targets' | 'scheduler' | 'integrations' | 'payment' | 'content' | 'llm' | 'ui'

const TAB_LIST: { id: Tab; label: string; icon: string }[] = [
  { id: 'company', label: '公司信息', icon: '🏢' },
  { id: 'agents', label: '角色管理', icon: '🤖' },
  { id: 'token', label: 'Token 经济', icon: '💰' },
  { id: 'targets', label: '运营目标', icon: '🎯' },
  { id: 'integrations', label: '集成配置', icon: '🔗' },
  { id: 'payment', label: '收款设置', icon: '💳' },
  { id: 'llm', label: 'LLM 配置', icon: '🧠' },
  { id: 'scheduler', label: '定时任务', icon: '⏰' },
  { id: 'content', label: '内容策略', icon: '📝' },
  { id: 'ui', label: '界面设置', icon: '🎨' },
]

function Field({ label, value, onChange, type = 'text', placeholder, help }: {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; help?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)',
          color: '#e2e8f0', fontSize: 13, outline: 'none',
        }}
      />
      {help && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{help}</div>}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: '#cbd5e1' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
          background: value ? '#6366f1' : 'rgba(100, 116, 139, 0.4)',
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <span style={{
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: value ? 21 : 3, transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 18, borderRadius: 12,
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      marginBottom: 16,
    }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{title}</h3>
      {children}
    </div>
  )
}

function CompanyTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const c = config.company
  const ct = config.contact
  const set = (key: keyof typeof c, val: string) => setConfig({ ...config, company: { ...c, [key]: val } })
  const setCt = (key: keyof typeof ct, val: string) => setConfig({ ...config, contact: { ...ct, [key]: val } })
  return (
    <>
      <SectionCard title="基本信息">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="公司名称" value={c.name} onChange={v => set('name', v)} />
          <Field label="CEO 姓名" value={c.ceo_name} onChange={v => set('ceo_name', v)} />
          <Field label="行业领域" value={c.industry} onChange={v => set('industry', v)} />
          <Field label="Slogan" value={c.tagline} onChange={v => set('tagline', v)} />
        </div>
        <Field label="使命" value={c.mission} onChange={v => set('mission', v)} />
        <Field label="愿景" value={c.vision} onChange={v => set('vision', v)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <Field label="时区" value={c.timezone} onChange={v => set('timezone', v)} />
          <Field label="语言" value={c.language} onChange={v => set('language', v)} />
          <Field label="货币" value={c.currency} onChange={v => set('currency', v)} />
        </div>
      </SectionCard>
      <SectionCard title="联系方式">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="姓名" value={ct.name} onChange={v => setCt('name', v)} />
          <Field label="手机" value={ct.phone} onChange={v => setCt('phone', v)} />
          <Field label="邮箱" value={ct.email} onChange={v => setCt('email', v)} />
          <Field label="微信" value={ct.wechat} onChange={v => setCt('wechat', v)} />
        </div>
      </SectionCard>
    </>
  )
}

function AgentEditor({ agent, onChange }: { agent: AgentConfig; onChange: (a: AgentConfig) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: agent.enabled ? 'rgba(99, 102, 241, 0.06)' : 'rgba(100, 116, 139, 0.06)',
      border: `1px solid ${agent.enabled ? 'rgba(99, 102, 241, 0.2)' : 'rgba(100, 116, 139, 0.15)'}`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: 0, width: 20 }}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          {agent.display_name}
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{agent.role_label}</span>
        </span>
        <Toggle label="" value={agent.enabled} onChange={v => onChange({ ...agent, enabled: v })} />
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingLeft: 30 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <Field label="显示名称" value={agent.display_name} onChange={v => onChange({ ...agent, display_name: v })} />
            <Field label="角色代码" value={agent.role} onChange={v => onChange({ ...agent, role: v })} />
            <Field label="角色名称" value={agent.role_label} onChange={v => onChange({ ...agent, role_label: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <Field label="月薪 (Token)" value={agent.monthly_token_salary} type="number" onChange={v => onChange({ ...agent, monthly_token_salary: Number(v) })} />
            <Field label="等级" value={agent.level} onChange={v => onChange({ ...agent, level: v })} />
            <Field label="模型层级" value={agent.model_tier} onChange={v => onChange({ ...agent, model_tier: v })} />
          </div>
          <Field label="能力标签 (逗号分隔)" value={agent.capabilities.join(', ')} onChange={v => onChange({ ...agent, capabilities: v.split(',').map(s => s.trim()).filter(Boolean) })} />
          <Field label="人格关键词 (逗号分隔)" value={agent.persona_keywords.join(', ')} onChange={v => onChange({ ...agent, persona_keywords: v.split(',').map(s => s.trim()).filter(Boolean) })} />
        </div>
      )}
    </div>
  )
}

function AgentsTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const agents = config.agents ?? []
  const updateAgent = (idx: number, agent: AgentConfig) => {
    const next = [...agents]
    next[idx] = agent
    setConfig({ ...config, agents: next })
  }
  return (
    <SectionCard title={`角色列表 (${agents.length} 个)`}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        点击角色名称展开详细编辑。可修改名字、角色、薪资、能力标签等。
      </div>
      {agents.map((a, i) => (
        <AgentEditor key={a.id} agent={a} onChange={v => updateAgent(i, v)} />
      ))}
    </SectionCard>
  )
}

function TargetsTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const ot = config.operation_targets
  const setOt = (patch: Partial<typeof ot>) =>
    setConfig({ ...config, operation_targets: { ...ot, ...patch } })
  return (
    <>
      <SectionCard title="作战站会 KPI 目标">
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          对应每日自动生成的 <code style={{ fontSize: 11 }}>output/daily_standup/standup_*.md</code> 中「目标」列。
          修改后保存即可；定时任务下次运行会读最新配置。
        </div>
        <Field
          label="阶段标签（表头）"
          value={ot.phase_label}
          onChange={v => setOt({ phase_label: v })}
          help='例如 "Day 30" 或 "M1 冲刺"'
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="目标订单数（累计）" value={ot.orders} type="number" onChange={v => setOt({ orders: Number(v) })} />
          <Field label="目标营收（人民币，整数）" value={ot.revenue_cny} type="number" onChange={v => setOt({ revenue_cny: Number(v) })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <Field label="脚本数目标文案" value={ot.scripts_label} onChange={v => setOt({ scripts_label: v })} help='可填 "60+" 等' />
          <Field label="视频库存目标文案" value={ot.videos_label} onChange={v => setOt({ videos_label: v })} />
          <Field label="海报库存目标文案" value={ot.posters_label} onChange={v => setOt({ posters_label: v })} />
        </div>
      </SectionCard>
    </>
  )
}

function TokenTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const te = config.token_economy
  const setTe = (patch: Partial<typeof te>) => setConfig({ ...config, token_economy: { ...te, ...patch } })
  const pb = te.performance_bonus
  const at = te.audit_thresholds
  const pd = te.profit_distribution
  return (
    <>
      <SectionCard title="基础预算">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="月度总预算 (Token)" value={te.monthly_total_budget} type="number" onChange={v => setTe({ monthly_total_budget: Number(v) })} />
          <Field label="积累上限倍数" value={te.surplus_cap_multiplier} type="number" onChange={v => setTe({ surplus_cap_multiplier: Number(v) })} />
        </div>
        <Field label="薪资发放规则" value={te.salary_payout_rule} onChange={v => setTe({ salary_payout_rule: v })} />
      </SectionCard>
      <SectionCard title="绩效奖金">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <Field label="KPI 超额奖金倍率" value={pb.kpi_exceed_bonus_rate} type="number" onChange={v => setTe({ performance_bonus: { ...pb, kpi_exceed_bonus_rate: Number(v) } })} />
          <Field label="创新奖最小" value={pb.innovation_reward_range[0]} type="number" onChange={v => setTe({ performance_bonus: { ...pb, innovation_reward_range: [Number(v), pb.innovation_reward_range[1]] } })} />
          <Field label="创新奖最大" value={pb.innovation_reward_range[1]} type="number" onChange={v => setTe({ performance_bonus: { ...pb, innovation_reward_range: [pb.innovation_reward_range[0], Number(v)] } })} />
        </div>
      </SectionCard>
      <SectionCard title="审计阈值">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="日成本告警 (USD)" value={at.daily_cost_alert_usd} type="number" onChange={v => setTe({ audit_thresholds: { ...at, daily_cost_alert_usd: Number(v) } })} />
          <Field label="月预算告警 (%)" value={at.monthly_budget_alert_percent} type="number" onChange={v => setTe({ audit_thresholds: { ...at, monthly_budget_alert_percent: Number(v) } })} />
        </div>
        <Toggle label="超标自动降级" value={at.auto_downgrade_on_exceed} onChange={v => setTe({ audit_thresholds: { ...at, auto_downgrade_on_exceed: v } })} />
      </SectionCard>
      <SectionCard title="利润分配 (%)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Token 基础设施" value={pd.token_infrastructure_percent} type="number" onChange={v => setTe({ profit_distribution: { ...pd, token_infrastructure_percent: Number(v) } })} />
          <Field label="绩效奖金" value={pd.performance_bonus_percent} type="number" onChange={v => setTe({ profit_distribution: { ...pd, performance_bonus_percent: Number(v) } })} />
          <Field label="技能升级" value={pd.skill_upgrade_percent} type="number" onChange={v => setTe({ profit_distribution: { ...pd, skill_upgrade_percent: Number(v) } })} />
          <Field label="公司储备金" value={pd.reserve_percent} type="number" onChange={v => setTe({ profit_distribution: { ...pd, reserve_percent: Number(v) } })} />
        </div>
        {(() => {
          const total = pd.token_infrastructure_percent + pd.performance_bonus_percent + pd.skill_upgrade_percent + pd.reserve_percent
          return total !== 100 ? (
            <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>总和 {total}% ≠ 100%，请调整</div>
          ) : null
        })()}
      </SectionCard>
    </>
  )
}

interface SchedulerJob {
  name: string; pattern: string; script: string; enabled: boolean; category?: string
}

function SchedulerTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const rawCfg = config as unknown as { scheduler?: { jobs: SchedulerJob[] } }
  const jobs: SchedulerJob[] = rawCfg.scheduler?.jobs ?? []

  const updateJob = (idx: number, patch: Partial<SchedulerJob>) => {
    const next = [...jobs]
    next[idx] = { ...next[idx], ...patch }
    setConfig({ ...config, scheduler: { jobs: next } } as unknown as AppConfig)
  }

  const cats = [...new Set(jobs.map(j => j.category ?? 'other'))]

  return (
    <SectionCard title={`定时任务 (${jobs.length} 个)`}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        开关控制任务是否执行。Cron 表达式定义执行频率。
      </div>
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
            {cat}
          </div>
          {jobs.map((job, idx) => {
            if ((job.category ?? 'other') !== cat) return null
            return (
              <div key={job.name} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
              }}>
                <Toggle label="" value={job.enabled} onChange={v => updateJob(idx, { enabled: v })} />
                <span style={{ flex: 1, fontSize: 13, color: '#e2e8f0' }}>{job.name}</span>
                <input
                  value={job.pattern}
                  onChange={e => updateJob(idx, { pattern: e.target.value })}
                  style={{
                    width: 140, padding: '4px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace',
                    background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)',
                    color: '#94a3b8', outline: 'none',
                  }}
                />
              </div>
            )
          })}
        </div>
      ))}
    </SectionCard>
  )
}

function ContentTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const cs = config.content_strategy
  const setCs = (patch: Partial<typeof cs>) => setConfig({ ...config, content_strategy: { ...cs, ...patch } })
  return (
    <SectionCard title="内容策略">
      <Field label="品牌定位" value={cs.brand_positioning} onChange={v => setCs({ brand_positioning: v })} />
      <Field label="内容风格" value={cs.content_style} onChange={v => setCs({ content_style: v })} />
      <Field label="目标受众 (逗号分隔)" value={cs.target_audience.join(', ')} onChange={v => setCs({ target_audience: v.split(',').map(s => s.trim()).filter(Boolean) })} />
      <Field label="发布平台 (逗号分隔)" value={cs.platforms.join(', ')} onChange={v => setCs({ platforms: v.split(',').map(s => s.trim()).filter(Boolean) })} />
    </SectionCard>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function IntegrationsTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const raw = config as any
  const integ = raw.integrations ?? {}
  const setInteg = (patch: any) => setConfig({ ...config, integrations: { ...integ, ...patch } } as any)

  const feishu = integ.feishu ?? {}
  const sm = integ.social_media ?? {}
  const email = integ.email ?? {}
  const wecom = integ.wecom ?? {}

  return (
    <>
      <SectionCard title="飞书通知">
        <Toggle label="启用飞书" value={feishu.enabled ?? false} onChange={v => setInteg({ feishu: { ...feishu, enabled: v } })} />
        {feishu.enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Field label="App ID" value={feishu.app_id ?? ''} onChange={v => setInteg({ feishu: { ...feishu, app_id: v } })} placeholder="飞书应用ID" />
            <Field label="App Secret" value={feishu.app_secret ?? ''} onChange={v => setInteg({ feishu: { ...feishu, app_secret: v } })} placeholder="飞书应用密钥" type="password" />
            <Field label="机器人 Webhook" value={feishu.bot_webhook_url ?? ''} onChange={v => setInteg({ feishu: { ...feishu, bot_webhook_url: v } })} placeholder="群机器人webhook地址" />
            <Field label="通知群 Chat ID" value={feishu.notify_chat_id ?? ''} onChange={v => setInteg({ feishu: { ...feishu, notify_chat_id: v } })} />
            <Field label="CEO Open ID" value={feishu.ceo_open_id ?? ''} onChange={v => setInteg({ feishu: { ...feishu, ceo_open_id: v } })} />
          </div>
        )}
        {feishu.setup_guide && !feishu.enabled && (
          <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'pre-line', marginTop: 6 }}>{feishu.setup_guide}</div>
        )}
      </SectionCard>

      {(['douyin', 'xiaohongshu', 'bilibili'] as const).map(platform => {
        const p = sm[platform] ?? {}
        const names: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', bilibili: 'B站' }
        return (
          <SectionCard key={platform} title={names[platform]}>
            <Toggle label={`启用${names[platform]}`} value={p.enabled ?? false} onChange={v => setInteg({ social_media: { ...sm, [platform]: { ...p, enabled: v } } })} />
            {p.enabled && (
              <>
                <Field label="账号名称" value={p.account_name ?? ''} onChange={v => setInteg({ social_media: { ...sm, [platform]: { ...p, account_name: v } } })} />
                <Field label="Cookie 文件路径" value={p.cookie_file ?? ''} onChange={v => setInteg({ social_media: { ...sm, [platform]: { ...p, cookie_file: v } } })} help="浏览器登录后导出Cookie文件的本地路径" />
                <Toggle label="自动发布 (关闭则仅存草稿)" value={p.auto_publish ?? false} onChange={v => setInteg({ social_media: { ...sm, [platform]: { ...p, auto_publish: v, draft_only: !v } } })} />
              </>
            )}
          </SectionCard>
        )
      })}

      <SectionCard title="邮件 (SMTP)">
        <Toggle label="启用邮件" value={email.enabled ?? false} onChange={v => setInteg({ email: { ...email, enabled: v } })} />
        {email.enabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0 16px' }}>
              <Field label="SMTP 服务器" value={email.smtp_host ?? ''} onChange={v => setInteg({ email: { ...email, smtp_host: v } })} placeholder="smtp.qq.com" />
              <Field label="端口" value={email.smtp_port ?? 465} type="number" onChange={v => setInteg({ email: { ...email, smtp_port: Number(v) } })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="发件邮箱" value={email.smtp_user ?? ''} onChange={v => setInteg({ email: { ...email, smtp_user: v } })} />
              <Field label="授权码" value={email.smtp_password ?? ''} onChange={v => setInteg({ email: { ...email, smtp_password: v } })} type="password" help="不是登录密码，是SMTP授权码" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="发件人名称" value={email.from_name ?? ''} onChange={v => setInteg({ email: { ...email, from_name: v } })} />
              <Field label="每日发送限额" value={email.daily_send_limit ?? 50} type="number" onChange={v => setInteg({ email: { ...email, daily_send_limit: Number(v) } })} />
            </div>
            <Toggle label="SSL 加密" value={email.smtp_ssl ?? true} onChange={v => setInteg({ email: { ...email, smtp_ssl: v } })} />
          </>
        )}
      </SectionCard>

      <SectionCard title="企业微信">
        <Toggle label="启用企业微信" value={wecom.enabled ?? false} onChange={v => setInteg({ wecom: { ...wecom, enabled: v } })} />
        {wecom.enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <Field label="企业ID" value={wecom.corp_id ?? ''} onChange={v => setInteg({ wecom: { ...wecom, corp_id: v } })} />
            <Field label="Agent ID" value={wecom.agent_id ?? ''} onChange={v => setInteg({ wecom: { ...wecom, agent_id: v } })} />
            <Field label="Agent Secret" value={wecom.agent_secret ?? ''} onChange={v => setInteg({ wecom: { ...wecom, agent_secret: v } })} type="password" />
          </div>
        )}
      </SectionCard>
    </>
  )
}

function PaymentTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const raw = config as any
  const pay = raw.payment ?? {}
  const setPay = (patch: any) => setConfig({ ...config, payment: { ...pay, ...patch } } as any)

  const bank = pay.bank ?? {}
  const alipay = pay.alipay ?? {}
  const wechat = pay.wechat_pay ?? {}

  return (
    <>
      <SectionCard title="收款公司信息">
        <Field label="公司/个人名称" value={pay.company_name ?? ''} onChange={v => setPay({ company_name: v })} />
      </SectionCard>

      <SectionCard title="银行转账">
        <Toggle label="启用银行转账" value={bank.enabled ?? false} onChange={v => setPay({ bank: { ...bank, enabled: v } })} />
        {bank.enabled && (
          <>
            <Field label="开户行" value={bank.bank_name ?? ''} onChange={v => setPay({ bank: { ...bank, bank_name: v } })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="户名" value={bank.account_name ?? ''} onChange={v => setPay({ bank: { ...bank, account_name: v } })} />
              <Field label="卡号" value={bank.account_no ?? ''} onChange={v => setPay({ bank: { ...bank, account_no: v } })} />
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="支付宝收款">
        <Toggle label="启用支付宝" value={alipay.enabled ?? false} onChange={v => setPay({ alipay: { ...alipay, enabled: v } })} />
        {alipay.enabled && (
          <>
            <Field label="支付宝账号" value={alipay.account ?? ''} onChange={v => setPay({ alipay: { ...alipay, account: v } })} />
            <Field label="收款码图片路径" value={alipay.qr_image_path ?? ''} onChange={v => setPay({ alipay: { ...alipay, qr_image_path: v } })} help="支付宝收款码图片的文件路径" />
          </>
        )}
      </SectionCard>

      <SectionCard title="微信收款">
        <Toggle label="启用微信支付" value={wechat.enabled ?? false} onChange={v => setPay({ wechat_pay: { ...wechat, enabled: v } })} />
        {wechat.enabled && (
          <>
            <Field label="微信号" value={wechat.account ?? ''} onChange={v => setPay({ wechat_pay: { ...wechat, account: v } })} />
            <Field label="收款码图片路径" value={wechat.qr_image_path ?? ''} onChange={v => setPay({ wechat_pay: { ...wechat, qr_image_path: v } })} help="微信收款码图片的文件路径" />
          </>
        )}
      </SectionCard>
    </>
  )
}

const PROVIDER_TYPE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  official: { label: '官方 API', color: '#22c55e', desc: '直连官方 API，按用量付费' },
  cliproxy: { label: 'CLIProxyAPI', color: '#f59e0b', desc: '通过 OAuth 使用 ChatGPT Plus 订阅' },
  relay: { label: '中转', color: '#6366f1', desc: 'OpenAI 兼容中转，支持多种模型' },
}

function ProviderModelEditor({ model, onChange, onDelete }: {
  model: LlmProviderModel; onChange: (m: LlmProviderModel) => void; onDelete: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <input value={model.name} onChange={e => onChange({ ...model, name: e.target.value })} placeholder="模型名称"
        style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', color: '#e2e8f0', fontSize: 12, outline: 'none' }} />
      <input value={model.alias ?? ''} onChange={e => onChange({ ...model, alias: e.target.value })} placeholder="别名/说明"
        style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8', fontSize: 12, outline: 'none' }} />
      <button type="button" onClick={onDelete}
        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>✕</button>
    </div>
  )
}

function ProviderCard({ provider, onChange }: {
  provider: LlmProvider; onChange: (p: LlmProvider) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const typeInfo = PROVIDER_TYPE_LABELS[provider.type] ?? PROVIDER_TYPE_LABELS.official

  const updateModel = (idx: number, m: LlmProviderModel) => {
    const next = [...provider.models]
    next[idx] = m
    onChange({ ...provider, models: next })
  }
  const removeModel = (idx: number) => {
    onChange({ ...provider, models: provider.models.filter((_, i) => i !== idx) })
  }
  const addModel = () => {
    const newId = `${provider.id}-new-${Date.now()}`
    onChange({ ...provider, models: [...provider.models, { id: newId, name: '', alias: '' }] })
  }

  return (
    <div style={{
      padding: 14, borderRadius: 10, marginBottom: 10,
      background: provider.enabled ? 'rgba(99,102,241,0.04)' : 'rgba(100,116,139,0.04)',
      border: `1px solid ${provider.enabled ? 'rgba(99,102,241,0.18)' : 'rgba(100,116,139,0.12)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, width: 18 }}>
          {expanded ? '▼' : '▶'}
        </button>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
          background: `${typeInfo.color}20`, color: typeInfo.color, letterSpacing: 0.5,
        }}>
          {typeInfo.label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          {provider.name}
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
            {provider.models.length} 个模型
          </span>
        </span>
        <Toggle label="" value={provider.enabled} onChange={v => onChange({ ...provider, enabled: v })} />
      </div>

      {provider.description && !expanded && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, paddingLeft: 28 }}>{provider.description}</div>
      )}

      {expanded && (
        <div style={{ marginTop: 12, paddingLeft: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="显示名称" value={provider.name} onChange={v => onChange({ ...provider, name: v })} />
            <Field label="说明" value={provider.description ?? ''} onChange={v => onChange({ ...provider, description: v })} />
          </div>

          {provider.type === 'cliproxy' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Field label="本地端口" value={provider.port ?? 18800} type="number" onChange={v => onChange({ ...provider, port: Number(v) })} />
              <Field label="本地 API Key" value={provider.api_key ?? ''} onChange={v => onChange({ ...provider, api_key: v })} />
              <Field label="二进制路径" value={provider.binary_path ?? ''} onChange={v => onChange({ ...provider, binary_path: v })} help="cli-proxy-api.exe 路径" />
              <Field label="配置文件" value={provider.config_path ?? ''} onChange={v => onChange({ ...provider, config_path: v })} help="config.yaml 路径" />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0 12px' }}>
              <Field label="API Base URL" value={provider.base_url ?? ''} onChange={v => onChange({ ...provider, base_url: v })} placeholder="https://api.example.com/v1" />
              <Field label="API Key" value={provider.api_key ?? ''} onChange={v => onChange({ ...provider, api_key: v })} type="password" />
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: '#94a3b8' }}>模型列表</label>
              <button type="button" onClick={addModel}
                style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', background: 'transparent', color: '#a5b4fc', fontSize: 11, cursor: 'pointer' }}>
                + 添加模型
              </button>
            </div>
            {provider.models.map((m, i) => (
              <ProviderModelEditor key={m.id || i} model={m} onChange={v => updateModel(i, v)} onDelete={() => removeModel(i)} />
            ))}
          </div>

          {provider.setup_guide && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 11, color: '#6366f1', cursor: 'pointer' }}>配置指南</summary>
              <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'pre-line', marginTop: 4, padding: '8px 12px', background: 'rgba(15,23,42,0.4)', borderRadius: 6 }}>
                {provider.setup_guide}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function LLMTab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const llm = config.llm ?? { monthly_budget_usd: 50, default_provider: '', default_model: '', routing_rules_file: '', cache_identical_prompts: true, batch_similar_requests: true, providers: [], fallback_chains: {} }
  const setLlm = (patch: Partial<typeof llm>) => setConfig({ ...config, llm: { ...llm, ...patch } })

  const providers = llm.providers ?? []
  const customProviderCounterRef = useRef(0)

  const updateProvider = (idx: number, p: LlmProvider) => {
    const next = [...providers]
    next[idx] = p
    setLlm({ providers: next })
  }

  const addProvider = (type: 'official' | 'cliproxy' | 'relay') => {
    customProviderCounterRef.current += 1
    const id = `custom-${customProviderCounterRef.current}`
    const newProvider: LlmProvider = {
      id,
      type,
      name: type === 'cliproxy' ? 'CLIProxyAPI' : type === 'relay' ? '新中转服务' : '新 API 服务',
      description: '',
      enabled: false,
      base_url: type === 'cliproxy' ? undefined : '',
      api_key: '',
      port: type === 'cliproxy' ? 18800 : undefined,
      models: [],
    }
    setLlm({ providers: [...providers, newProvider] })
  }

  const enabledProviders = providers.filter(p => p.enabled)
  const enabledModels = enabledProviders.flatMap(p => p.models)

  const defaultProviderOptions = enabledModels.map(m => ({ id: m.id, label: `${m.name}${m.alias ? ` (${m.alias})` : ''}` }))

  return (
    <>
      <SectionCard title="模型概览">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(99,102,241,0.08)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#a5b4fc' }}>{enabledProviders.length}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>已启用提供商</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.08)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#86efac' }}>{enabledModels.length}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>可用模型</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.08)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>${llm.monthly_budget_usd}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>月度预算</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="月度预算 (USD)" value={llm.monthly_budget_usd} type="number" onChange={v => setLlm({ monthly_budget_usd: Number(v) })} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>默认模型</label>
            <select value={llm.default_provider} onChange={e => setLlm({ default_provider: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 13 }}>
              <option value="">自动级联 (Auto)</option>
              {defaultProviderOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <Toggle label="缓存相同 Prompt" value={llm.cache_identical_prompts} onChange={v => setLlm({ cache_identical_prompts: v })} />
        <Toggle label="批量合并相似请求" value={llm.batch_similar_requests} onChange={v => setLlm({ batch_similar_requests: v })} />
      </SectionCard>

      <SectionCard title={`模型提供商 (${providers.length} 个)`}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          支持三种配置方式：
          <span style={{ color: '#22c55e' }}> 官方 API</span> |
          <span style={{ color: '#f59e0b' }}> CLIProxyAPI 代理</span> |
          <span style={{ color: '#6366f1' }}> 中转</span>。
          点击展开详细配置。
        </div>

        {providers.map((p, i) => (
          <ProviderCard key={p.id} provider={p} onChange={v => updateProvider(i, v)} />
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => addProvider('official')}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px dashed rgba(34,197,94,0.3)', background: 'transparent', color: '#86efac', fontSize: 12, cursor: 'pointer' }}>
            + 官方 API
          </button>
          <button type="button" onClick={() => addProvider('cliproxy')}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px dashed rgba(245,158,11,0.3)', background: 'transparent', color: '#fbbf24', fontSize: 12, cursor: 'pointer' }}>
            + CLIProxyAPI
          </button>
          <button type="button" onClick={() => addProvider('relay')}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px dashed rgba(99,102,241,0.3)', background: 'transparent', color: '#a5b4fc', fontSize: 12, cursor: 'pointer' }}>
            + 中转
          </button>
        </div>
      </SectionCard>
    </>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function UITab({ config, setConfig }: { config: AppConfig; setConfig: (c: AppConfig) => void }) {
  const ui = config.ui
  const setUI = (patch: Partial<typeof ui>) => setConfig({ ...config, ui: { ...ui, ...patch } })
  return (
    <SectionCard title="界面偏好">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>主题</label>
          <select
            value={ui.theme}
            onChange={e => setUI({ theme: e.target.value })}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#e2e8f0', fontSize: 13,
            }}
          >
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>强调色</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={ui.accent_color}
              onChange={e => setUI({ accent_color: e.target.value })}
              style={{ width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{ui.accent_color}</span>
          </div>
        </div>
      </div>
      <Toggle label="显示 Token 消耗" value={ui.show_token_cost} onChange={v => setUI({ show_token_cost: v })} />
      <Toggle label="显示角色头像" value={ui.show_agent_avatars} onChange={v => setUI({ show_agent_avatars: v })} />
      <Field label="仪表盘刷新间隔 (毫秒)" value={ui.dashboard_refresh_interval_ms} type="number" onChange={v => setUI({ dashboard_refresh_interval_ms: Number(v) })} />
    </SectionCard>
  )
}

export function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [tab, setTab] = useState<Tab>('company')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    loadAppConfig().then(cfg => setConfig(JSON.parse(JSON.stringify(cfg))))
  }, [])

  const handleConfigChange = useCallback((newCfg: AppConfig) => {
    setConfig(newCfg)
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/company/app-config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        invalidateConfigCache()
        await loadAppConfig()
        setDirty(false)
        setToast('配置已保存')
        setTimeout(() => setToast(''), 3000)
      } else {
        setToast('保存失败')
        setTimeout(() => setToast(''), 3000)
      }
    } catch {
      setToast('保存失败：网络错误')
      setTimeout(() => setToast(''), 3000)
    }
    setSaving(false)
  }, [config])

  if (!config) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        加载配置中...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>配置中心</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            自定义你的一人公司操作系统 · 所有修改实时生效
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {toast && (
            <span style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12,
              background: toast.includes('失败') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: toast.includes('失败') ? '#ef4444' : '#22c55e',
            }}>
              {toast}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none',
              background: dirty ? '#6366f1' : 'rgba(100, 116, 139, 0.3)',
              color: dirty ? '#fff' : '#64748b',
              fontSize: 13, fontWeight: 600, cursor: dirty ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            {saving ? '保存中...' : dirty ? '保存配置' : '已保存'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 20px', flexShrink: 0,
        borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
        overflowX: 'auto',
      }}>
        {TAB_LIST.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: tab === t.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: tab === t.id ? '#a5b4fc' : '#94a3b8',
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tab === 'company' && <CompanyTab config={config} setConfig={handleConfigChange} />}
        {tab === 'agents' && <AgentsTab config={config} setConfig={handleConfigChange} />}
        {tab === 'token' && <TokenTab config={config} setConfig={handleConfigChange} />}
        {tab === 'targets' && <TargetsTab config={config} setConfig={handleConfigChange} />}
        {tab === 'integrations' && <IntegrationsTab config={config} setConfig={handleConfigChange} />}
        {tab === 'payment' && <PaymentTab config={config} setConfig={handleConfigChange} />}
        {tab === 'llm' && <LLMTab config={config} setConfig={handleConfigChange} />}
        {tab === 'scheduler' && <SchedulerTab config={config} setConfig={handleConfigChange} />}
        {tab === 'content' && <ContentTab config={config} setConfig={handleConfigChange} />}
        {tab === 'ui' && <UITab config={config} setConfig={handleConfigChange} />}
      </div>
    </div>
  )
}
