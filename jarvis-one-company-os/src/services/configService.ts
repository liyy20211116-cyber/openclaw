/**
 * Unified config loader — reads app-config.json and exposes typed accessors.
 * Frontend components and services call this instead of hardcoding values.
 */

export interface AgentConfig {
  id: string
  display_name: string
  role: string
  role_label: string
  enabled: boolean
  capabilities: string[]
  max_concurrent_tasks: number
  task_types: string[]
  monthly_token_salary: number
  level: string
  model_tier: string
  persona_keywords: string[]
  skills_file: string
}

export interface TokenEconomyConfig {
  monthly_total_budget: number
  salary_payout_rule: string
  surplus_cap_multiplier: number
  performance_bonus: {
    kpi_exceed_bonus_rate: number
    innovation_reward_range: [number, number]
    failure_penalty_rate: number
  }
  audit_thresholds: {
    daily_cost_alert_usd: number
    monthly_budget_alert_percent: number
    auto_downgrade_on_exceed: boolean
  }
  profit_distribution: {
    token_infrastructure_percent: number
    performance_bonus_percent: number
    skill_upgrade_percent: number
    reserve_percent: number
  }
}

export interface CompanyConfig {
  name: string
  ceo_name: string
  industry: string
  tagline: string
  mission: string
  vision: string
  timezone: string
  language: string
  currency: string
}

export interface ContactConfig {
  name: string
  phone: string
  email: string
  wechat: string
}

export interface ContentStrategyConfig {
  brand_positioning: string
  target_audience: string[]
  content_style: string
  platforms: string[]
}

/** 作战站会 KPI 表「目标」列（scripts/operation_standup.py 读取同名字段） */
export interface OperationTargetsConfig {
  phase_label: string
  orders: number
  revenue_cny: number
  scripts_label: string
  videos_label: string
  posters_label: string
}

export interface UIConfig {
  theme: string
  accent_color: string
  show_token_cost: boolean
  show_agent_avatars: boolean
  dashboard_refresh_interval_ms: number
}

export interface LlmProviderModel {
  id: string
  name: string
  alias?: string
  is_default?: boolean
}

export type LlmProviderType = 'official' | 'cliproxy' | 'relay'

export interface LlmProvider {
  id: string
  type: LlmProviderType
  name: string
  description?: string
  enabled: boolean
  base_url?: string
  api_key?: string
  port?: number
  binary_path?: string
  config_path?: string
  models: LlmProviderModel[]
  setup_guide?: string
}

export interface LlmConfig {
  monthly_budget_usd: number
  default_provider: string
  default_model: string
  routing_rules_file: string
  cache_identical_prompts: boolean
  batch_similar_requests: boolean
  providers: LlmProvider[]
  fallback_chains: Record<string, string[]>
}

export interface AppConfig {
  _version: string
  company: CompanyConfig
  contact: ContactConfig
  agents: AgentConfig[]
  token_economy: TokenEconomyConfig
  content_strategy: ContentStrategyConfig
  llm: LlmConfig
  ui: UIConfig
  integrations_file: string
  workflow_templates_file: string
  operation_targets: OperationTargetsConfig
}

let _cached: AppConfig | null = null
let _loading: Promise<AppConfig> | null = null

async function fetchConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('/api/company/app-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (res.ok) {
      const raw = (await res.json()) as Partial<AppConfig>
      const defaults = getDefaultConfig()
      return {
        ...defaults,
        ...raw,
        operation_targets: {
          ...defaults.operation_targets,
          ...(raw.operation_targets ?? {}),
        },
      }
    }
  } catch (e) {
    console.warn('[configService] Failed to load app-config from API:', e)
  }
  return getDefaultConfig()
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (_cached) return _cached
  if (_loading) return _loading
  _loading = fetchConfig().then(cfg => {
    _cached = cfg
    setTimeout(() => { _cached = null; _loading = null }, 600_000)
    return cfg
  })
  return _loading
}

export function getCachedConfig(): AppConfig | null {
  return _cached
}

