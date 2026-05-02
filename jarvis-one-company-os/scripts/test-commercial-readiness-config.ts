import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')

function readJson<T>(relativePath: string): T {
  const fullPath = path.join(root, relativePath)
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as T
}

function collectTodoPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') {
    return value.includes('TODO_') ? [prefix || '<root>'] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectTodoPaths(item, `${prefix}[${index}]`))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      collectTodoPaths(item, prefix ? `${prefix}.${key}` : key),
    )
  }
  return []
}

interface IntegrationsConfig {
  owner?: { phone?: string; wechat?: string }
  feishu: { enabled: boolean; apps?: Record<string, { app_id?: string; app_secret?: string }> }
  social_media: Record<string, { enabled: boolean; draft_only?: boolean; account_id?: string; uid?: string; gh_id?: string }>
  outreach: Record<string, { enabled: boolean }>
  payment: Record<string, unknown>
}

interface AppConfig {
  contact: { phone: string; wechat: string }
  integrations: IntegrationsConfig
  payment: {
    wechat_pay: { enabled: boolean; account: string; qr_image_path: string }
  }
}

interface PaymentInfo {
  contact_phone: string
  contact_wechat: string
  wechat_pay: { enabled: boolean; account: string; qr_image_path: string }
}

interface SalesPipeline {
  leads: Array<{
    id: string
    name: string
    stage: string
    value: number
    contact: string
  }>
}

const integrations = readJson<IntegrationsConfig>('config/integrations.json')
const appConfig = readJson<AppConfig>('config/app-config.json')
const paymentInfo = readJson<PaymentInfo>('config/payment-info.json')
const tenantConfig = readJson<{ owner: { phone: string; wechat_id: string } }>('config/tenant/default/tenant.json')
const tenantCommerce = readJson<{ enabled: boolean; personal_qr: { wechat_qr_path: string } }>('config/tenant/default/commerce.json')
const tenantBranding = readJson<{ bilibili_display_name: string; payment: { wechat_qr_asset: string } }>('config/tenant/default/branding.json')
const douyin = readJson<{ enabled: boolean; account_id: string; login_phone: string }>('config/tenant/default/integrations/douyin.json')
const xiaohongshu = readJson<{ enabled: boolean; account_id: string; login_phone: string }>('config/tenant/default/integrations/xiaohongshu.json')
const bilibili = readJson<{ enabled: boolean; uid: string; account_name: string }>('config/tenant/default/integrations/bilibili.json')
const wechatOfficial = readJson<{ enabled: boolean; account_gh_id: string }>('config/tenant/default/integrations/wechat-official.json')
const wechatPersonal = readJson<{ enabled: boolean; wechat_id: string; bound_phone: string }>('config/tenant/default/integrations/wechat-personal.json')
const pipeline = readJson<SalesPipeline>('data_raw/sales_pipeline.json')

const todoPaths = collectTodoPaths(integrations)
assert.deepEqual(todoPaths, [], `integrations.json still contains TODO placeholders: ${todoPaths.join(', ')}`)

assert.equal(typeof integrations.feishu.enabled, 'boolean')
assert.equal(integrations.owner?.phone, '19237140413')
assert.equal(integrations.owner?.wechat, 'go19237140413')
assert.equal(integrations.feishu.apps?.jarvis?.app_id, 'cli_a9265e3c39b89cc2')
assert.equal(Boolean(integrations.feishu.apps?.jarvis?.app_secret), true)
assert.equal(integrations.feishu.apps?.wizard?.app_id, 'cli_a93d4972750b1bdb')
assert.equal(Boolean(integrations.feishu.apps?.wizard?.app_secret), true)
assert.equal(Object.keys(integrations.social_media).length >= 3, true)
assert.equal(Object.keys(integrations.outreach).length >= 2, true)
assert.equal(Object.keys(integrations.payment).length >= 3, true)
assert.equal(integrations.social_media.douyin.account_id, '32214401437')
assert.equal(integrations.social_media.xiaohongshu.account_id, '95868984797')
assert.equal(integrations.social_media.bilibili.uid, '3706974745135246')
assert.equal(integrations.social_media.wechat_official.gh_id, 'gh_8dc5a1200ef3')

assert.equal(appConfig.contact.phone, '19237140413')
assert.equal(appConfig.contact.wechat, 'go19237140413')
assert.equal(appConfig.payment.wechat_pay.enabled, true)
assert.equal(appConfig.payment.wechat_pay.qr_image_path.length > 0, true)

assert.equal(paymentInfo.contact_phone, '19237140413')
assert.equal(paymentInfo.contact_wechat, 'go19237140413')
assert.equal(paymentInfo.wechat_pay.enabled, true)

assert.equal(tenantConfig.owner.phone, '19237140413')
assert.equal(tenantConfig.owner.wechat_id, 'go19237140413')
assert.equal(tenantCommerce.enabled, true)
assert.equal(tenantCommerce.personal_qr.wechat_qr_path.length > 0, true)
assert.equal(tenantBranding.bilibili_display_name, '野子哥gogogo')
assert.equal(tenantBranding.payment.wechat_qr_asset.length > 0, true)
assert.equal(douyin.enabled, true)
assert.equal(douyin.account_id, '32214401437')
assert.equal(douyin.login_phone, '19237140413')
assert.equal(xiaohongshu.enabled, true)
assert.equal(xiaohongshu.account_id, '95868984797')
assert.equal(xiaohongshu.login_phone, '19237140413')
assert.equal(bilibili.enabled, true)
assert.equal(bilibili.uid, '3706974745135246')
assert.equal(bilibili.account_name, '野子哥gogogo')
assert.equal(wechatOfficial.enabled, true)
assert.equal(wechatOfficial.account_gh_id, 'gh_8dc5a1200ef3')
assert.equal(wechatPersonal.enabled, true)
assert.equal(wechatPersonal.wechat_id, 'go19237140413')
assert.equal(wechatPersonal.bound_phone, '19237140413')

assert.equal(Array.isArray(pipeline.leads), true)
assert.equal(pipeline.leads.length >= 1, true)
assert.equal(pipeline.leads.every(lead => lead.id && lead.name && lead.stage), true)
assert.equal(pipeline.leads.every(lead => Number.isFinite(lead.value)), true)
assert.equal(pipeline.leads.every(lead => !lead.contact.includes('TODO_')), true)

console.log('commercial readiness config tests passed')
