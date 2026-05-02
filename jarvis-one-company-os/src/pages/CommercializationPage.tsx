import { useMemo, useState } from 'react'
import { ceoActionBoundaryService } from '../services/ceoActionBoundaryService'
import { dailyRunService } from '../services/dailyRunService'
import { localPersistenceService } from '../services/localPersistenceService'
import { revenueConfirmationService } from '../services/revenueConfirmationService'
import { saasReadinessService } from '../services/saasReadinessService'
import { salesPipelineService } from '../services/salesPipelineService'
import { workflowService } from '../services/workflowService'

export function CommercializationPage() {
  const [selectedIndustryId, setSelectedIndustryId] = useState('ai_automation_service_provider')
  const [localStateVersion, setLocalStateVersion] = useState(0)
  const tenant = useMemo(() => saasReadinessService.getTenantConfig(), [localStateVersion])
  const license = useMemo(() => saasReadinessService.getLicenseConfig(), [])
  const usage = useMemo(() => saasReadinessService.getLicenseUsage(), [localStateVersion])
  const checklist = useMemo(() => saasReadinessService.getSaasReadinessChecklist(), [localStateVersion])
  const industryTemplates = useMemo(() => saasReadinessService.listIndustryTemplates(), [])
  const summary = useMemo(() => saasReadinessService.getCommercializationSummary(), [])
  const [demoProfile, setDemoProfile] = useState(() => saasReadinessService.generateDemoDataProfile(selectedIndustryId))
  const [localStateText, setLocalStateText] = useState('')
  const [localStateFeedback, setLocalStateFeedback] = useState('')
  const localStateKeys = useMemo(() => localPersistenceService.listLocalStateKeys(), [localStateVersion])

  function generateDemoProfile() {
    setDemoProfile(saasReadinessService.generateDemoDataProfile(selectedIndustryId))
    setLocalStateVersion(version => version + 1)
  }

  function exportLocalState() {
    setLocalStateText(JSON.stringify(localPersistenceService.exportAllOneCompanyLocalState(), null, 2))
    setLocalStateFeedback('已导出当前 one_company_os 本地状态。')
  }

  function importLocalState() {
    try {
      const snapshot = JSON.parse(localStateText) as Record<string, unknown>
      localPersistenceService.importAllOneCompanyLocalState(snapshot)
      setLocalStateFeedback('已导入本地状态 JSON。')
      setLocalStateVersion(version => version + 1)
    } catch (error) {
      setLocalStateFeedback(error instanceof Error ? `导入失败：${error.message}` : '导入失败：JSON 格式无效。')
    }
  }

  function clearLocalState() {
    localPersistenceService.clearAllOneCompanyLocalState()
    setLocalStateText('')
    setLocalStateFeedback('已清空所有 one_company_os 本地状态；下次读取会从 seed 初始化。')
    setLocalStateVersion(version => version + 1)
  }

  function resetToSeed() {
    salesPipelineService.resetSalesLeadsToSeed()
    workflowService.resetWorkflowStateToSeed()
    revenueConfirmationService.resetRevenueRecordsToSeed()
    dailyRunService.resetDailyRunsToSeed()
    ceoActionBoundaryService.resetMockApprovals()
    saasReadinessService.resetTenantConfigToDefault()
    setLocalStateText(JSON.stringify(localPersistenceService.exportAllOneCompanyLocalState(), null, 2))
    setLocalStateFeedback('已把本地运行态重置到 seed/default。')
    setLocalStateVersion(version => version + 1)
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">SaaS Readiness</p>
          <h2>商业化设置</h2>
          <p className="muted">把当前一人公司 OS 整理成未来可售卖的最小商业化结构：租户、License、行业模板、团队模板和 Demo Mode。</p>
        </div>
      </div>

      <div className="feedback-banner error page-banner">
        本阶段不接真实支付、不做真实 SaaS 计费、不做复杂数据库多租户隔离；Demo Mode 不会覆盖当前真实数据。
      </div>

      <div className="metrics-grid metrics-grid-6">
        <article className="metric-card">
          <span>License</span>
          <strong>{license.plan}</strong>
          <p>{license.status}</p>
        </article>
        <article className="metric-card">
          <span>机会用量</span>
          <strong>{usage.opportunities.used}/{usage.opportunities.max}</strong>
          <p>{usage.opportunities.percentUsed}%</p>
        </article>
        <article className="metric-card">
          <span>销售线索</span>
          <strong>{usage.salesLeads.used}/{usage.salesLeads.max}</strong>
          <p>{usage.salesLeads.percentUsed}%</p>
        </article>
        <article className="metric-card">
          <span>工作流运行</span>
          <strong>{usage.workflowRuns.used}/{usage.workflowRuns.max}</strong>
          <p>{usage.workflowRuns.percentUsed}%</p>
        </article>
        <article className="metric-card">
          <span>收入记录</span>
          <strong>{usage.revenueRecords.used}/{usage.revenueRecords.max}</strong>
          <p>{usage.revenueRecords.percentUsed}%</p>
        </article>
        <article className="metric-card">
          <span>Agent</span>
          <strong>{usage.agents.used}/{usage.agents.max}</strong>
          <p>{usage.agents.percentUsed}%</p>
        </article>
      </div>

      <div className="commercialization-layout">
        <section className="stack-list">
          <article className="form-panel">
            <p className="eyebrow">Tenant</p>
            <h3>当前租户信息</h3>
            <div className="saas-preview-grid">
              <Info label="tenantName" value={tenant.tenantName} />
              <Info label="ownerName" value={tenant.ownerName} />
              <Info label="industry" value={tenant.industry} />
              <Info label="businessGoal" value={tenant.businessGoal} />
              <Info label="defaultCurrency" value={tenant.defaultCurrency} />
              <Info label="enabledModules" value={tenant.enabledModules.join(', ')} />
            </div>
          </article>

          <article className="form-panel">
            <p className="eyebrow">License</p>
            <h3>当前 License</h3>
            <div className="saas-preview-grid">
              <Info label="plan" value={license.plan} />
              <Info label="status" value={license.status} />
              <Info label="expiresAt" value={license.expiresAt} />
              <Info label="features" value={license.features.join(', ')} />
            </div>
          </article>

          <article className="form-panel">
            <p className="eyebrow">Commercialization Summary</p>
            <h3>商业化摘要</h3>
            <div className="stack-list compact-gap">
              <Summary title="适合售卖给" items={summary.targetCustomers} />
              <Summary title="可包装版本" items={summary.packagedPlans} />
              <Summary title="当前卖点" items={summary.sellingPoints} />
              <Summary title="缺少的正式 SaaS 能力" items={summary.missingSaasCapabilities} />
            </div>
          </article>
        </section>

        <section className="stack-list">
          <article className="form-panel">
            <p className="eyebrow">Checklist</p>
            <h3>商业化准备清单</h3>
            <div className="stack-list compact-gap">
              {checklist.map(item => (
                <div key={item.key} className="stack-item">
                  <div className="sales-card-top">
                    <strong>{item.label}</strong>
                    <span className={item.ready ? 'status-pill approved' : 'status-pill rejected'}>{item.ready ? 'Ready' : 'Missing'}</span>
                  </div>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="form-panel">
            <p className="eyebrow">Demo Mode</p>
            <h3>Demo Profile</h3>
            <label className="field-group">
              <span>行业模板</span>
              <select value={selectedIndustryId} onChange={event => setSelectedIndustryId(event.target.value)}>
                {industryTemplates.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" onClick={generateDemoProfile}>生成 Demo Profile</button>
            </div>
            <div className="daily-standup-card">
              <p className="eyebrow">Demo</p>
              <h3>{demoProfile.demoTenantName}</h3>
              <p>{demoProfile.salesTalkTrack}</p>
            </div>
            <div className="saas-preview-grid">
              <Info label="业务目标" value={demoProfile.demoBusinessGoal} />
              <Info label="推荐产品" value={demoProfile.recommendedOffers.join(', ')} />
              <Info label="机会样本" value={String(demoProfile.sampleOpportunitiesCount)} />
              <Info label="线索样本" value={String(demoProfile.sampleSalesLeadsCount)} />
              <Info label="工作流样本" value={String(demoProfile.sampleWorkflowsCount)} />
              <Info label="收入样本" value={String(demoProfile.sampleRevenueRecordsCount)} />
            </div>
          </article>

          <article className="form-panel">
            <p className="eyebrow">Local Persistence</p>
            <h3>本地数据管理</h3>
            <div className="feedback-banner error">
              当前为本地演示持久化，不是正式数据库存储。
            </div>
            <div className="stack-item">
              <strong>Local State Keys</strong>
              <p className="history-note">{localStateKeys.length > 0 ? localStateKeys.join(', ') : '暂无本地状态'}</p>
            </div>
            <label className="field-group">
              <span>导出 / 导入 JSON</span>
              <textarea
                value={localStateText}
                onChange={event => setLocalStateText(event.target.value)}
                rows={8}
                placeholder="点击导出本地状态，或粘贴要导入的 one_company_os JSON snapshot"
              />
            </label>
            <div className="form-actions revenue-actions">
              <button type="button" onClick={exportLocalState}>导出本地状态 JSON</button>
              <button type="button" className="secondary-button" onClick={importLocalState}>导入本地状态 JSON</button>
              <button type="button" className="secondary-button" onClick={resetToSeed}>重置到 seed</button>
              <button type="button" className="reject-button" onClick={clearLocalState}>清空本地状态</button>
            </div>
            {localStateFeedback && <div className="feedback-banner success">{localStateFeedback}</div>}
          </article>
        </section>
      </div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="stack-item">
      <span className="history-note">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Summary({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="stack-item">
      <strong>{title}</strong>
      {items.map(item => <p key={item} className="history-note">{item}</p>)}
    </div>
  )
}
