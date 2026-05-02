import tenantDefault from '../../../config/tenant-default.json'
import licenseDefault from '../../../config/license-default.json'
import industryTemplateConfig from '../../../config/industry-templates.json'
import agentTeamTemplateConfig from '../../../config/agent-team-templates.json'
import type {
  AgentTeamTemplate,
  CommercializationSummary,
  DemoDataProfile,
  IndustryTemplate,
  LicenseConfig,
  LicenseUsage,
  LicenseUsageMetric,
  SaasReadinessChecklistItem,
  TenantConfig,
} from '../types'
import { agentService } from './agentService'
import { ceoActionBoundaryService } from './ceoActionBoundaryService'
import { dailyRunService } from './dailyRunService'
import { offerCatalogService } from './offerCatalogService'
import { opportunityService } from './opportunityService'
import { revenueConfirmationService } from './revenueConfirmationService'
import { salesPipelineService } from './salesPipelineService'
import { workflowService } from './workflowService'
import { localPersistenceService, localStateKeys } from './localPersistenceService'

type IndustryTemplateFile = {
  templates: IndustryTemplate[]
}

type AgentTeamTemplateFile = {
  templates: AgentTeamTemplate[]
}

type AgentTeamApplyResult = {
  applied: boolean
  template: AgentTeamTemplate
  message: string
}

const industryData = industryTemplateConfig as IndustryTemplateFile
const teamData = agentTeamTemplateConfig as AgentTeamTemplateFile
const defaultTenant = tenantDefault as TenantConfig
const defaultLicense = licenseDefault as LicenseConfig

let localTenant: TenantConfig = localPersistenceService.getOrSeed(localStateKeys.tenantConfig, cloneTenant(defaultTenant))

function today() {
  return new Date().toISOString().slice(0, 10)
}

function cloneTenant(config: TenantConfig): TenantConfig {
  return {
    ...config,
    enabledModules: [...config.enabledModules],
  }
}

function cloneLicense(config: LicenseConfig): LicenseConfig {
  return {
    ...config,
    features: [...config.features],
  }
}

function usageMetric(used: number, max: number): LicenseUsageMetric {
  const boundedMax = Math.max(max, 0)
  return {
    used,
    max,
    remaining: boundedMax === 0 ? 0 : Math.max(boundedMax - used, 0),
    percentUsed: boundedMax === 0 ? 100 : Math.min(100, Math.round((used / boundedMax) * 100)),
  }
}

export function getTenantConfig(): TenantConfig {
  localTenant = localPersistenceService.getOrSeed(localStateKeys.tenantConfig, cloneTenant(defaultTenant))
  return cloneTenant(localTenant)
}

export function updateTenantConfig(partialConfig: Partial<TenantConfig>): TenantConfig {
  localTenant = cloneTenant({
    ...localTenant,
    ...partialConfig,
    enabledModules: partialConfig.enabledModules ? [...partialConfig.enabledModules] : localTenant.enabledModules,
    updatedAt: today(),
  })
  localPersistenceService.setItem(localStateKeys.tenantConfig, localTenant)
  return getTenantConfig()
}

export function getLicenseConfig(): LicenseConfig {
  return cloneLicense(defaultLicense)
}

export function getLicenseUsage(): LicenseUsage {
  const license = getLicenseConfig()
  return {
    agents: usageMetric(agentService.getAll().length, license.maxAgents),
    opportunities: usageMetric(opportunityService.listOpportunities().length, license.maxOpportunities),
    salesLeads: usageMetric(salesPipelineService.listSalesLeads().length, license.maxSalesLeads),
    workflowRuns: usageMetric(workflowService.listWorkflowRuns().length, license.maxWorkflowRuns),
    revenueRecords: usageMetric(revenueConfirmationService.listRevenueRecords().length, license.maxRevenueRecords),
  }
}

