import { useMemo, useState } from 'react'
import { saasReadinessService } from '../services/saasReadinessService'
import type { TenantEnabledModule } from '../types'

const moduleLabels: Record<TenantEnabledModule, string> = {
  opportunity: '项目机会',
  offers: '产品货架',
  sales: '销售管道',
  workflows: '交付工作流',
  revenue: '收入确认',
  daily_run: '每日运营',
  action_boundary: 'CEO 边界',
  runtime: '运行中心',
  audit: '审计风控',
}

export function OnboardingPage() {
  const industryTemplates = useMemo(() => saasReadinessService.listIndustryTemplates(), [])
  const teamTemplates = useMemo(() => saasReadinessService.listAgentTeamTemplates(), [])
  const [industryId, setIndustryId] = useState(industryTemplates[0]?.id ?? '')
  const selectedIndustry = useMemo(
    () => saasReadinessService.getIndustryTemplateById(industryId) ?? industryTemplates[0],
    [industryId, industryTemplates],
  )
  const [businessGoal, setBusinessGoal] = useState(selectedIndustry?.defaultBusinessGoal ?? '')
  const [agentTemplateId, setAgentTemplateId] = useState(selectedIndustry?.recommendedAgentTemplateId ?? teamTemplates[0]?.id ?? '')
  const [enabledModules, setEnabledModules] = useState<TenantEnabledModule[]>(selectedIndustry?.recommendedModules ?? [])
  const [cadence, setCadence] = useState(selectedIndustry?.defaultDailyRunCadence ?? 'daily')
  const [preview, setPreview] = useState(saasReadinessService.getTenantConfig())
  const [feedback, setFeedback] = useState('')
  const selectedTeam = useMemo(
    () => saasReadinessService.getAgentTeamTemplateById(agentTemplateId) ?? teamTemplates[0],
    [agentTemplateId, teamTemplates],
  )

  function chooseIndustry(nextId: string) {
    const template = saasReadinessService.getIndustryTemplateById(nextId)
    if (!template) return
    setIndustryId(nextId)
    setBusinessGoal(template.defaultBusinessGoal)
    setAgentTemplateId(template.recommendedAgentTemplateId)
    setEnabledModules(template.recommendedModules)
    setCadence(template.defaultDailyRunCadence)
  }

  function toggleModule(moduleId: TenantEnabledModule) {
    setEnabledModules(current => current.includes(moduleId)
      ? current.filter(item => item !== moduleId)
      : [...current, moduleId])
  }

  function generatePreview() {
    setPreview({
      ...saasReadinessService.getTenantConfig(),
      industry: selectedIndustry?.name ?? '',
      businessGoal,
      enabledModules,
      agentTemplateId,
      offerCatalogId: selectedIndustry?.recommendedOfferCatalogId ?? 'default_offer_catalog',
      dailyRunCadence: cadence,
    })
    setFeedback('已生成初始配置预览，尚未覆盖真实生产配置。')
  }

  function simulateApply() {
    if (selectedIndustry) saasReadinessService.applyIndustryTemplate(selectedIndustry.id)
    const teamResult = saasReadinessService.applyAgentTeamTemplate(agentTemplateId)
    const tenant = saasReadinessService.updateTenantConfig({
      businessGoal,
      enabledModules,
      dailyRunCadence: cadence,
    })
    setPreview(tenant)
    setFeedback(teamResult.message)
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">SaaS Onboarding</p>
          <h2>初始化向导</h2>
          <p className="muted">选择行业、经营目标、Agent 团队、启用模块和每日运营节奏，生成可商业化交付的租户配置预览。</p>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        当前是本地模拟初始化，不会覆盖真实生产配置、不会创建真实租户、不会接入计费或支付。
      </div>
      {feedback && <div className="feedback-banner success page-banner">{feedback}</div>}

      <div className="saas-onboarding-layout">
        <section className="form-panel">
          <p className="eyebrow">Step 1</p>
          <h3>选择行业模板</h3>
          <label className="field-group">
            <span>行业模板</span>
            <select value={industryId} onChange={event => chooseIndustry(event.target.value)}>
              {industryTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          {selectedIndustry && (
            <div className="stack-item">
              <strong>{selectedIndustry.name}</strong>
              <p>{selectedIndustry.description}</p>
              <p className="history-note">适合用户：{selectedIndustry.targetUsers}</p>
            </div>
          )}

          <label className="field-group">
            <span>经营目标</span>
            <textarea value={businessGoal} onChange={event => setBusinessGoal(event.target.value)} rows={3} />
          </label>

          <label className="field-group">
            <span>Agent 团队模板</span>
            <select value={agentTemplateId} onChange={event => setAgentTemplateId(event.target.value)}>
              {teamTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>每日运营节奏</span>
            <select value={cadence} onChange={event => setCadence(event.target.value)}>
              <option value="daily">daily</option>
              <option value="workday">workday</option>
              <option value="weekly">weekly</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="button" onClick={generatePreview}>生成配置预览</button>
            <button type="button" className="secondary-button" onClick={simulateApply}>模拟应用配置</button>
          </div>
        </section>

        <section className="stack-list">
          <article className="form-panel">
            <p className="eyebrow">Step 2</p>
            <h3>启用模块</h3>
            <div className="saas-module-grid">
              {(Object.keys(moduleLabels) as TenantEnabledModule[]).map(moduleId => (
                <label key={moduleId} className="saas-check-card">
                  <input
                    type="checkbox"
                    checked={enabledModules.includes(moduleId)}
                    onChange={() => toggleModule(moduleId)}
                  />
                  <span>{moduleLabels[moduleId]}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="form-panel">
            <p className="eyebrow">Step 3</p>
            <h3>Agent 分工预览</h3>
            <div className="stack-list compact-gap">
              {selectedTeam?.agents.map(agent => (
                <div key={agent.agentId} className="stack-item">
                  <div className="sales-card-top">
                    <strong>{agent.name}</strong>
                    <span className="metric-inline">{agent.role}</span>
                  </div>
                  <p>{agent.responsibility}</p>
                  <p className="history-note">{agent.defaultSkills.join(' / ')}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="form-panel">
            <p className="eyebrow">Step 4</p>
            <h3>初始配置预览</h3>
            <div className="saas-preview-grid">
              <PreviewRow label="Tenant" value={preview.tenantName} />
              <PreviewRow label="Owner" value={preview.ownerName} />
              <PreviewRow label="Industry" value={preview.industry} />
              <PreviewRow label="Goal" value={preview.businessGoal} />
              <PreviewRow label="Currency" value={preview.defaultCurrency} />
              <PreviewRow label="Agent Template" value={preview.agentTemplateId} />
              <PreviewRow label="Offer Catalog" value={preview.offerCatalogId} />
              <PreviewRow label="Daily Cadence" value={preview.dailyRunCadence} />
              <PreviewRow label="Modules" value={preview.enabledModules.join(', ')} />
            </div>
          </article>
        </section>
      </div>
    </section>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stack-item">
      <span className="history-note">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
