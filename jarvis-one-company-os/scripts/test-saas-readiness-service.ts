import assert from 'node:assert/strict'
import { saasReadinessService } from '../src/services/saasReadinessService'

saasReadinessService.resetSaasReadinessMockStateForTest()

const tenant = saasReadinessService.getTenantConfig()
assert.ok(tenant.tenantId, 'tenant config should load')
assert.ok(tenant.enabledModules.includes('opportunity'), 'tenant should include opportunity module')

const license = saasReadinessService.getLicenseConfig()
assert.ok(license.licenseId, 'license config should load')
assert.ok(license.maxAgents > 0, 'license should expose max agents')

const industryTemplates = saasReadinessService.listIndustryTemplates()
assert.ok(industryTemplates.length >= 5, 'should load at least 5 industry templates')
assert.ok(saasReadinessService.getIndustryTemplateById('ai_automation_service_provider'), 'should find AI automation industry template')

const teamTemplates = saasReadinessService.listAgentTeamTemplates()
assert.ok(teamTemplates.length >= 4, 'should load at least 4 agent team templates')
assert.ok(saasReadinessService.getAgentTeamTemplateById('default_one_company_team'), 'should find default agent team template')

const usage = saasReadinessService.getLicenseUsage()
assert.equal(usage.opportunities.max, license.maxOpportunities)
assert.ok(usage.opportunities.used >= 5, 'usage should count current opportunities')
assert.ok(usage.salesLeads.used >= 3, 'usage should count current sales leads')
assert.ok(usage.revenueRecords.used >= 5, 'usage should count current revenue records')

const appliedTenant = saasReadinessService.applyIndustryTemplate('consulting_advisor')
assert.equal(appliedTenant.industry, '咨询顾问')
assert.ok(appliedTenant.businessGoal.includes('客户诊断'))

const agentApplyResult = saasReadinessService.applyAgentTeamTemplate('sales_delivery_team')
assert.equal(agentApplyResult.applied, true)
assert.equal(agentApplyResult.template.id, 'sales_delivery_team')
assert.ok(agentApplyResult.message.includes('模拟'))

const demoProfile = saasReadinessService.generateDemoDataProfile('knowledge_creator')
assert.ok(demoProfile.demoTenantName)
assert.ok(demoProfile.recommendedOffers.length > 0)
assert.ok(demoProfile.salesTalkTrack.includes('Demo'))

const checklist = saasReadinessService.getSaasReadinessChecklist()
for (const key of ['tenant_config', 'license_config', 'industry_templates', 'agent_team_templates', 'offer_catalog', 'demo_mode', 'action_boundary', 'revenue_confirmation', 'daily_run']) {
  const item = checklist.find(entry => entry.key === key)
  assert.ok(item, `checklist should include ${key}`)
  assert.equal(item?.ready, true, `${key} should be ready`)
}

const summary = saasReadinessService.getCommercializationSummary()
assert.ok(summary.targetCustomers.length >= 4)
assert.ok(summary.packagedPlans.includes('Free'))
assert.ok(summary.missingSaasCapabilities.length > 0)

console.log('saasReadinessService tests passed')