export function listIndustryTemplates(): IndustryTemplate[] {
  return industryData.templates.map(template => ({
    ...template,
    recommendedModules: [...template.recommendedModules],
  }))
}

export function getIndustryTemplateById(id: string): IndustryTemplate | undefined {
  return listIndustryTemplates().find(template => template.id === id)
}

export function listAgentTeamTemplates(): AgentTeamTemplate[] {
  return teamData.templates.map(template => ({
    ...template,
    agents: template.agents.map(agent => ({
      ...agent,
      defaultSkills: [...agent.defaultSkills],
    })),
  }))
}

export function getAgentTeamTemplateById(id: string): AgentTeamTemplate | undefined {
  return listAgentTeamTemplates().find(template => template.id === id)
}

export function applyIndustryTemplate(templateId: string): TenantConfig {
  const template = getIndustryTemplateById(templateId)
  if (!template) throw new Error(`Industry template not found: ${templateId}`)
  localPersistenceService.setItem(localStateKeys.selectedIndustryTemplate, templateId)
  return updateTenantConfig({
    industry: template.name,
    businessGoal: template.defaultBusinessGoal,
    enabledModules: template.recommendedModules,
    agentTemplateId: template.recommendedAgentTemplateId,
    offerCatalogId: template.recommendedOfferCatalogId,
    dailyRunCadence: template.defaultDailyRunCadence,
  })
}

export function applyAgentTeamTemplate(templateId: string): AgentTeamApplyResult {
  const template = getAgentTeamTemplateById(templateId)
  if (!template) throw new Error(`Agent team template not found: ${templateId}`)
  localPersistenceService.setItem(localStateKeys.selectedAgentTeamTemplate, templateId)
  updateTenantConfig({ agentTemplateId: template.id })
  return {
    applied: true,
    template,
    message: '当前为模板预览/模拟应用，不会覆盖现有 Agent 配置。',
  }
}

export function generateDemoDataProfile(industryTemplateId: string): DemoDataProfile {
  const template = getIndustryTemplateById(industryTemplateId) ?? listIndustryTemplates()[0]
  const offers = offerCatalogService.listOffers()
  const recommendedOffers = offers
    .filter(offer => offer.deliveryWorkflowId || offer.price <= 50000)
    .slice(0, 3)
    .map(offer => offer.name)

  const profile = {
    industryTemplateId: template.id,
    demoTenantName: `${template.name} Demo 公司`,
    demoBusinessGoal: template.defaultBusinessGoal,
    recommendedOffers,
    sampleOpportunitiesCount: opportunityService.listOpportunities().length,
    sampleSalesLeadsCount: salesPipelineService.listSalesLeads().length,
    sampleWorkflowsCount: workflowService.listWorkflowRuns().length || workflowService.listWorkflowTemplates().length,
    sampleRevenueRecordsCount: revenueConfirmationService.listRevenueRecords().length,
    salesTalkTrack: `Demo 会展示如何从 ${template.name} 场景出发，把机会发现、销售推进、交付工作流、收入确认和 CEO 动作边界串成闭环。`,
  }
  localPersistenceService.setItem(localStateKeys.demoProfile, profile)
  return profile
}

export function saveDemoProfile(profile: DemoDataProfile): DemoDataProfile {
  return localPersistenceService.setItem(localStateKeys.demoProfile, profile)
}

export function getSavedDemoProfile(): DemoDataProfile | null {
  return localPersistenceService.getItem<DemoDataProfile | null>(localStateKeys.demoProfile, null)
}