export function invalidateConfigCache(): void {
  _cached = null
  _loading = null
}

export function getCeoName(config?: AppConfig | null): string {
  return (config ?? _cached)?.company?.ceo_name ?? 'CEO'
}

export function getCompanyName(config?: AppConfig | null): string {
  return (config ?? _cached)?.company?.name ?? '一人公司'
}

export function getAgentDisplayName(agentId: string, config?: AppConfig | null): string {
  const cfg = config ?? _cached
  const agent = cfg?.agents?.find(a => a.id === agentId)
  return agent?.display_name ?? agentId
}

export function getEnabledAgents(config?: AppConfig | null): AgentConfig[] {
  const cfg = config ?? _cached
  return cfg?.agents?.filter(a => a.enabled) ?? []
}

export function buildNameToAgentKeyMap(config?: AppConfig | null): Record<string, string> {
  const cfg = config ?? _cached
  const map: Record<string, string> = {}
  for (const agent of cfg?.agents ?? []) {
    const key = agent.id.split('-')[0]
    map[agent.display_name] = key
  }
  return map
}

export function buildIdToAgentKeyMap(config?: AppConfig | null): Record<string, string> {
  const cfg = config ?? _cached
  const map: Record<string, string> = {}
  for (const agent of cfg?.agents ?? []) {
    const key = agent.id.split('-')[0]
    map[agent.id] = key
  }
  return map
}

export function buildAgentKeyToIdMap(config?: AppConfig | null): Record<string, string> {
  const cfg = config ?? _cached
  const map: Record<string, string> = {}
  for (const agent of cfg?.agents ?? []) {
    const key = agent.id.split('-')[0]
    map[key] = agent.id
  }
  return map
}

export function buildAgentKeyToTaskTypeMap(config?: AppConfig | null): Record<string, string> {
  const cfg = config ?? _cached
  const map: Record<string, string> = {}
  for (const agent of cfg?.agents ?? []) {
    const key = agent.id.split('-')[0]
    if (agent.task_types?.length) {
      map[key] = agent.task_types[0]
    }
  }
  return map
}

function getDefaultConfig(): AppConfig {
  return {
    _version: '0.0.0',
    company: {
      name: '一人公司',
      ceo_name: 'CEO',
      industry: 'AI',
      tagline: '',
      mission: '',
      vision: '',
      timezone: 'Asia/Shanghai',
      language: 'zh-CN',
      currency: 'CNY',
    },
    contact: { name: '', phone: '', email: '', wechat: '' },
    agents: [],
    token_economy: {
      monthly_total_budget: 32000,
      salary_payout_rule: '',
      surplus_cap_multiplier: 2,
      performance_bonus: { kpi_exceed_bonus_rate: 1.5, innovation_reward_range: [500, 2000], failure_penalty_rate: 0.8 },
      audit_thresholds: { daily_cost_alert_usd: 10, monthly_budget_alert_percent: 80, auto_downgrade_on_exceed: true },
      profit_distribution: { token_infrastructure_percent: 60, performance_bonus_percent: 20, skill_upgrade_percent: 10, reserve_percent: 10 },
    },
    content_strategy: { brand_positioning: '', target_audience: [], content_style: '', platforms: [] },
    llm: {
      monthly_budget_usd: 50,
      default_provider: '',
      default_model: '',
      routing_rules_file: 'config/model-routing.json',
      cache_identical_prompts: true,
      batch_similar_requests: true,
      providers: [],
      fallback_chains: {},
    },
    ui: { theme: 'dark', accent_color: '#6366f1', show_token_cost: true, show_agent_avatars: true, dashboard_refresh_interval_ms: 30000 },
    integrations_file: 'config/integrations.json',
    workflow_templates_file: 'config/workflow-templates.json',
    operation_targets: {
      phase_label: 'Day 30',
      orders: 20,
      revenue_cny: 20000,
      scripts_label: '60+',
      videos_label: '30+',
      posters_label: '30+',
    },
  }
}