export function getSaasReadinessChecklist(): SaasReadinessChecklistItem[] {
  const tenant = getTenantConfig()
  const license = getLicenseConfig()
  const offers = offerCatalogService.listOffers()
  const industryTemplates = listIndustryTemplates()
  const teamTemplates = listAgentTeamTemplates()
  const dailyArtifacts = dailyRunService.getRequiredDailyArtifacts()
  const actionPolicy = ceoActionBoundaryService.listActionPolicy()

  return [
    { key: 'tenant_config', label: '租户配置', ready: Boolean(tenant.tenantId), detail: tenant.tenantName },
    { key: 'license_config', label: 'License 配置', ready: Boolean(license.licenseId), detail: `${license.plan} / ${license.status}` },
    { key: 'industry_templates', label: '行业模板', ready: industryTemplates.length >= 5, detail: `${industryTemplates.length} 个模板` },
    { key: 'agent_team_templates', label: 'Agent 团队模板', ready: teamTemplates.length >= 4, detail: `${teamTemplates.length} 个模板` },
    { key: 'offer_catalog', label: 'Offer Catalog', ready: offers.length > 0, detail: `${offers.length} 个产品` },
    { key: 'demo_mode', label: 'Demo Mode', ready: true, detail: '支持按行业生成 Demo Profile，不覆盖真实数据' },
    { key: 'action_boundary', label: 'CEO Action Boundary', ready: actionPolicy.length > 0, detail: `${actionPolicy.length} 个动作策略` },
    { key: 'revenue_confirmation', label: 'Revenue Confirmation', ready: revenueConfirmationService.listRevenueRecords().length > 0, detail: '已具备收入确认口径' },
    { key: 'daily_run', label: 'Daily Run', ready: dailyArtifacts.length > 0, detail: `${dailyArtifacts.length} 个每日必需产物` },
  ]
}

export function getCommercializationSummary(): CommercializationSummary {
  return {
    targetCustomers: [
      'AI 自动化服务商',
      '知识付费博主',
      '咨询顾问',
      '小型电商经营者',
      '企业数字化团队',
    ],
    packagedPlans: ['Free', 'Pro', 'Team', 'Private'],
    sellingPoints: [
      '从机会发现到收入确认的经营闭环',
      '内置 CEO 动作边界，阻断对外、财务和法律自动执行',
      '可按行业套用 Agent 团队、产品货架和每日运营节奏',
      'Demo Mode 可用于售前演示，不覆盖真实业务数据',
    ],
    missingSaasCapabilities: [
      '真实用户账号、权限和租户隔离',
      '真实支付、订阅计费和发票能力',
      '生产数据库迁移和审计留痕',
      '正式 onboarding 持久化和模板版本管理',
      '用量超限拦截和套餐升级流程',
    ],
  }
}

export function resetSaasReadinessMockStateForTest() {
  resetTenantConfigToDefault()
}

export function resetTenantConfigToDefault() {
  localTenant = cloneTenant(defaultTenant)
  localPersistenceService.setItem(localStateKeys.tenantConfig, localTenant)
  localPersistenceService.removeItem(localStateKeys.selectedIndustryTemplate)
  localPersistenceService.removeItem(localStateKeys.selectedAgentTeamTemplate)
  localPersistenceService.removeItem(localStateKeys.demoProfile)
}

export function exportSaasReadinessState() {
  return {
    tenantConfig: getTenantConfig(),
    selectedIndustryTemplate: localPersistenceService.getItem<string | null>(localStateKeys.selectedIndustryTemplate, null),
    selectedAgentTeamTemplate: localPersistenceService.getItem<string | null>(localStateKeys.selectedAgentTeamTemplate, null),
    demoProfile: getSavedDemoProfile(),
  }
}

export const saasReadinessService = {
  getTenantConfig,
  updateTenantConfig,
  getLicenseConfig,
  getLicenseUsage,
  listIndustryTemplates,
  getIndustryTemplateById,
  listAgentTeamTemplates,
  getAgentTeamTemplateById,
  applyIndustryTemplate,
  applyAgentTeamTemplate,
  generateDemoDataProfile,
  saveDemoProfile,
  getSavedDemoProfile,
  getSaasReadinessChecklist,
  getCommercializationSummary,
  resetSaasReadinessMockStateForTest,
  resetTenantConfigToDefault,
  exportSaasReadinessState,
}
